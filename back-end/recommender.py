import ast
import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.metrics.pairwise import cosine_similarity

MODELS_DIR = Path(__file__).parent / "models"


# ── helpers ───────────────────────────────────────────────────────────────────

def safe_parse(val):
    try:
        result = ast.literal_eval(val)
        return result if isinstance(result, list) else []
    except Exception:
        return []


# ── main class ────────────────────────────────────────────────────────────────

class Recommender:
    """
    Optimized recommender: fully vectorized feature building.
    All per-row pandas/Python loops replaced with numpy batch ops.
    """

    def __init__(self):
        print("Loading model artifacts...")

        # 1. LightGBM LambdaRank model
        self.model = lgb.Booster(
            model_file=str(MODELS_DIR / "recommendation_model_lambdarank.txt")
        )

        # 2. TF-IDF vectorizers
        self.tfidf_skills    = joblib.load(MODELS_DIR / "tfidf_skills.pkl")
        self.tfidf_goals     = joblib.load(MODELS_DIR / "tfidf_goals.pkl")
        self.tfidf_can_offer = joblib.load(MODELS_DIR / "tfidf_can_offer.pkl")
        self.tfidf_needs     = joblib.load(MODELS_DIR / "tfidf_needs.pkl")

        # 3. Categorical encoders
        self.oe_seniority = joblib.load(MODELS_DIR / "oe_seniority.pkl")
        self.le_industry  = joblib.load(MODELS_DIR / "le_industry.pkl")
        self.le_city      = joblib.load(MODELS_DIR / "le_city.pkl")

        # 4. Profiles dataframe
        self.profiles = pd.read_csv(MODELS_DIR / "profiles_encoded.csv")
        self._prepare_profiles()

        # 5. Build TF-IDF matrices in memory
        print("Building TF-IDF matrices in memory...")
        self.skills_matrix    = self.tfidf_skills.transform(self.profiles["skills_text"])
        self.goals_matrix     = self.tfidf_goals.transform(self.profiles["goals_text"])
        self.can_offer_matrix = self.tfidf_can_offer.transform(self.profiles["can_offer_text"])
        self.needs_matrix     = self.tfidf_needs.transform(self.profiles["needs_text"])

        # 6. Fast O(1) lookup: profile_id → row index
        self.profile_id_to_idx = {
            pid: i for i, pid in enumerate(self.profiles["profile_id"])
        }

        # 7. ── PRE-EXTRACT numpy arrays for hot-path features ──────────────
        #    Eliminates per-row pandas .iloc[] calls inside the feature loop.
        self.exp_arr      = self.profiles["years_experience"].fillna(0.0).to_numpy(np.float32)
        self.conn_arr     = np.maximum(
                                self.profiles["connections"].fillna(1.0).to_numpy(np.float32), 1.0
                            )
        self.sen_arr      = self.profiles["seniority_ord"].to_numpy(np.int32)
        self.remote_arr   = self.profiles["remote_enc"].to_numpy(np.int32)
        self.industry_arr = self.profiles["industry_enc"].to_numpy(np.int32)

        # Precompute per-profile industry & location for fast candidate filtering
        self.industry_col = self.profiles["industry"].to_numpy(dtype=object)
        self.location_col = self.profiles["location"].to_numpy(dtype=object)
        self.pid_col      = self.profiles["profile_id"].to_numpy(dtype=object)

        print(f"Ready — {len(self.profiles):,} profiles loaded.")

    # ── private helpers ───────────────────────────────────────────────────────

    def _prepare_profiles(self):
        for col in ["skills", "goals", "needs", "can_offer"]:
            self.profiles[f"{col}_list"] = self.profiles[col].apply(safe_parse)
            self.profiles[f"{col}_text"] = self.profiles[f"{col}_list"].apply(
                lambda x: " ".join(x)
            )

        if "about" in self.profiles.columns:
            self.profiles["about_text"] = self.profiles["about"].fillna("")
        else:
            self.profiles["about_text"] = ""

        if "remote_enc" not in self.profiles.columns:
            remote_map = {"remote": 2, "hybrid": 1, "onsite": 0}
            if "remote_preference" in self.profiles.columns:
                self.profiles["remote_enc"] = (
                    self.profiles["remote_preference"]
                    .str.lower()
                    .map(remote_map)
                    .fillna(1)
                    .astype(int)
                )
            else:
                self.profiles["remote_enc"] = 1

        if "seniority_ord" not in self.profiles.columns:
            self.profiles["seniority_ord"] = self.oe_seniority.transform(
                self.profiles[["seniority_level"]].fillna("entry")
            ).astype(int)

        if "industry_enc" not in self.profiles.columns:
            self.profiles["industry_enc"] = self.le_industry.transform(
                self.profiles["industry"].fillna("unknown")
            )

    def _build_feature_matrix_vectorized(self, ia: int, candidate_indices: np.ndarray) -> np.ndarray:
        """
        Build (N × 9) feature matrix entirely with numpy/scipy — no Python loops.

        Features:
          0  skill_sim      – cosine similarity on TF-IDF skills vectors
          1  goals_sim      – cosine similarity on TF-IDF goals vectors
          2  exp_gap        – |years_experience_a - years_experience_b|
          3  same_industry  – 1 if same industry, else 0
          4  seniority_gap  – |seniority_a - seniority_b|
          5  conn_ratio     – max(conn)/min(conn) network size ratio
          6  exp_sum        – combined experience
          7  mentorship     – 1 if senior(≥2) paired with junior(≤1)
          8  remote_match   – 2 - |remote_a - remote_b|
        """
        N = len(candidate_indices)

        # ── scalar features (all numpy, no loops) ────────────────────────────
        exp_a  = float(self.exp_arr[ia])
        conn_a = float(self.conn_arr[ia])
        sen_a  = int(self.sen_arr[ia])
        r_a    = int(self.remote_arr[ia])
        ind_a  = int(self.industry_arr[ia])

        exp_b  = self.exp_arr[candidate_indices]          # (N,)
        conn_b = self.conn_arr[candidate_indices]
        sen_b  = self.sen_arr[candidate_indices].astype(np.float32)
        r_b    = self.remote_arr[candidate_indices].astype(np.float32)
        ind_b  = self.industry_arr[candidate_indices]

        exp_gap       = np.abs(exp_a - exp_b)                               # (N,)
        same_industry = (ind_b == ind_a).astype(np.float32)                 # (N,)
        sen_gap       = np.abs(sen_a - sen_b)                               # (N,)
        conn_max      = np.maximum(conn_a, conn_b)
        conn_min      = np.minimum(conn_a, conn_b)
        conn_ratio    = conn_max / conn_min                                  # (N,)
        exp_sum       = exp_a + exp_b                                        # (N,)
        mentorship    = (
            (np.maximum(sen_a, sen_b) >= 2) & (np.minimum(sen_a, sen_b) <= 1)
        ).astype(np.float32)                                                 # (N,)
        remote_match  = (2 - np.abs(r_a - r_b)).astype(np.float32)         # (N,)

        # ── sparse TF-IDF cosine similarities (batch, no loop) ───────────────
        # skills_matrix row ia: (1, V_s)  ×  candidate rows: (N, V_s)ᵀ  → (1, N)
        skill_sims = cosine_similarity(
            self.skills_matrix[ia], self.skills_matrix[candidate_indices]
        ).ravel().astype(np.float32)                                         # (N,)

        goals_sims = cosine_similarity(
            self.goals_matrix[ia], self.goals_matrix[candidate_indices]
        ).ravel().astype(np.float32)                                         # (N,)

        # ── stack into (N, 9) ─────────────────────────────────────────────────
        feat = np.column_stack([
            skill_sims,     # 0
            goals_sims,     # 1
            exp_gap,        # 2
            same_industry,  # 3
            sen_gap,        # 4
            conn_ratio,     # 5
            exp_sum,        # 6
            mentorship,     # 7
            remote_match,   # 8
        ])
        return feat  # (N, 9) float32

    # ── public API ────────────────────────────────────────────────────────────

    def recommend(
        self,
        profile_id: str,
        top_n: int = 10,
        diversity: float = 0.3,
        fetch_n: int = 60,
    ) -> list | None:

        ia = self.profile_id_to_idx.get(profile_id)
        if ia is None:
            return None

        # ── candidate filtering (vectorised, no pandas groupby) ───────────────
        ind_a = self.industry_col[ia]
        loc_a = self.location_col[ia]

        mask = (self.industry_col == ind_a) | (self.location_col == loc_a)
        mask[ia] = False                      # exclude self
        candidate_indices = np.where(mask)[0]

        if len(candidate_indices) < 500:
            rng = np.random.default_rng(42)
            all_idx = np.arange(len(self.profiles))
            all_idx = all_idx[all_idx != ia]
            candidate_indices = rng.choice(all_idx, size=min(2000, len(all_idx)), replace=False)

        # limit to 2000
        candidate_indices = candidate_indices[:2000]

        # ── build features — fully vectorized ────────────────────────────────
        feat_matrix = self._build_feature_matrix_vectorized(ia, candidate_indices)

        # ── batch model prediction ────────────────────────────────────────────
        scores = self.model.predict(feat_matrix)  # (N,)

        # ── top-fetch_n candidates ────────────────────────────────────────────
        top_local = np.argsort(scores)[::-1][:fetch_n]
        top_indices = candidate_indices[top_local]   # global df row indices
        top_scores  = scores[top_local]
        top_feats   = feat_matrix[top_local]         # (fetch_n, 9)

        # ── MMR diversity re-ranking ──────────────────────────────────────────
        selected  = []
        remaining = list(range(len(top_indices)))

        for _ in range(min(top_n, len(remaining))):
            best_i, best_mmr = None, -1e9

            if not selected:
                # first pick = highest scorer
                best_i = remaining[0]
            else:
                sel_feats = top_feats[selected]         # (k, 9)
                for i in remaining:
                    relevance = float(top_scores[i])
                    max_sim   = float(
                        cosine_similarity(top_feats[i : i + 1], sel_feats).max()
                    )
                    mmr = (1 - diversity) * relevance - diversity * max_sim
                    if mmr > best_mmr:
                        best_mmr, best_i = mmr, i

            selected.append(best_i)
            remaining.remove(best_i)

        # ── build response list ───────────────────────────────────────────────
        results = []
        for rank, sel_i in enumerate(selected, 1):
            ib  = int(top_indices[sel_i])
            p   = self.profiles.iloc[ib]
            results.append({
                "rank":             rank,
                "profile_id":       str(self.pid_col[ib]),
                "name":             str(p.get("name", "")),
                "current_role":     str(p.get("current_role", "")),
                "current_company":  str(p.get("current_company", "")),
                "industry":         str(p.get("industry", "")),
                "seniority_level":  str(p.get("seniority_level", "")),
                "years_experience": round(float(self.exp_arr[ib]), 1),
                "remote_preference":str(p.get("remote_preference", "")),
                "location":         str(p.get("location", "")),
                "score":            round(float(top_scores[sel_i]), 4),
            })

        return results

    def search_profiles(self, query: str = "", limit: int = 20) -> list:
        df = self.profiles
        if query.strip():
            q = query.strip()
            mask = (
                df["name"].str.contains(q, case=False, na=False)
                | df["current_role"].str.contains(q, case=False, na=False)
                | df["industry"].str.contains(q, case=False, na=False)
                | df["current_company"].str.contains(q, case=False, na=False)
            )
            df = df[mask]

        cols = ["profile_id", "name", "current_role", "current_company",
                "industry", "seniority_level", "location"]
        return df.head(limit)[cols].fillna("").to_dict("records")

    def get_profile(self, profile_id: str) -> dict | None:
        idx = self.profile_id_to_idx.get(profile_id)
        if idx is None:
            return None
        p = self.profiles.iloc[idx]
        return {
            "profile_id":        str(p.get("profile_id", "")),
            "name":              str(p.get("name", "")),
            "current_role":      str(p.get("current_role", "")),
            "current_company":   str(p.get("current_company", "")),
            "industry":          str(p.get("industry", "")),
            "seniority_level":   str(p.get("seniority_level", "")),
            "years_experience":  round(float(p.get("years_experience", 0)), 1),
            "location":          str(p.get("location", "")),
            "remote_preference": str(p.get("remote_preference", "")),
            "connections":       int(p.get("connections", 0)),
            "skills":            p.get("skills_list", []),
            "goals":             p.get("goals_list", []),
            "needs":             p.get("needs_list", []),
            "can_offer":         p.get("can_offer_list", []),
        }