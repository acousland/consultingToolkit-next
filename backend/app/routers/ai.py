from typing import Optional, Dict, Any, List
import io
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, Response
from pydantic import BaseModel, Field
from ..services.pain_points import extract_from_file, extract_from_texts
from ..services.themes import map_themes_perspectives, PREDEFINED_THEMES, PREDEFINED_PERSPECTIVES
from ..services.capabilities import map_capabilities, dataframe_to_xlsx_bytes as caps_to_xlsx
from ..services.impact import estimate_impact, dataframe_to_xlsx_bytes as impact_to_xlsx

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


# Pain Point Extraction Schemas
class PainPointExtractTextRequest(BaseModel):
    rows: List[str] = Field(..., description="List of text rows to analyse")
    additional_prompts: Optional[str] = ""
    chunk_size: Optional[int] = 20


class PainPointExtractResponse(BaseModel):
    pain_points: List[str]


@router.post("/pain-points/extract/text", response_model=PainPointExtractResponse)
async def extract_pain_points_text(payload: PainPointExtractTextRequest):
    points = await extract_from_texts(
        payload.rows,
        additional_prompts=payload.additional_prompts or "",
        chunk_size=payload.chunk_size or 20,
    )
    return {"pain_points": points}


# Theme & Perspective Mapping
class ThemeMapResponse(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]


@router.post("/pain-points/themes/map", response_model=ThemeMapResponse)
async def pain_point_theme_map(
    file: UploadFile = File(...),
    id_column: str = Form(...),
    text_columns: str = Form(..., description="JSON array of text columns to concatenate"),
    additional_context: Optional[str] = Form(""),
    batch_size: Optional[int] = Form(10),
    sheet_name: Optional[str] = Form(None),
):
    content = await file.read()
    try:
        txt_cols = list(dict.fromkeys(__import__("json").loads(text_columns))) if text_columns else []
    except Exception:
        txt_cols = []
    df = await map_themes_perspectives(
        filename=file.filename or "uploaded",
        content=content,
        id_column=id_column,
        text_columns=txt_cols,
        additional_context=additional_context or "",
        batch_size=int(batch_size or 10),
        sheet_name=sheet_name,
    )
    return {"columns": list(map(str, df.columns)), "rows": df.to_dict(orient="records")}


@router.post("/pain-points/themes/map.xlsx")
async def pain_point_theme_map_xlsx(
    file: UploadFile = File(...),
    id_column: str = Form(...),
    text_columns: str = Form(...),
    additional_context: Optional[str] = Form(""),
    batch_size: Optional[int] = Form(10),
    sheet_name: Optional[str] = Form(None),
):
    content = await file.read()
    try:
        txt_cols = list(dict.fromkeys(__import__("json").loads(text_columns))) if text_columns else []
    except Exception:
        txt_cols = []
    df = await map_themes_perspectives(
        filename=file.filename or "uploaded",
        content=content,
        id_column=id_column,
        text_columns=txt_cols,
        additional_context=additional_context or "",
        batch_size=int(batch_size or 10),
        sheet_name=sheet_name,
    )
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
    return Response(content=bio.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=theme_perspective_mapping.xlsx"})


# Capability Mapping
class CapMapResponse(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]


@router.post("/pain-points/capabilities/map", response_model=CapMapResponse)
async def pain_point_capability_map(
    file: UploadFile = File(...),
    id_column: str = Form(...),
    text_columns: str = Form(...),
    capabilities_text: str = Form(..., description="Text list of capabilities including IDs and names/descriptions"),
    additional_context: Optional[str] = Form(""),
    batch_size: Optional[int] = Form(15),
    sheet_name: Optional[str] = Form(None),
):
    content = await file.read()
    try:
        txt_cols = list(dict.fromkeys(__import__("json").loads(text_columns))) if text_columns else []
    except Exception:
        txt_cols = []
    df = await map_capabilities(
        pain_filename=file.filename or "uploaded",
        pain_content=content,
        pain_id_column=id_column,
        pain_text_columns=txt_cols,
        capabilities_text=capabilities_text,
        additional_context=additional_context or "",
        batch_size=int(batch_size or 15),
        sheet_name=sheet_name,
    )
    return {"columns": list(map(str, df.columns)), "rows": df.to_dict(orient="records")}


@router.post("/pain-points/capabilities/map.xlsx")
async def pain_point_capability_map_xlsx(
    file: UploadFile = File(...),
    id_column: str = Form(...),
    text_columns: str = Form(...),
    capabilities_text: str = Form(...),
    additional_context: Optional[str] = Form(""),
    batch_size: Optional[int] = Form(15),
    sheet_name: Optional[str] = Form(None),
):
    content = await file.read()
    try:
        txt_cols = list(dict.fromkeys(__import__("json").loads(text_columns))) if text_columns else []
    except Exception:
        txt_cols = []
    df = await map_capabilities(
        pain_filename=file.filename or "uploaded",
        pain_content=content,
        pain_id_column=id_column,
        pain_text_columns=txt_cols,
        capabilities_text=capabilities_text,
        additional_context=additional_context or "",
        batch_size=int(batch_size or 15),
        sheet_name=sheet_name,
    )
    xbytes = caps_to_xlsx(df)
    return Response(content=xbytes, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=pain_point_capability_mapping.xlsx"})


# Impact Estimation
class ImpactResponse(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]


@router.post("/pain-points/impact/estimate", response_model=ImpactResponse)
async def pain_point_impact_estimate(
    file: UploadFile = File(...),
    id_column: str = Form(...),
    text_columns: str = Form(...),
    additional_context: Optional[str] = Form(""),
    batch_size: Optional[int] = Form(15),
    sheet_name: Optional[str] = Form(None),
):
    content = await file.read()
    try:
        txt_cols = list(dict.fromkeys(__import__("json").loads(text_columns))) if text_columns else []
    except Exception:
        txt_cols = []
    df = await estimate_impact(
        pain_filename=file.filename or "uploaded",
        pain_content=content,
        pain_id_column=id_column,
        pain_text_columns=txt_cols,
        additional_context=additional_context or "",
        batch_size=int(batch_size or 15),
        sheet_name=sheet_name,
    )
    return {"columns": list(map(str, df.columns)), "rows": df.to_dict(orient="records")}


@router.post("/pain-points/impact/estimate.xlsx")
async def pain_point_impact_estimate_xlsx(
    file: UploadFile = File(...),
    id_column: str = Form(...),
    text_columns: str = Form(...),
    additional_context: Optional[str] = Form(""),
    batch_size: Optional[int] = Form(15),
    sheet_name: Optional[str] = Form(None),
):
    content = await file.read()
    try:
        txt_cols = list(dict.fromkeys(__import__("json").loads(text_columns))) if text_columns else []
    except Exception:
        txt_cols = []
    df = await estimate_impact(
        pain_filename=file.filename or "uploaded",
        pain_content=content,
        pain_id_column=id_column,
        pain_text_columns=txt_cols,
        additional_context=additional_context or "",
        batch_size=int(batch_size or 15),
        sheet_name=sheet_name,
    )
    xbytes = impact_to_xlsx(df)
    return Response(content=xbytes, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=pain_point_impact_estimate.xlsx"})


@router.post("/pain-points/extract/file", response_model=PainPointExtractResponse)
async def extract_pain_points_file(
    file: UploadFile = File(...),
    selected_columns: str = Form(..., description="JSON array of column names"),
    additional_prompts: Optional[str] = Form(""),
    chunk_size: Optional[int] = Form(20),
    sheet_name: Optional[str] = Form(None),
):
    content = await file.read()
    try:
        cols = []
        if selected_columns:
            cols = list(dict.fromkeys(__import__("json").loads(selected_columns)))
    except Exception:
        return {"pain_points": []}
    points, _ = await extract_from_file(
        filename=file.filename or "uploaded",
        content=content,
        selected_columns=cols,
        additional_prompts=additional_prompts or "",
        chunk_size=int(chunk_size or 20),
        sheet_name=sheet_name,
    )
    return {"pain_points": points}
