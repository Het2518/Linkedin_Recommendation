"""
recommender.py  —  Two-Tower Neural Network + FAISS serving layer

Inference pipeline (per request)
─────────────────────────────────
1. profile_id  →  19-d feature vector  (TF-IDF SVD + scalars)
2. feature vec →  128-d embedding      (tower_a forward pass)
3. embedding   →  top-100 ANN results  (FAISS IVFFlat inner-product search)
4. top-100     →  re-scored & MMR      (tower_a·tower_b dot product + diversity)
5. top-N       →  returned as list

All 50K candidate embeddings are pre-computed at startup (tower_b).
FAISS search is sub-millisecond — the model only runs tower_a once per request.
"""

import ast
import json
import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
import faiss
from pathlib import Path
from sklearn.metrics.pairwise import cosine_similarity

MODELS_DIR = Path(__file__).parent / "models_twotower"


# ── helpers ───────────────────────────────────────────────────────────────────

def safe_parse(val):
    try:
        result = ast.literal_eval(val)
        return result if isinstance(result, list) else []
    except Exception:
        return []


# ── model definition (must match training code) ───────────────────────────────

class Tower(nn.Module):
    def __init__(self, input_dim: int, emb_dim: int = 128, dropout: float = 0.2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(dropout),

            nn.Linear(64, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(dropout),

            nn.Linear(128, emb_dim),
        )

    def forward(self, x):
        return F.normalize(self.net(x), p=2, dim=-1)


class TwoTowerModel(nn.Module):
    def __init__(self, input_dim: int, emb_dim: int = 128, dropout: float = 0.2):
        super().__init__()
        self.tower_a = Tower(input_dim, emb_dim, dropout)
        self.tower_b = Tower(input_dim, emb_dim, dropout)

    def forward(self, x_a, x_b):
        emb_a = self.tower_a(x_a)
        emb_b = self.tower_b(x_b)
        return torch.sigmoid((emb_a * emb_b).sum(dim=-1))

    def encode_a(self, x):
        return self.tower_a(x)

    def encode_b(self, x):
        return self.tower_b(x)


# ── main class ────────────────────────────────────────────────────────────────

class Recommender:
    """
    Two-Tower recommender with FAISS ANN retrieval.

    Startup sequence:
      1. Load config.json → know dims
      2. Load TF-IDF + SVD pipelines
      3. Load profiles_encoded.csv
      4. Load PyTorch two-tower model
      5. Load FAISS index (pre-built, 50K vectors)
      6. Load pre-computed all_embeddings.npy (for MMR cosine distance)
    """

    def __init__(self):
        print("Loading Two-Tower recommender...")

        # ── config ────────────────────────────────────────────────────────────
        with open(MODELS_DIR / "config.json") as f:
            cfg = json.load(f)

        self.emb_dim      = cfg["emb_dim"]          # 128
        self.profile_dim  = cfg["profile_dim"]       # 19
        self.faiss_nprobe = cfg.get("faiss_nprobe", 32)

        # ── TF-IDF + SVD pipelines ────────────────────────────────────────────
        self.tfidf_skills    = joblib.load(MODELS_DIR / "tfidf_skills.pkl")
        self.svd_skills      = joblib.load(MODELS_DIR / "svd_skills.pkl")
        self.tfidf_goals     = joblib.load(MODELS_DIR / "tfidf_goals.pkl")
        self.svd_goals       = joblib.load(MODELS_DIR / "svd_goals.pkl")
        self.tfidf_can_offer = joblib.load(MODELS_DIR / "tfidf_can_offer.pkl")
        self.svd_can_offer   = joblib.load(MODELS_DIR / "svd_can_offer.pkl")

        # ── scalar encoder + scaler ───────────────────────────────────────────
        self.oe_seniority = joblib.load(MODELS_DIR / "oe_seniority.pkl")
        self.le_industry  = joblib.load(MODELS_DIR / "le_industry.pkl")
        self.scaler       = joblib.load(MODELS_DIR / "scalar_scaler.pkl")

        # ── profiles ──────────────────────────────────────────────────────────
        self.profiles = pd.read_csv(MODELS_DIR / "profiles_encoded.csv")
        self._prepare_profiles()

        # ── PyTorch model (eval mode, no gradients needed) ────────────────────
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model  = TwoTowerModel(self.profile_dim, self.emb_dim).to(self.device)
        self.model.load_state_dict(
            torch.load(MODELS_DIR / "two_tower_best.pt", map_location=self.device)
        )
        self.model.eval()
        print(f"  PyTorch model loaded on {self.device}")

        # ── FAISS index ───────────────────────────────────────────────────────
        self.faiss_index = faiss.read_index(str(MODELS_DIR / "profiles.faiss"))
        self.faiss_index.nprobe = self.faiss_nprobe
        print(f"  FAISS index loaded  ({self.faiss_index.ntotal:,} vectors, nprobe={self.faiss_nprobe})")

        # ── pre-computed candidate embeddings (tower_b) for MMR ──────────────
        self.all_embs = np.load(MODELS_DIR / "all_embeddings.npy").astype(np.float32)

        # ── pre-built feature matrix (for fast profile vector lookup) ─────────
        self._build_profile_vectors()

        # ── O(1) lookup ───────────────────────────────────────────────────────
        self.profile_id_to_idx = {
            pid: i for i, pid in enumerate(self.profiles["profile_id"])
        }
        self.pid_col = self.profiles["profile_id"].to_numpy(dtype=object)

        print(f"Ready — {len(self.profiles):,} profiles loaded.")

    # ── private helpers ───────────────────────────────────────────────────────

    def _prepare_profiles(self):
        for col in ["skills", "goals", "needs", "can_offer"]:
            self.profiles[f"{col}_list"] = self.profiles[col].apply(safe_parse)
            self.profiles[f"{col}_text"] = self.profiles[f"{col}_list"].apply(
                lambda x: " ".join(x)
            )

        if "remote_enc" not in self.profiles.columns:
            remote_map = {"remote": 2, "hybrid": 1, "onsite": 0}
            if "remote_preference" in self.profiles.columns:
                self.profiles["remote_enc"] = (
                    self.profiles["remote_preference"].str.lower()
                    .map(remote_map).fillna(1).astype(int)
                )
            else:
                self.profiles["remote_enc"] = 1

        if "seniority_ord" not in self.profiles.columns:
            self.profiles["seniority_ord"] = self.oe_seniority.transform(
                self.profiles[["seniority_level"]].fillna("entry")
            ).astype(float)

    def _build_profile_vectors(self):
        """Build the 19-d feature matrix for all 50K profiles (same as training)."""
        print("  Building profile feature matrix...")
        texts = self.profiles

        skills_dense    = self.svd_skills.transform(
            self.tfidf_skills.transform(texts["skills_text"])
        ).astype(np.float32)

        goals_dense     = self.svd_goals.transform(
            self.tfidf_goals.transform(texts["goals_text"])
        ).astype(np.float32)

        can_offer_dense = self.svd_can_offer.transform(
            self.tfidf_can_offer.transform(texts["can_offer_text"])
        ).astype(np.float32)

        scalar = self.profiles[["years_experience", "seniority_ord", "remote_enc"]] \
                     .fillna(0).astype(np.float32).values
        scalar_norm = self.scaler.transform(scalar).astype(np.float32)

        self.profile_vectors = np.concatenate(
            [skills_dense, goals_dense, can_offer_dense, scalar_norm], axis=1
        )
        print(f"  Profile vectors: {self.profile_vectors.shape}")

    def _profile_to_embedding(self, profile_idx: int, tower: str = "a") -> np.ndarray:
        """
        Convert a profile row index → 128-d embedding using tower_a (query) or tower_b (candidate).
        Returns (1, 128) float32 numpy array.
        """
        vec = torch.tensor(
            self.profile_vectors[profile_idx:profile_idx + 1], dtype=torch.float32
        ).to(self.device)

        with torch.no_grad():
            if tower == "a":
                emb = self.model.encode_a(vec)
            else:
                emb = self.model.encode_b(vec)
        return emb.cpu().numpy().astype(np.float32)

    # ── public API ────────────────────────────────────────────────────────────

    def recommend(
        self,
        profile_id: str,
        top_n: int = 10,
        diversity: float = 0.3,
        fetch_n: int = 100,        # ANN retrieves this many candidates before re-ranking
    ) -> list | None:
        """
        Full two-tower + MMR recommendation pipeline.

        Step 1 — Embed query with tower_a        (1 forward pass, ~0.5ms)
        Step 2 — ANN search in FAISS             (~1ms for 50K vectors)
        Step 3 — Re-score top-fetch_n with       (dot product on pre-loaded embeddings)
                  tower_a · tower_b embeddings
        Step 4 — MMR diversity re-ranking        (greedy, O(fetch_n²))
        Step 5 — Return top_n results
        """
        ia = self.profile_id_to_idx.get(profile_id)
        if ia is None:
            return None

        # ── Step 1: embed query (tower_a) ─────────────────────────────────────
        q_emb = self._profile_to_embedding(ia, tower="a")   # (1, 128)

        # ── Step 2: FAISS ANN search ──────────────────────────────────────────
        distances, indices = self.faiss_index.search(q_emb, fetch_n + 1)   # +1 for self
        distances = distances[0]  # (fetch_n+1,)
        indices   = indices[0]    # (fetch_n+1,)  — global profile row indices

        # Remove self from results
        mask      = indices != ia
        distances = distances[mask][:fetch_n]
        indices   = indices[mask][:fetch_n]

        # ── Step 3: re-score using precise dot product ─────────────────────────
        # q_emb (1, 128)  ·  candidate_embs (fetch_n, 128)ᵀ  → (fetch_n,)
        cand_embs  = self.all_embs[indices]           # (fetch_n, 128), pre-loaded
        scores     = (q_emb @ cand_embs.T).ravel()    # (fetch_n,) — cosine similarity

        # Sort by descending score
        order      = np.argsort(scores)[::-1]
        indices    = indices[order]
        scores     = scores[order]
        cand_embs  = cand_embs[order]

        # ── Step 4: MMR diversity re-ranking ──────────────────────────────────
        selected  = []
        remaining = list(range(len(indices)))

        for _ in range(min(top_n, len(remaining))):
            best_i, best_mmr = None, -1e9

            if not selected:
                best_i = remaining[0]
            else:
                sel_embs = cand_embs[selected]          # (k, 128)
                for i in remaining:
                    relevance = float(scores[i])
                    max_sim   = float(
                        cosine_similarity(cand_embs[i:i+1], sel_embs).max()
                    )
                    mmr = (1 - diversity) * relevance - diversity * max_sim
                    if mmr > best_mmr:
                        best_mmr, best_i = mmr, i

            selected.append(best_i)
            remaining.remove(best_i)

        # ── Step 5: build response ────────────────────────────────────────────
        results = []
        for rank, sel_i in enumerate(selected, 1):
            ib = int(indices[sel_i])
            p  = self.profiles.iloc[ib]
            results.append({
                "rank":             rank,
                "profile_id":       str(self.pid_col[ib]),
                "name":             str(p.get("name", "")),
                "current_role":     str(p.get("current_role", "")),
                "current_company":  str(p.get("current_company", "")),
                "industry":         str(p.get("industry", "")),
                "seniority_level":  str(p.get("seniority_level", "")),
                "years_experience": round(float(p.get("years_experience", 0) or 0), 1),
                "location":         str(p.get("location", "")),
                "score":            round(float(scores[sel_i]), 4),
            })

        return results

    def search_profiles(self, query: str = "", limit: int = 20) -> list:
        df = self.profiles
        if query.strip():
            q    = query.strip()
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
            "years_experience":  round(float(p.get("years_experience", 0) or 0), 1),
            "location":          str(p.get("location", "")),
            "connections":       int(p.get("connections", 0) or 0),
            "skills":            p.get("skills_list", []),
            "goals":             p.get("goals_list", []),
            "needs":             p.get("needs_list", []),
            "can_offer":         p.get("can_offer_list", []),
        }