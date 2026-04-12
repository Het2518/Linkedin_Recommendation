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


def jaccard(list_a, list_b):
    a = set(str(x).lower().strip() for x in list_a)
    b = set(str(x).lower().strip() for x in list_b)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


# ── main class ────────────────────────────────────────────────────────────────

class Recommender:
    """
    Loads all saved model artifacts on startup, then serves recommendations
    via recommend() and utility methods for the FastAPI routes.
    """

    def __init__(self):
        print("Loading model artifacts...")

        # 1. LightGBM LambdaRank model
        self.model = lgb.Booster(
            model_file=str(MODELS_DIR / "recommendation_model_lambdarank.txt")
        )

        # 2. TF-IDF vectorizers (already fitted in notebook — we only call .transform())
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

        # 5. Build TF-IDF matrices in memory (transform only — no re-fitting)
        print("Building TF-IDF matrices in memory...")
        self.skills_matrix    = self.tfidf_skills.transform(self.profiles["skills_text"])
        self.goals_matrix     = self.tfidf_goals.transform(self.profiles["goals_text"])
        self.can_offer_matrix = self.tfidf_can_offer.transform(self.profiles["can_offer_text"])
        self.needs_matrix     = self.tfidf_needs.transform(self.profiles["needs_text"])

        # 6. Fast O(1) lookup: profile_id → row index
        self.profile_id_to_idx = {
            pid: i for i, pid in enumerate(self.profiles["profile_id"])
        }

        print(f"Ready — {len(self.profiles):,} profiles loaded.")

    # ── private helpers ───────────────────────────────────────────────────────

    def _prepare_profiles(self):
        """Re-parse list columns and fill any missing encoded columns."""

        # Re-parse JSON/list columns (CSV stores them as plain strings)
        for col in ["skills", "goals", "needs", "can_offer"]:
            self.profiles[f"{col}_list"] = self.profiles[col].apply(safe_parse)
            self.profiles[f"{col}_text"] = self.profiles[f"{col}_list"].apply(
                lambda x: " ".join(x)
            )

        # about_text
        if "about" in self.profiles.columns:
            self.profiles["about_text"] = self.profiles["about"].fillna("")
        else:
            self.profiles["about_text"] = ""

        # remote_enc — map text preference to number if not already done
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

        # seniority_ord — re-encode if column missing
        if "seniority_ord" not in self.profiles.columns:
            self.profiles["seniority_ord"] = self.oe_seniority.transform(
                self.profiles[["seniority_level"]].fillna("entry")
            ).astype(int)

        # industry_enc — re-encode if column missing
        if "industry_enc" not in self.profiles.columns:
            self.profiles["industry_enc"] = self.le_industry.transform(
                self.profiles["industry"].fillna("unknown")
            )

    def _build_feature_matrix(self, profile_id: str, candidate_ids: list):
        """
        Build a (N × 9) feature matrix for all candidates at once.
        Returns (matrix, valid_candidate_ids).
        """
        ia = self.profile_id_to_idx.get(profile_id)
        if ia is None:
            return None, []

        a      = self.profiles.iloc[ia]
        exp_a  = float(a["years_experience"]) if pd.notna(a["years_experience"]) else 0.0
        conn_a = max(float(a["connections"])  if pd.notna(a["connections"])  else 1.0, 1.0)
        sen_a  = int(a["seniority_ord"])
        r_a    = int(a["remote_enc"])

        rows, valid_ids = [], []

        for cid in candidate_ids:
            ib = self.profile_id_to_idx.get(cid)
            if ib is None:
                continue
            b      = self.profiles.iloc[ib]
            exp_b  = float(b["years_experience"]) if pd.notna(b["years_experience"]) else 0.0
            conn_b = max(float(b["connections"])  if pd.notna(b["connections"])  else 1.0, 1.0)
            sen_b  = int(b["seniority_ord"])

            rows.append([
                # 1. Skill overlap (Jaccard on exact skill names)
                jaccard(a["skills_list"], b["skills_list"]),
                # 2. Goals text cosine similarity
                float(cosine_similarity(self.goals_matrix[ia], self.goals_matrix[ib])[0][0]),
                # 3. Experience gap (absolute years)
                abs(exp_a - exp_b),
                # 4. Same industry flag
                1 if a["industry_enc"] == b["industry_enc"] else 0,
                # 5. Seniority gap (career-order distance)
                abs(sen_a - sen_b),
                # 6. Connections ratio (larger / smaller network)
                max(conn_a, conn_b) / min(conn_a, conn_b),
                # 7. Combined experience
                exp_a + exp_b,
                # 8. Mentorship potential (senior paired with junior)
                1 if (max(sen_a, sen_b) >= 2 and min(sen_a, sen_b) <= 1) else 0,
                # 9. Remote preference match
                2 - abs(r_a - int(b["remote_enc"])),
            ])
            valid_ids.append(cid)

        if not rows:
            return None, []

        return np.array(rows, dtype=np.float32), valid_ids

    # ── public API ────────────────────────────────────────────────────────────

    def recommend(
        self,
        profile_id: str,
        top_n: int = 10,
        diversity: float = 0.3,
        fetch_n: int = 60,
    ) -> list | None:
        """
        Returns top_n recommended profiles using MMR diversity.

        diversity=0.0  →  pure relevance score ranking
        diversity=0.3  →  recommended default (good balance)
        diversity=1.0  →  maximum diversity, ignores score order
        """
        if profile_id not in self.profile_id_to_idx:
            return None  # caller raises 404

        candidates       = [p for p in self.profiles["profile_id"] if p != profile_id]
        feat_matrix, ids = self._build_feature_matrix(profile_id, candidates)

        if feat_matrix is None:
            return []

        # Score all candidates in one batch call (fast)
        scores = self.model.predict(feat_matrix)

        # Keep only top fetch_n by raw score (reduces MMR loop work)
        top_idx    = np.argsort(scores)[::-1][:fetch_n]
        top_ids    = [ids[i] for i in top_idx]
        top_scores = scores[top_idx]
        top_feats  = feat_matrix[top_idx]

        # MMR selection loop
        selected  = []
        remaining = list(range(len(top_ids)))

        for _ in range(min(top_n, len(remaining))):
            if not remaining:
                break
            best_i, best_mmr = None, -99999.0

            for i in remaining:
                relevance = float(top_scores[i])
                if not selected:
                    mmr_score = relevance
                else:
                    max_sim   = float(
                        cosine_similarity(
                            top_feats[i].reshape(1, -1),
                            top_feats[selected]
                        ).max()
                    )
                    mmr_score = (1 - diversity) * relevance - diversity * max_sim

                if mmr_score > best_mmr:
                    best_mmr, best_i = mmr_score, i

            selected.append(best_i)
            remaining.remove(best_i)

        # Build result list
        results = []
        for rank, sel_i in enumerate(selected, 1):
            pid = top_ids[sel_i]
            ib  = self.profile_id_to_idx[pid]
            p   = self.profiles.iloc[ib]

            results.append({
                "rank":             rank,
                "profile_id":       str(pid),
                "name":             str(p.get("name", "")),
                "current_role":     str(p.get("current_role", "")),
                "current_company":  str(p.get("current_company", "")),
                "industry":         str(p.get("industry", "")),
                "seniority_level":  str(p.get("seniority_level", "")),
                "years_experience": round(float(p.get("years_experience", 0)), 1),
                "remote_preference":str(p.get("remote_preference", "")),
                "location":         str(p.get("location", "")),
                "score":            round(float(top_scores[sel_i]), 4),
            })

        return results

    def search_profiles(self, query: str = "", limit: int = 20) -> list:
        """Search profiles by name, role, industry, or company."""
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
        """Return full profile details for a single profile_id."""
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