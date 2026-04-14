"""
recommender.py — Two-Tower + FAISS production serving layer

Fixes in this version:
  • search_profiles: token inverted-index built at startup → O(1) lookup, instant
  • MMR: fully vectorized numpy (no sklearn loop) → 10-50x faster
  • recommend(): returns skills, goals, score as 0-100, benefit explanation,
    industry_match, experience_gap — all needed by the new UI
  • All hot-path pandas replaced with pre-extracted numpy arrays
  • Thread-safe (stateless per request)
"""

from __future__ import annotations

import ast
import json
import logging
import time
from pathlib import Path
from typing import Optional

import faiss
import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F

logger = logging.getLogger("recommender")
MODELS_DIR = Path(__file__).parent / "models_twotower"


# ── helpers ───────────────────────────────────────────────────────────────────

def safe_parse(val) -> list:
    try:
        r = ast.literal_eval(val)
        return r if isinstance(r, list) else []
    except Exception:
        return []


def _benefit_label(exp_a: float, exp_b: float, ind_match: bool,
                   sen_a: int, sen_b: int) -> str:
    if sen_a >= 2 and sen_b <= 1:
        return "Mentorship — senior can guide junior"
    if sen_b >= 2 and sen_a <= 1:
        return "Mentorship — you can learn from their experience"
    if ind_match and abs(exp_a - exp_b) <= 2:
        return "Strong peer — same industry, similar level"
    if ind_match:
        return "Industry peers — cross-level learning potential"
    if abs(exp_a - exp_b) >= 5:
        return "High growth — significant experience gap"
    return "Complementary — diverse background and perspective"


# ── model (must match training exactly) ──────────────────────────────────────

class Tower(nn.Module):
    def __init__(self, input_dim: int, emb_dim: int = 128, dropout: float = 0.2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 64),  nn.BatchNorm1d(64),  nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(64, 128),        nn.BatchNorm1d(128), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(128, emb_dim),
        )
    def forward(self, x): return F.normalize(self.net(x), p=2, dim=-1)


class TwoTowerModel(nn.Module):
    def __init__(self, input_dim: int, emb_dim: int = 128, dropout: float = 0.2):
        super().__init__()
        self.tower_a = Tower(input_dim, emb_dim, dropout)
        self.tower_b = Tower(input_dim, emb_dim, dropout)
    def encode_a(self, x): return self.tower_a(x)
    def encode_b(self, x): return self.tower_b(x)


# ── main class ────────────────────────────────────────────────────────────────

class Recommender:
    def __init__(self) -> None:
        t0 = time.perf_counter()
        logger.info("Loading recommender…")

        with open(MODELS_DIR / "config.json") as f:
            cfg = json.load(f)
        self.emb_dim     = cfg["emb_dim"]
        self.profile_dim = cfg["profile_dim"]
        nprobe           = cfg.get("faiss_nprobe", 32)

        # Pipelines
        self.tfidf_skills    = joblib.load(MODELS_DIR / "tfidf_skills.pkl")
        self.svd_skills      = joblib.load(MODELS_DIR / "svd_skills.pkl")
        self.tfidf_goals     = joblib.load(MODELS_DIR / "tfidf_goals.pkl")
        self.svd_goals       = joblib.load(MODELS_DIR / "svd_goals.pkl")
        self.tfidf_can_offer = joblib.load(MODELS_DIR / "tfidf_can_offer.pkl")
        self.svd_can_offer   = joblib.load(MODELS_DIR / "svd_can_offer.pkl")
        self.oe_seniority    = joblib.load(MODELS_DIR / "oe_seniority.pkl")
        self.scaler          = joblib.load(MODELS_DIR / "scalar_scaler.pkl")

        # Profiles
        self.profiles = pd.read_csv(MODELS_DIR / "profiles_encoded.csv")
        self._prepare_profiles()

        # Model
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model  = TwoTowerModel(self.profile_dim, self.emb_dim).to(self.device)
        self.model.load_state_dict(
            torch.load(MODELS_DIR / "two_tower_best.pt", map_location=self.device)
        )
        self.model.eval()

        # FAISS
        self.faiss_index = faiss.read_index(str(MODELS_DIR / "profiles.faiss"))
        self.faiss_index.nprobe = nprobe
        self.all_embs = np.load(MODELS_DIR / "all_embeddings.npy").astype(np.float32)

        # Feature matrix
        self._build_profile_vectors()

        # Hot-path numpy arrays
        self.pid_arr   = self.profiles["profile_id"].to_numpy(dtype=object)
        self.exp_arr   = self.profiles["years_experience"].fillna(0).to_numpy(np.float32)
        self.sen_arr   = self.profiles["seniority_ord"].fillna(0).to_numpy(np.int32)
        self.conn_arr  = self.profiles["connections"].fillna(0).to_numpy(np.int32)
        self.ind_arr   = self.profiles["industry"].fillna("").to_numpy(dtype=object)
        self.loc_arr   = self.profiles["location"].fillna("").to_numpy(dtype=object)

        for col in ["name","current_role","current_company","industry",
                    "seniority_level","location","remote_preference"]:
            src = self.profiles[col] if col in self.profiles.columns else pd.Series([""] * len(self.profiles))
            setattr(self, f"_c_{col}", src.fillna("").to_numpy(dtype=object))

        self._c_skills    = self.profiles["skills_list"].to_numpy(dtype=object)
        self._c_goals     = self.profiles["goals_list"].to_numpy(dtype=object)
        self._c_needs     = self.profiles["needs_list"].to_numpy(dtype=object)
        self._c_can_offer = self.profiles["can_offer_list"].to_numpy(dtype=object)

        # Lookups
        self.pid_to_idx: dict[str, int] = {p: i for i, p in enumerate(self.pid_arr)}
        self._search_idx: dict[str, list[int]] = {}
        self._build_search_index()

        logger.info(f"Ready — {len(self.profiles):,} profiles in {time.perf_counter()-t0:.1f}s")

    # ── init helpers ──────────────────────────────────────────────────────────

    def _prepare_profiles(self) -> None:
        for col in ["skills","goals","needs","can_offer"]:
            self.profiles[f"{col}_list"] = self.profiles[col].apply(safe_parse)
            self.profiles[f"{col}_text"] = self.profiles[f"{col}_list"].apply(" ".join)

        if "remote_enc" not in self.profiles.columns:
            rmap = {"remote":2,"hybrid":1,"onsite":0}
            col  = self.profiles.get("remote_preference", pd.Series(dtype=str))
            self.profiles["remote_enc"] = col.str.lower().map(rmap).fillna(1).astype(int)

        if "seniority_ord" not in self.profiles.columns:
            self.profiles["seniority_ord"] = self.oe_seniority.transform(
                self.profiles[["seniority_level"]].fillna("entry")
            ).astype(float)

    def _build_profile_vectors(self) -> None:
        df = self.profiles
        s  = self.svd_skills.transform(self.tfidf_skills.transform(df["skills_text"])).astype(np.float32)
        g  = self.svd_goals.transform(self.tfidf_goals.transform(df["goals_text"])).astype(np.float32)
        c  = self.svd_can_offer.transform(self.tfidf_can_offer.transform(df["can_offer_text"])).astype(np.float32)
        sc = self.scaler.transform(
            df[["years_experience","seniority_ord","remote_enc"]].fillna(0).astype(np.float32)
        ).astype(np.float32)
        self.profile_vectors = np.concatenate([s, g, c, sc], axis=1)

    def _build_search_index(self) -> None:
        """Build inverted token index over name/role/company/industry/location."""
        srcs = [self._c_name, self._c_current_role, self._c_current_company,
                self._c_industry, self._c_location]
        for i in range(len(self.pid_arr)):
            seen: set[str] = set()
            for arr in srcs:
                for tok in arr[i].lower().split():
                    tok = tok.strip(".,-()")
                    if len(tok) >= 2 and tok not in seen:
                        seen.add(tok)
                        self._search_idx.setdefault(tok, []).append(i)

    # ── embedding ─────────────────────────────────────────────────────────────

    def _embed(self, idx: int, tower: str = "a") -> np.ndarray:
        vec = torch.tensor(self.profile_vectors[idx:idx+1], dtype=torch.float32).to(self.device)
        with torch.no_grad():
            emb = self.model.encode_a(vec) if tower == "a" else self.model.encode_b(vec)
        return emb.cpu().numpy().astype(np.float32)

    # ── vectorized MMR ────────────────────────────────────────────────────────

    @staticmethod
    def _mmr(scores: np.ndarray, embs: np.ndarray, top_n: int, lam: float) -> list[int]:
        """
        Pure numpy MMR. O(N·k) matrix multiply, zero Python loops per candidate.
        lam=0 → pure relevance, lam=1 → pure diversity.
        """
        N      = min(len(scores), top_n)
        avail  = np.ones(len(scores), dtype=bool)
        max_sim= np.full(len(scores), -1.0, dtype=np.float32)
        sel    = []
        for _ in range(N):
            mmr = np.where(avail, (1-lam)*scores - lam*np.maximum(max_sim, 0), -np.inf)
            best = int(np.argmax(mmr))
            sel.append(best)
            avail[best] = False
            sim = embs @ embs[best]
            np.maximum(max_sim, sim, out=max_sim)
        return sel

    # ── public ────────────────────────────────────────────────────────────────

    def recommend(
        self,
        profile_id: str,
        top_n: int = 10,
        diversity: float = 0.3,
        fetch_n: int = 150,
    ) -> Optional[list[dict]]:
        ia = self.pid_to_idx.get(profile_id)
        if ia is None:
            return None

        # 1. Embed
        q_emb = self._embed(ia, "a")

        # 2. FAISS ANN
        _, raw = self.faiss_index.search(q_emb, fetch_n + 1)
        indices = raw[0]
        indices = indices[(indices >= 0) & (indices != ia)][:fetch_n]

        # 3. Re-score
        cand_embs = self.all_embs[indices]
        scores    = (q_emb @ cand_embs.T).ravel()

        # 4. MMR
        sel = self._mmr(scores, cand_embs, top_n, diversity)

        # 5. Format
        exp_a = float(self.exp_arr[ia])
        sen_a = int(self.sen_arr[ia])
        ind_a = str(self.ind_arr[ia])

        results = []
        for rank, si in enumerate(sel, 1):
            ib        = int(indices[si])
            raw_score = float(scores[si])
            score_pct = round((raw_score + 1) / 2 * 100, 1)
            exp_b     = float(self.exp_arr[ib])
            sen_b     = int(self.sen_arr[ib])
            ind_b     = str(self.ind_arr[ib])
            ind_match = ind_a.lower() == ind_b.lower()

            results.append({
                "rank":             rank,
                "profile_id":       str(self.pid_arr[ib]),
                "name":             str(self._c_name[ib]),
                "current_role":     str(self._c_current_role[ib]),
                "current_company":  str(self._c_current_company[ib]),
                "industry":         str(self._c_industry[ib]),
                "seniority_level":  str(self._c_seniority_level[ib]),
                "years_experience": round(exp_b, 1),
                "location":         str(self._c_location[ib]),
                "remote_preference":str(self._c_remote_preference[ib]),
                "connections":      int(self.conn_arr[ib]),
                "skills":           list(self._c_skills[ib]),
                "goals":            list(self._c_goals[ib]),
                "score":            score_pct,
                "experience_gap":   round(abs(exp_a - exp_b), 1),
                "industry_match":   ind_match,
                "benefit":          _benefit_label(exp_a, exp_b, ind_match, sen_a, sen_b),
            })
        return results

    def search_profiles(self, query: str = "", limit: int = 20) -> list[dict]:
        cols = ["profile_id","name","current_role","current_company",
                "industry","seniority_level","location","connections",
                "years_experience","remote_preference"]

        if not query.strip():
            return self.profiles.head(limit)[cols].fillna("").to_dict("records")

        tokens = [t.strip(".,").lower() for t in query.split() if len(t.strip(".,")) >= 2]
        if not tokens:
            return []

        sets = [set(self._search_idx.get(t, [])) for t in tokens]
        hits = sets[0].intersection(*sets[1:]) if len(sets) > 1 else sets[0]
        if len(hits) < 3:
            for s in sets[1:]:
                hits |= s
        hits = sorted(hits)[:limit]
        return self.profiles.iloc[hits][cols].fillna("").to_dict("records") if hits else []

    def get_profile(self, profile_id: str) -> Optional[dict]:
        idx = self.pid_to_idx.get(profile_id)
        if idx is None:
            return None
        p = self.profiles.iloc[idx]
        return {
            "profile_id":        str(p.get("profile_id","")),
            "name":              str(p.get("name","")),
            "current_role":      str(p.get("current_role","")),
            "current_company":   str(p.get("current_company","")),
            "industry":          str(p.get("industry","")),
            "seniority_level":   str(p.get("seniority_level","")),
            "years_experience":  round(float(p.get("years_experience") or 0), 1),
            "location":          str(p.get("location","")),
            "remote_preference": str(p.get("remote_preference","")),
            "connections":       int(p.get("connections") or 0),
            "skills":            p.get("skills_list",[]),
            "goals":             p.get("goals_list",[]),
            "needs":             p.get("needs_list",[]),
            "can_offer":         p.get("can_offer_list",[]),
        }

    def stats(self) -> dict:
        return {
            "profiles":  len(self.profiles),
            "faiss":     self.faiss_index.ntotal,
            "emb_dim":   self.emb_dim,
            "device":    self.device,
            "idx_keys":  len(self._search_idx),
        }