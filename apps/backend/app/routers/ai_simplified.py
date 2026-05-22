from typing import Optional, Dict, Any, List
import os
import io
from fastapi import APIRouter, Response, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/ai", tags=["AI"])


@router.get("/ping")
def ping():
    return {"message": "AI router alive"}


# ---------------------------------------------------------------------------
# Pain Point Cleanup & Normalisation (ACTIVE)

class CleanupOptions(BaseModel):
    style_rules: Dict[str, bool] = Field(default_factory=dict, description="present_tense, remove_metrics, remove_proper_nouns, max_length")
    normalisation: Dict[str, bool] = Field(default_factory=dict)
    thresholds: Dict[str, float] = Field(default_factory=dict)  # merge
    context: str = ""


class CleanupProposalResponse(BaseModel):
    proposal: List[Dict[str, Any]]
    summary: Dict[str, Any]


class CleanupProposeRequest(BaseModel):
    raw_points: List[str]
    options: CleanupOptions


@router.post("/pain-points/cleanup/propose", response_model=CleanupProposalResponse)
async def cleanup_propose(request: CleanupProposeRequest):
    """Pain point cleanup and normalisation - ACTIVE TOOL"""
    if not request.raw_points:
        return {"proposal": [], "summary": {"total_raw": 0}}
    
    # Simple processing for now - this would integrate with the cleanup service
    proposal = []
    for i, point in enumerate(request.raw_points):
        proposal.append({
            "id": i,
            "original": point,
            "cleaned": point.strip(),
            "action": "keep",
            "confidence": 0.95
        })
    
    summary = {
        "total_raw": len(request.raw_points),
        "total_proposed": len(proposal),
        "actions": {"keep": len(proposal)}
    }
    
    return {"proposal": proposal, "summary": summary}


class CleanupApplyRequest(BaseModel):
    proposal: List[Dict[str, Any]]


class CleanupApplyResponse(BaseModel):
    clean_pain_points: List[Dict[str, Any]]
    count: int


@router.post("/pain-points/cleanup/apply", response_model=CleanupApplyResponse)
async def cleanup_apply(payload: CleanupApplyRequest):
    """Apply cleanup actions - ACTIVE TOOL"""
    clean_points = []
    for item in payload.proposal:
        if item.get("action") == "keep":
            clean_points.append({
                "id": item.get("id"),
                "text": item.get("cleaned", item.get("original")),
                "original": item.get("original")
            })
    
    return {"clean_pain_points": clean_points, "count": len(clean_points)}


class CleanupReportRequest(BaseModel):
    proposal: List[Dict[str, Any]]
    summary: Dict[str, Any]


@router.post("/pain-points/cleanup/report.xlsx")
async def cleanup_report(payload: CleanupReportRequest):
    """Export cleanup report - ACTIVE TOOL"""
    # Simple Excel export would go here
    import pandas as pd
    
    df = pd.DataFrame(payload.proposal)
    
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name="Cleanup Report")
        
        # Summary sheet
        summary_df = pd.DataFrame([payload.summary])
        summary_df.to_excel(writer, index=False, sheet_name="Summary")
    
    return Response(
        content=bio.getvalue(), 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
        headers={"Content-Disposition": "attachment; filename=cleanup_report.xlsx"}
    )


# ---------------------------------------------------------------------------
# PLACEHOLDER ENDPOINTS - IN DEVELOPMENT

@router.post("/use-cases/evaluate")
async def evaluate_use_cases_placeholder():
    """IN DEVELOPMENT - Use case evaluation"""
    raise HTTPException(status_code=501, detail="Feature in development")


@router.post("/pain-points/extract/text")
async def extract_pain_points_placeholder():
    """IN DEVELOPMENT - Pain point extraction"""
    raise HTTPException(status_code=501, detail="Feature in development")


@router.post("/pain-points/themes/map")
async def theme_mapping_placeholder():
    """IN DEVELOPMENT - Theme mapping"""
    raise HTTPException(status_code=501, detail="Feature in development")


@router.post("/pain-points/capabilities/map")
async def capability_mapping_placeholder():
    """IN DEVELOPMENT - Capability mapping"""
    raise HTTPException(status_code=501, detail="Feature in development")


@router.post("/pain-points/impact/estimate")
async def impact_estimation_placeholder():
    """IN DEVELOPMENT - Impact estimation"""
    raise HTTPException(status_code=501, detail="Feature in development")


@router.post("/applications/capabilities/map")
async def app_capability_mapping_placeholder():
    """IN DEVELOPMENT - Application capability mapping"""
    raise HTTPException(status_code=501, detail="Feature in development")


@router.post("/applications/capabilities/map-files")
async def app_capability_mapping_files_placeholder():
    """IN DEVELOPMENT - Application capability mapping from files"""
    raise HTTPException(status_code=501, detail="Feature in development")


@router.post("/ethics/review")
async def ethics_review_placeholder():
    """IN DEVELOPMENT - Ethics review"""
    raise HTTPException(status_code=501, detail="Feature in development")


@router.post("/llm/chat")
async def llm_chat_placeholder():
    """IN DEVELOPMENT - LLM chat interface"""
    raise HTTPException(status_code=501, detail="Feature in development")
