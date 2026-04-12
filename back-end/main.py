from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from recommender import Recommender

# ── app lifespan — load model once on startup ─────────────────────────────────

recommender: Recommender | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global recommender
    recommender = Recommender()   # loads model + all pkl files + builds matrices
    yield
    # nothing to clean up


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="LinkedIn Recommendation API",
    description="ML-powered professional connection recommendations using LambdaRank + MMR",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow React dev server (port 5173) and production build to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # fallback (CRA)
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── request / response models ─────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    profile_id: str = Field(..., description="The profile_id to get recommendations for")
    top_n:      int   = Field(default=10,  ge=1, le=50,  description="Number of results to return")
    diversity:  float = Field(default=0.3, ge=0, le=1.0, description="0 = pure score, 1 = max diversity")


# ── routes ────────────────────────────────────────────────────────────────────

@app.get("/", tags=["health"])
def root():
    """Health check — visit /docs to test all endpoints in the browser."""
    return {
        "status":  "running",
        "docs":    "/docs",
        "profiles": f"{len(recommender.profiles):,} loaded",
    }


@app.get("/profiles", tags=["profiles"])
def search_profiles(
    q:     str = Query(default="",  description="Search by name, role, company or industry"),
    limit: int = Query(default=20,  ge=1, le=100, description="Max results"),
):
    """
    Search profiles for the dropdown / autocomplete in the React UI.

    Examples:
      GET /profiles              → first 20 profiles
      GET /profiles?q=engineer   → profiles matching 'engineer'
      GET /profiles?q=Healthcare&limit=50
    """
    results = recommender.search_profiles(query=q, limit=limit)
    return {"profiles": results, "count": len(results)}


@app.get("/profile/{profile_id}", tags=["profiles"])
def get_profile(profile_id: str):
    """
    Get full details for a single profile — shown in the 'Your profile' panel.
    """
    profile = recommender.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Profile '{profile_id}' not found")
    return profile


@app.post("/recommend", tags=["recommendations"])
def recommend(req: RecommendRequest):
    """
    Get top-N recommended connections for a profile using MMR diversity ranking.

    Request body:
      {
        "profile_id": "P_00001",
        "top_n": 10,
        "diversity": 0.3
      }

    Response:
      {
        "profile_id": "P_00001",
        "count": 10,
        "diversity": 0.3,
        "recommendations": [ { "rank": 1, "name": "...", "score": 6.58, ... }, ... ]
      }
    """
    results = recommender.recommend(
        profile_id=req.profile_id,
        top_n=req.top_n,
        diversity=req.diversity,
    )

    if results is None:
        raise HTTPException(
            status_code=404,
            detail=f"Profile '{req.profile_id}' not found. Use GET /profiles to find valid IDs."
        )

    return {
        "profile_id":      req.profile_id,
        "count":           len(results),
        "diversity":       req.diversity,
        "recommendations": results,
    }