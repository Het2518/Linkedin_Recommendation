"""
main.py — FastAPI serving layer for ConnectIQ Two-Tower Recommender

Endpoints:
  GET  /                   health + stats
  GET  /stats              detailed recommender stats
  GET  /profiles?q=&limit= instant token-index search
  GET  /profile/{id}       full profile data
  POST /recommend          Two-Tower + FAISS + MMR recommendations
  DEL  /cache              clear result cache

Changes vs previous:
  • X-Response-Time header on every response
  • /stats endpoint
  • Proper HTTP 422 validation error messages
  • Cache keyed on (profile_id, top_n, diversity_bucket, fetch_n)
  • fetch_n exposed in request so UI can tune ANN pool size
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field

from recommender import Recommender

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
logger = logging.getLogger("main")

# ── lifespan ──────────────────────────────────────────────────────────────────

recommender: Recommender | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global recommender
    recommender = Recommender()
    yield


# ── app ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ConnectIQ API",
    description="Two-Tower Neural Network + FAISS professional connection recommendations.",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Timing middleware
@app.middleware("http")
async def add_timing(request: Request, call_next):
    t0  = time.perf_counter()
    res = await call_next(request)
    ms  = round((time.perf_counter() - t0) * 1000, 1)
    res.headers["X-Response-Time"] = f"{ms}ms"
    return res


# ── schemas ───────────────────────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    profile_id: str   = Field(..., description="profile_id from GET /profiles")
    top_n:      int   = Field(10,  ge=1,  le=50)
    diversity:  float = Field(0.3, ge=0.0, le=1.0)
    fetch_n:    int   = Field(150, ge=10, le=500)


# ── cache ─────────────────────────────────────────────────────────────────────

_cache: dict[tuple, list] = {}
_MAX  = 1000


def _key(r: RecommendRequest) -> tuple:
    return (r.profile_id, r.top_n, round(r.diversity, 1), r.fetch_n)


def _get(k): return _cache.get(k)


def _set(k, v):
    if len(_cache) >= _MAX:
        for old in list(_cache)[:200]:
            del _cache[old]
    _cache[k] = v


# ── routes ────────────────────────────────────────────────────────────────────

@app.get("/", tags=["health"])
def root():
    s = recommender.stats()
    return {
        "status":   "running",
        "model":    "Two-Tower + FAISS IVFFlat",
        "version":  "3.0.0",
        **s,
        "cache":    len(_cache),
        "docs":     "/docs",
    }


@app.get("/stats", tags=["health"])
def stats():
    return recommender.stats()


@app.get("/profiles", tags=["profiles"])
def search_profiles(
    q:     str = Query(default="", description="Search query (name, role, company, industry)"),
    limit: int = Query(default=20, ge=1, le=100),
):
    results = recommender.search_profiles(query=q, limit=limit)
    return {"profiles": results, "count": len(results)}


@app.get("/profile/{profile_id}", tags=["profiles"])
def get_profile(profile_id: str):
    p = recommender.get_profile(profile_id)
    if not p:
        raise HTTPException(404, f"Profile '{profile_id}' not found")
    return p


@app.post("/recommend", tags=["recommendations"])
def recommend(req: RecommendRequest):
    k      = _key(req)
    cached = _get(k)
    if cached is not None:
        return {"cached": True,  "count": len(cached), "recommendations": cached,
                "profile_id": req.profile_id, "diversity": req.diversity}

    results = recommender.recommend(
        profile_id=req.profile_id,
        top_n=req.top_n,
        diversity=req.diversity,
        fetch_n=req.fetch_n,
    )
    if results is None:
        raise HTTPException(404, f"Profile '{req.profile_id}' not found. Use GET /profiles.")

    _set(k, results)
    return {"cached": False, "count": len(results), "recommendations": results,
            "profile_id": req.profile_id, "diversity": req.diversity}


@app.delete("/cache", tags=["admin"])
def clear_cache():
    _cache.clear()
    return {"cleared": True}