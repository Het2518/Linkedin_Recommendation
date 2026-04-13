"""
main.py — FastAPI serving layer for the Two-Tower LinkedIn Recommender

API surface (unchanged from LambdaRank version):
  GET  /                      → health check
  GET  /profiles?q=&limit=    → search profiles
  GET  /profile/{profile_id}  → get single profile
  POST /recommend             → get top-N recommendations
  DEL  /cache                 → clear result cache

The recommender now uses Two-Tower + FAISS under the hood.
No changes needed on the frontend — same request/response shapes.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field

from recommender import Recommender


# ── app lifespan ──────────────────────────────────────────────────────────────

recommender: Recommender | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global recommender
    print("🚀 Loading Two-Tower recommender...")
    recommender = Recommender()
    print("✅ Recommender ready!")
    yield


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="LinkedIn Recommendation API — Two-Tower",
    description=(
        "Two-Tower Neural Network + FAISS ANN retrieval for professional connection recommendations. "
        "Retrieval: ~1ms FAISS ANN search over 50K profiles. "
        "Re-ranking: precise cosine similarity on pre-computed embeddings. "
        "Diversity: Maximal Marginal Relevance (MMR)."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── request / response models ─────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    profile_id: str   = Field(..., description="profile_id to get recommendations for")
    top_n:      int   = Field(default=10,  ge=1, le=50,  description="How many results to return")
    diversity:  float = Field(default=0.3, ge=0, le=1.0, description="MMR diversity weight (0=pure relevance, 1=pure diversity)")
    fetch_n:    int   = Field(default=100, ge=10, le=500, description="ANN candidate pool size before re-ranking")


# ── in-process result cache ───────────────────────────────────────────────────

_rec_cache: dict = {}
_MAX_CACHE = 500


def _cache_key(profile_id: str, top_n: int, diversity: float, fetch_n: int) -> tuple:
    return (profile_id, top_n, round(diversity, 1), fetch_n)


def _cache_get(key):
    return _rec_cache.get(key)


def _cache_set(key, value):
    if len(_rec_cache) >= _MAX_CACHE:
        for k in list(_rec_cache.keys())[:100]:
            del _rec_cache[k]
    _rec_cache[key] = value


# ── routes ────────────────────────────────────────────────────────────────────

@app.get("/", tags=["health"])
def root():
    return {
        "status":    "running",
        "model":     "Two-Tower Neural Network + FAISS IVFFlat",
        "docs":      "/docs",
        "profiles":  f"{len(recommender.profiles):,} loaded",
        "faiss":     f"{recommender.faiss_index.ntotal:,} vectors indexed",
        "cache":     f"{len(_rec_cache)} entries",
    }


@app.get("/profiles", tags=["profiles"])
def search_profiles(
    q:     str = Query(default=""),
    limit: int = Query(default=20, ge=1, le=100),
):
    results = recommender.search_profiles(query=q, limit=limit)
    return {"profiles": results, "count": len(results)}


@app.get("/profile/{profile_id}", tags=["profiles"])
def get_profile(profile_id: str):
    profile = recommender.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Profile '{profile_id}' not found")
    return profile


@app.post("/recommend", tags=["recommendations"])
def recommend(req: RecommendRequest):
    key    = _cache_key(req.profile_id, req.top_n, req.diversity, req.fetch_n)
    cached = _cache_get(key)
    if cached is not None:
        return {
            "profile_id":      req.profile_id,
            "count":           len(cached),
            "diversity":       req.diversity,
            "fetch_n":         req.fetch_n,
            "model":           "two-tower-faiss",
            "cached":          True,
            "recommendations": cached,
        }

    results = recommender.recommend(
        profile_id=req.profile_id,
        top_n=req.top_n,
        diversity=req.diversity,
        fetch_n=req.fetch_n,
    )

    if results is None:
        raise HTTPException(
            status_code=404,
            detail=f"Profile '{req.profile_id}' not found. Use GET /profiles to find valid IDs.",
        )

    _cache_set(key, results)

    return {
        "profile_id":      req.profile_id,
        "count":           len(results),
        "diversity":       req.diversity,
        "fetch_n":         req.fetch_n,
        "model":           "two-tower-faiss",
        "cached":          False,
        "recommendations": results,
    }


@app.delete("/cache", tags=["admin"])
def clear_cache():
    _rec_cache.clear()
    return {"cleared": True}