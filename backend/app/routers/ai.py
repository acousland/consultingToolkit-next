from typing import Optional, Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/ai", tags=["AI"])


@router.get("/ping")
def ping():
    return {"message": "AI router alive"}


class UseCaseEvalRequest(BaseModel):
    use_case: str = Field(..., description="Text describing the AI use case")
    company_context: Optional[str] = Field(None, description="Optional company context to tailor evaluation")


class UseCaseEvalResponse(BaseModel):
    scores: Dict[str, int]
    rationale: Dict[str, str]


@router.post("/use-case/evaluate", response_model=UseCaseEvalResponse)
async def evaluate_use_case(payload: UseCaseEvalRequest):
    """
    Placeholder evaluator. Replace with real LLM/scoring service.
    """
    base = min(90, 40 + len(payload.use_case) % 50)
    ctx_boost = 5 if payload.company_context and len(payload.company_context) > 50 else 0
    scores = {
        "feasibility": max(10, base - 10 + ctx_boost),
        "impact": max(10, base + ctx_boost),
        "strategic_alignment": max(10, base - 5 + ctx_boost),
    }
    rationale = {
        "feasibility": "Estimate based on supplied description length (placeholder).",
        "impact": "Heuristic placeholder. Replace with model-backed scoring.",
        "strategic_alignment": "Heuristic placeholder with optional context boost.",
    }
    return {"scores": scores, "rationale": rationale}


class EthicsReviewRequest(BaseModel):
    use_case: str


class EthicsReviewResponse(BaseModel):
    deontological: Dict[str, Any]
    utilitarian: Dict[str, Any]
    social_contract: Dict[str, Any]
    virtue: Dict[str, Any]
    summary: Dict[str, Any]


@router.post("/ethics/review", response_model=EthicsReviewResponse)
async def ethics_review(payload: EthicsReviewRequest):
    """Concise, placeholder ethics review with 1-10 scores."""
    length_factor = min(10, max(3, len(payload.use_case) // 120))
    deo = {"summary": "Rules and duties check (placeholder)", "score": length_factor}
    uti = {"summary": "Pros/cons balance (placeholder)", "score": min(10, length_factor + 1)}
    soc = {"summary": "Trust and expectations (placeholder)", "score": max(1, length_factor - 1)}
    vir = {"summary": "Character and virtue (placeholder)", "score": length_factor}
    composite = round((deo["score"] + uti["score"] + soc["score"] + vir["score"]) / 4, 1)
    rec = "Proceed" if composite >= 7 else ("Proceed with Caution" if composite >= 5 else "Do Not Proceed")
    summary = {"composite": composite, "recommendation": rec}
    return {
        "deontological": deo,
        "utilitarian": uti,
        "social_contract": soc,
        "virtue": vir,
        "summary": summary,
    }
