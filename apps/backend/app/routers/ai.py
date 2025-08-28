from typing import Optional, Dict, Any, List
import os
import io
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, Response, HTTPException
from pydantic import BaseModel, Field
from ..services.pain_points import extract_from_file, extract_from_texts
from ..services.cleanup import build_proposals, apply_actions, export_report
from ..services.themes import map_themes_perspectives, PREDEFINED_THEMES, PREDEFINED_PERSPECTIVES
from ..services.capabilities import map_capabilities, dataframe_to_xlsx_bytes as caps_to_xlsx
from ..services.llm import llm, EFFECTIVE_TEMPERATURE
from ..services.impact import estimate_impact, dataframe_to_xlsx_bytes as impact_to_xlsx
from ..services.use_cases import (
    summarise_company_context,
    evaluate_use_cases as eval_use_cases_service,
    UseCaseInput,
    build_excel_bytes as use_cases_excel,
)
from ..services.brand_consistency import ingest_style_guide, ingest_deck, analyse_brand_consistency

router = APIRouter(prefix="/ai", tags=["AI"])


@router.get("/ping")
def ping():
    return {"message": "AI router alive"}


class LLMStatus(BaseModel):
    enabled: bool
    provider: str
    model: str
    temperature: float


@router.get("/llm/status", response_model=LLMStatus)
def llm_status():
    """Report whether an LLM is configured and which model is selected."""
    # Derive provider/model from env; enabled reflects runtime object availability.
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    temp = float(os.getenv("OPENAI_TEMPERATURE", "0.2") or 0.2)
    # Reflect effective temperature if model only supports default
    eff_temp = EFFECTIVE_TEMPERATURE if llm is not None else temp
    provider = "openai" if os.getenv("OPENAI_API_KEY") else "none"
    return {
        "enabled": llm is not None,
        "provider": provider,
        "model": model,
        "temperature": eff_temp,
    }


@router.get("/llm/health")
async def llm_health():
    """Attempt a tiny round-trip to the configured LLM, if enabled."""
    if llm is None:
        raise HTTPException(status_code=503, detail="LLM not configured")
    try:
        from langchain_core.messages import HumanMessage  # lazy import
        out = await __import__("asyncio").get_event_loop().run_in_executor(
            None, llm.invoke, [HumanMessage(content="Return exactly: OK")]
        )
        content = getattr(out, "content", "")
        ok = "OK" in content.strip()
        if not ok:
            raise RuntimeError("Unexpected LLM output")
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}")


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


# --------------------------- AI Use Case Customiser (Spec 7.3) ---------------------------

class CompanyContextSummariseRequest(BaseModel):
    context: str = Field(..., min_length=10)
    force: bool = False


class CompanyContextSummariseResponse(BaseModel):
    summary: str
    original_length: int
    summary_length: int
    summarised: bool
    cached: bool


@router.post("/use-cases/context/summarise", response_model=CompanyContextSummariseResponse)
async def use_case_context_summarise(payload: CompanyContextSummariseRequest):
    res = await summarise_company_context(payload.context, force=payload.force)
    return res


class UseCaseItem(BaseModel):
    id: str = Field(..., min_length=1)
    description: str = Field(..., min_length=5)


class UseCaseBatchEvaluateRequest(BaseModel):
    company_context: str = Field(..., min_length=30)
    use_cases: List[UseCaseItem]
    parallelism: int = Field(4, ge=1, le=20)


class UseCaseEvaluationOut(BaseModel):
    id: str
    description: str
    score: int = Field(..., ge=1, le=100)  # Update to 1-100 scale
    reasoning: str
    rank: int
    raw_response: Optional[str] = None


class UseCaseBatchEvaluateResponse(BaseModel):
    scale: str
    stats: Dict[str, Any]
    evaluated: List[UseCaseEvaluationOut]


@router.post("/use-cases/evaluate", response_model=UseCaseBatchEvaluateResponse)
async def use_cases_evaluate(payload: UseCaseBatchEvaluateRequest):
    # Deduplicate IDs but preserve order; warn if duplicates
    seen = set()
    filtered: List[UseCaseItem] = []
    for uc in payload.use_cases:
        if uc.id not in seen:
            filtered.append(uc)
            seen.add(uc.id)
    service_inputs = [UseCaseInput(id=uc.id, description=uc.description) for uc in filtered]
    result = await eval_use_cases_service(
        company_context=payload.company_context,
        use_cases=service_inputs,
        parallelism=payload.parallelism,
    )
    evaluated = [UseCaseEvaluationOut(**rec) for rec in result["evaluated"]]
    return {"scale": "1-100", "stats": result["stats"], "evaluated": evaluated}


class UseCaseBatchEvaluateExcelRequest(UseCaseBatchEvaluateRequest):
    pass


@router.post("/use-cases/evaluate.xlsx")
async def use_cases_evaluate_excel(payload: UseCaseBatchEvaluateExcelRequest):
    service_inputs = [UseCaseInput(id=uc.id, description=uc.description) for uc in payload.use_cases]
    result = await eval_use_cases_service(
        company_context=payload.company_context,
        use_cases=service_inputs,
        parallelism=payload.parallelism,
    )
    xbytes = use_cases_excel(result["evaluated"], result["stats"])
    return Response(
        content=xbytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=ai_use_case_evaluations.xlsx"},
    )


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
    with pd.ExcelWriter(bio, engine="xlsxwriter") as writer:
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


# ---------------------------------------------------------------------------
# Pain Point Cleanup & Normalisation

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
    if not request.raw_points:
        return {"proposal": [], "summary": {"total_raw": 0}}
    result = await build_proposals(request.raw_points, request.options.model_dump())
    return result


class CleanupApplyRequest(BaseModel):
    proposal: List[Dict[str, Any]]


class CleanupApplyResponse(BaseModel):
    clean_pain_points: List[Dict[str, Any]]
    count: int


@router.post("/pain-points/cleanup/apply", response_model=CleanupApplyResponse)
async def cleanup_apply(payload: CleanupApplyRequest):
    return apply_actions(payload.proposal)


class CleanupReportRequest(BaseModel):
    proposal: List[Dict[str, Any]]
    summary: Dict[str, Any]


@router.post("/pain-points/cleanup/report.xlsx")
async def cleanup_report(payload: CleanupReportRequest):
    data = export_report(payload.proposal, payload.summary)
    return Response(content=data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=cleanup_report.xlsx"})


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
    header_row_index: Optional[int] = Form(None, description="Zero-based index of the header row"),
):
    content = await file.read()
    try:
        cols = []
        if selected_columns:
            cols = list(dict.fromkeys(__import__("json").loads(selected_columns)))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid selected_columns: {e}")
    try:
        points, _ = await extract_from_file(
            filename=file.filename or "uploaded",
            content=content,
            selected_columns=cols,
            additional_prompts=additional_prompts or "",
            chunk_size=int(chunk_size or 20),
            sheet_name=sheet_name,
            header_row_index=header_row_index,
        )
        return {"pain_points": points}
    except ValueError as ve:
        # User error (e.g., missing columns) -> 400
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        # Unexpected error -> 500
        raise HTTPException(status_code=500, detail="Extraction failed")


# Capability Description Generator
class CapDescribeItem(BaseModel):
    id: str
    name: str
    summary: Optional[str] = ""


class CapDescribeRequest(BaseModel):
    items: List[CapDescribeItem]
    company_context: Optional[str] = ""


class CapDescribeOut(BaseModel):
    id: str
    name: str
    description: str


@router.post("/capabilities/describe", response_model=List[CapDescribeOut])
async def describe_capabilities(payload: CapDescribeRequest):
    items = payload.items or []
    if not items:
        return []
    # If LLM configured, attempt a single-shot prompt; otherwise return heuristic descriptions.
    if llm is not None:
        try:
            caps_text = "\n".join(f"- {it.id}: {it.name}{' — ' + it.summary if it.summary else ''}" for it in items)
            ctx = payload.company_context or ""
            prompt = (
                "You will receive a list of business capabilities (ID and name, with optional context).\n"
                "For each, output a concise, plain-English description (1-2 sentences) that explains purpose, scope, and value.\n"
                "Return them as lines in the form 'ID -> description' with no extra commentary.\n\n"
                f"Context: {ctx}\n\nCapabilities:\n{caps_text}"
            )
            out = llm.invoke([__import__("langchain_core.messages").langchain_core.messages.HumanMessage(content=prompt)])
            raw = getattr(out, "content", "") or ""
            mapping: Dict[str, str] = {}
            for line in raw.splitlines():
                s = line.strip()
                if not s or "->" not in s:
                    continue
                left, right = s.split("->", 1)
                mapping[left.strip()] = right.strip()
            results: List[CapDescribeOut] = []
            for it in items:
                desc = mapping.get(it.id) or mapping.get(it.name) or f"The {it.name} capability enables the organisation to {('' if not it.summary else it.summary.lower())} and deliver consistent outcomes."
                results.append(CapDescribeOut(id=it.id, name=it.name, description=desc))
            return results
        except Exception:
            # fall back to heuristic if anything fails
            pass
    # Heuristic fallback
    results: List[CapDescribeOut] = []
    for it in items:
        base = f"The {it.name} capability enables the organisation to operate, improve, and govern related activities."
        if it.summary:
            base = f"The {it.name} capability enables the organisation to {it.summary.strip().rstrip('.').lower()}."
        results.append(CapDescribeOut(id=it.id, name=it.name, description=base))
    return results


# ---------------------------------------------------------------------------
# Applications Toolkit


class AppItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""


class CapItem(BaseModel):
    id: str
    name: str


class AppCapMapRequest(BaseModel):
    applications: List[AppItem]
    capabilities: List[CapItem]
    context: str = ""
    batch_size: int = 10


class AppCapMapResult(BaseModel):
    application_id: str
    application_name: str
    capability_ids: List[str]
    raw_response: str = ""


class AppCapMapResponse(BaseModel):
    results: List[AppCapMapResult]
    summary: dict


@router.post("/applications/capabilities/map", response_model=AppCapMapResponse)
async def map_applications_to_capabilities(payload: AppCapMapRequest):
    """Map applications to capabilities using AI analysis"""
    apps = payload.applications or []
    caps = payload.capabilities or []
    context = payload.context.strip() if payload.context else ""
    batch_size = min(max(payload.batch_size, 1), 50)  # Clamp between 1-50
    
    if not apps or not caps:
        return AppCapMapResponse(results=[], summary={"total_mappings": 0, "applications_processed": 0, "capabilities_matched": 0, "no_mappings": 0})
    
    # Build capabilities text
    capabilities_text = ""
    for cap in caps:
        capabilities_text += f"{cap.id}: {cap.name}\n"
    
    # Build context section
    context_section = ""
    if context:
        context_section = f"\nAdditional Context:\n{context}\n"
    
    # Build prompt header
    prompt_header = f"""You are an enterprise architect mapping software applications to a business-capability model.

**How to reason (think silently, do not show your thinking):**
1. Read each application's description carefully.
2. Scan the full name *and* the detailed prose for functional verbs, nouns, and domain cues.
3. Compare those cues to both the capability titles and their detailed descriptions.
4. Look for synonyms and near-synonyms (e.g., "CRM" → "Customer Relationship Management").
5. Only count a capability when the application directly delivers, automates, or materially
   supports that business function. Ignore incidental or indirect links.

**Output rules (show only these in your answer):**
• Return just the Capability IDs, separated by commas, for each application.  
• Preserve the exact application name/ID followed by a colon before the IDs.  
• If no clear capability match exists, output `NONE`.  
• Provide no explanations, qualifiers, or extra text.

{context_section}

Available Capabilities:
{capabilities_text}

Applications to map:
"""

    results = []
    
    # Process in batches
    for i in range(0, len(apps), batch_size):
        batch_apps = apps[i:i + batch_size]
        
        # Build batch text
        batch_text = ""
        for app in batch_apps:
            batch_text += f"{app.id}: {app.name} - {app.description or ''}\n"
        
        # Get AI response
        try:
            if llm:
                from langchain_core.messages import HumanMessage
                response = llm.invoke([HumanMessage(content=prompt_header + batch_text)])
                ai_response = getattr(response, 'content', '') or ''
            else:
                # Heuristic fallback
                ai_response = ""
                for app in batch_apps:
                    desc_lower = (app.description or "").lower()
                    matched_caps = [cap.id for cap in caps if cap.name.lower() in desc_lower]
                    if matched_caps:
                        ai_response += f"{app.id}: {', '.join(matched_caps[:3])}\n"
                    else:
                        ai_response += f"{app.id}: NONE\n"
        
        except Exception as e:
            # Fallback to heuristic
            ai_response = ""
            for app in batch_apps:
                ai_response += f"{app.id}: NONE\n"
        
        # Parse response
        response_lines = ai_response.strip().split('\n')
        
        for j, app in enumerate(batch_apps):
            capability_ids = []
            raw_response = ""
            
            if j < len(response_lines):
                line = response_lines[j].strip()
                raw_response = line
                
                if ':' in line:
                    _, cap_part = line.split(':', 1)
                    cap_part = cap_part.strip()
                    
                    if cap_part.upper() != 'NONE' and cap_part:
                        capability_ids = [cap.strip() for cap in cap_part.split(',') if cap.strip()]
            
            results.append(AppCapMapResult(
                application_id=app.id,
                application_name=app.name,
                capability_ids=capability_ids,
                raw_response=raw_response
            ))
    
    # Calculate summary
    total_mappings = sum(len(r.capability_ids) for r in results)
    apps_processed = len(results)
    unique_caps = len(set(cap_id for r in results for cap_id in r.capability_ids))
    no_mappings = len([r for r in results if not r.capability_ids])
    
    summary = {
        "total_mappings": total_mappings,
        "applications_processed": apps_processed,
        "capabilities_matched": unique_caps,
        "no_mappings": no_mappings
    }
    
    return AppCapMapResponse(results=results, summary=summary)


@router.post("/applications/capabilities/map.xlsx")
async def map_applications_to_capabilities_xlsx(payload: AppCapMapRequest):
    """Export application-capability mapping results as Excel file"""
    response = await map_applications_to_capabilities(payload)
    
    # Create DataFrames for export
    mapping_data = []
    for result in response.results:
        if result.capability_ids:
            for cap_id in result.capability_ids:
                mapping_data.append({
                    "Application ID": result.application_id,
                    "Application Name": result.application_name,
                    "Capability ID": cap_id,
                    "Raw Response": result.raw_response
                })
        else:
            mapping_data.append({
                "Application ID": result.application_id,
                "Application Name": result.application_name,
                "Capability ID": "No mapping found",
                "Raw Response": result.raw_response
            })
    
    mapping_df = pd.DataFrame(mapping_data)
    
    # Summary data
    summary_data = {
        "Metric": ["Total Mappings", "Applications Processed", "Capabilities Matched", "No Mappings Found"],
        "Count": [
            response.summary["total_mappings"],
            response.summary["applications_processed"], 
            response.summary["capabilities_matched"],
            response.summary["no_mappings"]
        ]
    }
    summary_df = pd.DataFrame(summary_data)
    
    # Applications overview
    app_counts = mapping_df.groupby(["Application ID", "Application Name"]).size().reset_index(name="Mapping Count")
    
    # Generate Excel file
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        mapping_df.to_excel(writer, sheet_name='Application Mappings', index=False)
        summary_df.to_excel(writer, sheet_name='Summary', index=False)
        app_counts.to_excel(writer, sheet_name='Applications Overview', index=False)
    
    xbytes = output.getvalue()
    return Response(
        content=xbytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=application_capability_mapping.xlsx"}
    )


@router.post("/applications/capabilities/map-files")
async def map_applications_to_capabilities_files(
    applications_file: UploadFile = File(...),
    applications_sheet: str = Form(""),
    applications_id_column: str = Form(...),
    applications_text_columns: str = Form(...),
    capabilities_file: UploadFile = File(...),
    capabilities_sheet: str = Form(""),
    capabilities_id_column: str = Form(...),
    capabilities_text_columns: str = Form(...),
    additional_context: str = Form(""),
    batch_size: int = Form(10),
):
    """Map applications to capabilities using uploaded Excel files"""
    import json
    import pandas as pd
    from io import BytesIO
    
    try:
        # Parse text columns
        app_text_cols = json.loads(applications_text_columns)
        cap_text_cols = json.loads(capabilities_text_columns)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON in text_columns: {e}")
    
    try:
        # Read applications file
        app_content = await applications_file.read()
        app_sheet_name = applications_sheet if applications_sheet else 0
        app_df = pd.read_excel(BytesIO(app_content), sheet_name=app_sheet_name)
        
        # Read capabilities file
        cap_content = await capabilities_file.read()
        cap_sheet_name = capabilities_sheet if capabilities_sheet else 0
        cap_df = pd.read_excel(BytesIO(cap_content), sheet_name=cap_sheet_name)
        
        # Validate columns exist
        if applications_id_column not in app_df.columns:
            raise HTTPException(status_code=400, detail=f"ID column '{applications_id_column}' not found in applications file")
        
        if capabilities_id_column not in cap_df.columns:
            raise HTTPException(status_code=400, detail=f"ID column '{capabilities_id_column}' not found in capabilities file")
        
        for col in app_text_cols:
            if col not in app_df.columns:
                raise HTTPException(status_code=400, detail=f"Text column '{col}' not found in applications file")
        
        for col in cap_text_cols:
            if col not in cap_df.columns:
                raise HTTPException(status_code=400, detail=f"Text column '{col}' not found in capabilities file")
        
        # Transform to expected format
        applications = []
        for _, row in app_df.iterrows():
            app_id = str(row[applications_id_column])
            
            # Combine text from multiple columns
            text_parts = []
            for col in app_text_cols:
                val = row[col]
                if pd.notna(val):
                    text_parts.append(str(val))
            
            combined_text = " | ".join(text_parts)
            
            applications.append({
                "id": app_id,
                "name": combined_text[:100] + "..." if len(combined_text) > 100 else combined_text,
                "description": combined_text
            })
        
        capabilities = []
        for _, row in cap_df.iterrows():
            cap_id = str(row[capabilities_id_column])
            
            # Combine text from multiple columns
            text_parts = []
            for col in cap_text_cols:
                val = row[col]
                if pd.notna(val):
                    text_parts.append(str(val))
            
            combined_text = " | ".join(text_parts)
            
            capabilities.append({
                "id": cap_id,
                "name": combined_text[:100] + "..." if len(combined_text) > 100 else combined_text,
                "description": combined_text
            })
        
        # Call the existing mapping function
        payload = AppCapMapRequest(
            applications=applications,
            capabilities=capabilities,
            context=additional_context,
            batch_size=batch_size
        )
        
        return await map_applications_to_capabilities(payload)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File processing error: {str(e)}")


@router.post("/applications/capabilities/map-files.xlsx")
async def map_applications_to_capabilities_files_xlsx(
    applications_file: UploadFile = File(...),
    applications_sheet: str = Form(""),
    applications_id_column: str = Form(...),
    applications_text_columns: str = Form(...),
    capabilities_file: UploadFile = File(...),
    capabilities_sheet: str = Form(""),
    capabilities_id_column: str = Form(...),
    capabilities_text_columns: str = Form(...),
    additional_context: str = Form(""),
    batch_size: int = Form(10),
):
    """Export application-capability mapping results as Excel file using uploaded files"""
    import json
    import pandas as pd
    from io import BytesIO
    
    try:
        # Parse text columns
        app_text_cols = json.loads(applications_text_columns)
        cap_text_cols = json.loads(capabilities_text_columns)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON in text_columns: {e}")
    
    try:
        # Read applications file
        app_content = await applications_file.read()
        app_sheet_name = applications_sheet if applications_sheet else 0
        app_df = pd.read_excel(BytesIO(app_content), sheet_name=app_sheet_name)
        
        # Read capabilities file
        cap_content = await capabilities_file.read()
        cap_sheet_name = capabilities_sheet if capabilities_sheet else 0
        cap_df = pd.read_excel(BytesIO(cap_content), sheet_name=cap_sheet_name)
        
        # Validate columns exist
        if applications_id_column not in app_df.columns:
            raise HTTPException(status_code=400, detail=f"ID column '{applications_id_column}' not found in applications file")
        
        if capabilities_id_column not in cap_df.columns:
            raise HTTPException(status_code=400, detail=f"ID column '{capabilities_id_column}' not found in capabilities file")
        
        for col in app_text_cols:
            if col not in app_df.columns:
                raise HTTPException(status_code=400, detail=f"Text column '{col}' not found in applications file")
        
        for col in cap_text_cols:
            if col not in cap_df.columns:
                raise HTTPException(status_code=400, detail=f"Text column '{col}' not found in capabilities file")
        
        # Transform to expected format
        applications = []
        for _, row in app_df.iterrows():
            app_id = str(row[applications_id_column])
            
            # Combine text from multiple columns
            text_parts = []
            for col in app_text_cols:
                val = row[col]
                if pd.notna(val):
                    text_parts.append(str(val))
            
            combined_text = " | ".join(text_parts)
            
            applications.append({
                "id": app_id,
                "name": combined_text[:100] + "..." if len(combined_text) > 100 else combined_text,
                "description": combined_text
            })
        
        capabilities = []
        for _, row in cap_df.iterrows():
            cap_id = str(row[capabilities_id_column])
            
            # Combine text from multiple columns
            text_parts = []
            for col in cap_text_cols:
                val = row[col]
                if pd.notna(val):
                    text_parts.append(str(val))
            
            combined_text = " | ".join(text_parts)
            
            capabilities.append({
                "id": cap_id,
                "name": combined_text[:100] + "..." if len(combined_text) > 100 else combined_text,
                "description": combined_text
            })
        
        # Call the existing Excel export function
        payload = AppCapMapRequest(
            applications=applications,
            capabilities=capabilities,
            context=additional_context,
            batch_size=batch_size
        )
        
        return await map_applications_to_capabilities_xlsx(payload)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File processing error: {str(e)}")


class LogicalAppModelRequest(BaseModel):
    applications: List[AppItem]


class LogicalAppModelResponse(BaseModel):
    model: List[str]


@router.post("/applications/logical-model", response_model=LogicalAppModelResponse)
async def logical_application_model(payload: LogicalAppModelRequest):
    apps = payload.applications or []
    model: List[str] = []
    for i, app in enumerate(apps):
        nxt = apps[(i + 1) % len(apps)].name if apps else ""
        model.append(f"{app.name} interacts with {nxt}")
    return {"model": model}


class IndividualAppMapRequest(BaseModel):
    application_name: str
    application_id: Optional[str] = ""
    application_description: str
    additional_context: Optional[str] = ""
    capabilities: List[CapItem]


class IndividualAppMapResponse(BaseModel):
    analysis: str
    application_summary: dict
    raw_response: str


@router.post("/applications/map", response_model=IndividualAppMapResponse)
async def individual_application_map(payload: IndividualAppMapRequest):
    """Generate AI-powered capability mapping for individual application with confidence tiers"""
    
    # Prepare capabilities list for AI
    capabilities_list = []
    for cap in payload.capabilities:
        capabilities_list.append(f"- {cap.id}: {cap.name}")
    
    capabilities_text = "\n".join(capabilities_list)
    
    # Create application info
    app_display_id = f" (ID: {payload.application_id})" if payload.application_id.strip() else ""
    app_info = f"Application: {payload.application_name}{app_display_id}\nDescription: {payload.application_description}"
    
    # Build context section
    context_section = f"Additional Context: {payload.additional_context}\n\n" if payload.additional_context.strip() else ""
    
    # Create AI prompt using spec template
    prompt = f"""You are an expert enterprise architect specialising in capability mapping and application portfolio management.

Your task: Analyse the application and identify which capabilities from the provided framework are most relevant.

{context_section}Application to Analyse:
{app_info}

Available Capabilities:
{capabilities_text}

Instructions:
1. Analyse the application's functions, purpose, and characteristics
2. Identify which capabilities from the framework are most relevant to this application
3. Consider both direct functional alignment and supporting capabilities
4. An application can map to multiple capabilities (0 to many)
5. Provide a confidence level for each mapping (High, Medium, Low)
6. Return your response in this exact format:

**Primary Capabilities** (High Confidence):
- CAPABILITY_ID: Brief explanation of relevance

**Secondary Capabilities** (Medium Confidence):
- CAPABILITY_ID: Brief explanation of relevance

**Potential Capabilities** (Low Confidence):
- CAPABILITY_ID: Brief explanation of relevance

If no capabilities are relevant, respond with:
**No Direct Capability Mappings Found**

Analysis:"""

    try:
        # Call AI model
        from langchain_core.messages import HumanMessage
        
        if not llm:
            raise HTTPException(status_code=503, detail="LLM service not available")
        
        message = HumanMessage(content=prompt)
        response = llm.invoke([message])
        ai_response = response.content.strip()
        
        # Prepare application summary
        app_summary = {
            "name": payload.application_name,
            "id": payload.application_id,
            "description": payload.application_description,
            "total_capabilities": len(payload.capabilities),
            "context_provided": bool(payload.additional_context.strip())
        }
        
        return IndividualAppMapResponse(
            analysis=ai_response,
            application_summary=app_summary,
            raw_response=ai_response
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating capability mapping: {str(e)}")


@router.post("/applications/map-file")
async def individual_application_map_file(
    capabilities_file: UploadFile = File(...),
    capabilities_sheet: str = Form(""),
    capabilities_id_column: str = Form(...),
    capabilities_text_columns: str = Form(...),
    application_name: str = Form(...),
    application_id: str = Form(""),
    application_description: str = Form(...),
    additional_context: str = Form(""),
):
    """Individual application mapping using uploaded capabilities file"""
    import json
    import pandas as pd
    from io import BytesIO
    
    try:
        # Parse text columns
        cap_text_cols = json.loads(capabilities_text_columns)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON in text_columns: {e}")
    
    try:
        # Read capabilities file
        cap_content = await capabilities_file.read()
        cap_sheet_name = capabilities_sheet if capabilities_sheet else 0
        cap_df = pd.read_excel(BytesIO(cap_content), sheet_name=cap_sheet_name)
        
        # Validate columns exist
        if capabilities_id_column not in cap_df.columns:
            raise HTTPException(status_code=400, detail=f"ID column '{capabilities_id_column}' not found in capabilities file")
        
        for col in cap_text_cols:
            if col not in cap_df.columns:
                raise HTTPException(status_code=400, detail=f"Text column '{col}' not found in capabilities file")
        
        # Transform to expected format
        capabilities = []
        for _, row in cap_df.iterrows():
            cap_id = str(row[capabilities_id_column])
            
            # Combine text from multiple columns
            text_parts = []
            for col in cap_text_cols:
                val = row[col]
                if pd.notna(val):
                    text_parts.append(str(val))
            
            combined_text = " | ".join(text_parts)
            
            capabilities.append({
                "id": cap_id,
                "name": combined_text
            })
        
        # Call the existing mapping function
        payload = IndividualAppMapRequest(
            application_name=application_name,
            application_id=application_id,
            application_description=application_description,
            additional_context=additional_context,
            capabilities=[CapItem(**cap) for cap in capabilities]
        )
        
        return await individual_application_map(payload)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File processing error: {str(e)}")


# ---------------------------------------------------------------------------
# Physical → Logical Application Mapping (MECE)

class PhysicalAppItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""


class LogicalAppItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""


class PhysicalLogicalMapRequest(BaseModel):
    physical_apps: List[PhysicalAppItem]
    logical_apps: List[LogicalAppItem]
    context: Optional[str] = ""
    # Optional concurrency hint (used by LLM variant)
    max_concurrency: Optional[int] = 4  # Caller may request up to 100


class PhysicalLogicalMapRecord(BaseModel):
    physical_id: str
    physical_name: str
    logical_id: str
    logical_name: str
    similarity: float
    rationale: str
    uncertainty: bool
    # Debug / transparency fields
    model_logical_id: Optional[str] = None  # Raw ID emitted by model (before any adjustment)
    auto_substituted: bool = False          # True if we had to replace a missing/invalid model id
    mismatch_reason: Optional[str] = None   # Description of why substitution or mismatch occurred


class PhysicalLogicalMapResponse(BaseModel):
    mappings: List[PhysicalLogicalMapRecord]
    summary: Dict[str, Any]


def _pl_similarity(a: str, b: str) -> float:
    import difflib
    return difflib.SequenceMatcher(a=a.lower(), b=b.lower()).ratio()

def _norm_id(raw: str) -> str:
    """Normalize logical IDs for matching: case-insensitive, trim, collapse underscores, remove zero padding in numeric suffix after a hyphen.
    Examples: 'la-02' -> 'la-2', ' LA_002 ' -> 'la-2'."""
    if not raw:
        return ""
    s = raw.strip().replace('_', '-').lower()
    import re
    m = re.match(r'^([a-z]+-)(0*)(\d+)$', s)
    if m:
        prefix, zeros, num = m.groups()
        # remove leading zeros but keep at least one digit
        num = str(int(num))  # int() removes leading zeros
        return prefix + num
    return s


@router.delete("/applications/physical-logical/heuristic")
async def remove_heuristic_notice():
    """Legacy endpoint placeholder: heuristic mapping removed in favour of LLM-only approach."""
    raise HTTPException(status_code=410, detail="Heuristic mapping removed. Use LLM endpoints.")


@router.post("/applications/physical-logical/map-llm", response_model=PhysicalLogicalMapResponse)
async def physical_logical_map_llm(payload: PhysicalLogicalMapRequest):
    """LLM-backed mapping: one model invocation per physical app (rich rationale).
    Requires LLM configuration; no heuristic fallback.
    """
    if llm is None:
        raise HTTPException(status_code=503, detail="LLM not configured for mapping")
    phys = payload.physical_apps or []
    logical = payload.logical_apps or []
    if not phys or not logical:
        return {"mappings": [], "summary": {"physical": len(phys), "logical": len(logical), "mapped": 0, "uncertain": 0, "mece_physical_coverage": len(phys)==0}}
    import json, concurrent.futures
    # Pre-build logical catalogue text
    logical_catalogue = "\n".join(f"- {l.id}: {l.name} { (l.description or '').strip() }".strip() for l in logical)
    # Normalized lookup map - but also keep exact case mapping
    logical_by_norm: Dict[str, LogicalAppItem] = {}
    logical_by_exact: Dict[str, LogicalAppItem] = {}
    for l in logical:
        logical_by_exact[l.id] = l
        norm_key = _norm_id(l.id)
        logical_by_norm[norm_key] = l
    # Helper to call LLM for a single physical app
    from langchain_core.messages import HumanMessage

    def _call(p: PhysicalAppItem):
        """Call LLM with up to 2 attempts enforcing rationale/id alignment."""
        import re
        p_text = f"{p.name} {(p.description or '').strip()}".strip()
        def _base_prompt(issue: str = ""):
            allowed_ids = ", ".join(l.id for l in logical)
            parts = [
                'You are an expert enterprise architect performing a one-to-one mapping from a PHYSICAL application to exactly ONE LOGICAL application.\n',
                'Choose exactly one logical_id from the provided catalogue (no new IDs). If none fit well, still pick the closest and set uncertainty true.\n',
                'Output STRICT JSON ONLY (no markdown): {"logical_id":"<ID from catalogue>", "rationale":"<one concise sentence referencing ONLY that ID>", "uncertainty": true|false}.\n',
                'Rules: rationale must mention only the chosen logical_id (no other IDs), be <= 220 characters, and briefly justify fit.\n',
            ]
            if issue:
                parts.append(f"Issue to correct: {issue}\n")
            parts.extend([
                f"Allowed logical_ids: [{allowed_ids}]\n",
                f"Context: {(payload.context or '').strip()}\n\n",
                f"Logical Applications Catalogue (ID: Name Description):\n{logical_catalogue}\n\n",
                f"Physical Application: {p.id}: {p_text}\n",
                "JSON:",
            ])
            return "".join(parts)
        attempts = 0; max_attempts = 2; last_issue = ""
        record: Optional[PhysicalLogicalMapRecord] = None
        import json as _json
        while attempts < max_attempts:
            attempts += 1
            prompt = _base_prompt(last_issue)
            out = llm.invoke([HumanMessage(content=prompt)])
            raw = getattr(out, 'content', '') or ''
            s = raw; st = s.find('{'); en = s.rfind('}')
            if st != -1 and en != -1 and en > st:
                s = s[st:en+1]
            try:
                data = _json.loads(s)
            except Exception:
                last_issue = 'Unparseable JSON output'
                continue
            logical_id = str(data.get('logical_id') or '').strip()
            uncertainty = bool(data.get('uncertainty'))
            rationale = str(data.get('rationale') or '').strip() or 'Model supplied no rationale.'
            # Try exact match first, then normalized lookup
            target = logical_by_exact.get(logical_id)
            if target is None and logical_id:
                # Try normalized lookup (case / zero padding differences)
                norm_id = _norm_id(logical_id)
                target = logical_by_norm.get(norm_id)
            mentioned_ids = set(re.findall(r'\b[A-Z]{2,}-\d+\b', rationale))
            mismatch = False; issues = []
            if target is None:
                mismatch = True; issues.append(f'id {logical_id or "<empty>"} not found')
            if not logical_id:
                mismatch = True; issues.append('missing logical_id')
            if mentioned_ids and (len(mentioned_ids) > 1 or (target and target.id not in mentioned_ids)):
                mismatch = True; issues.append(f'rationale IDs {sorted(mentioned_ids)} misaligned')
            if mismatch and attempts < max_attempts:
                last_issue = "; ".join(issues)
                continue
            model_raw_id = logical_id
            mismatch_reason: Optional[str] = None
            auto_sub = False
            if target is None:
                # substitute closest because model id missing / not in catalogue
                best = None; best_sim = -1.0
                for l in logical:
                    sim = _pl_similarity(logical_id or p.id, l.id)
                    if sim > best_sim:
                        best_sim = sim; best = l
                target = best or logical[0]
                mismatch_reason = f"model id {logical_id or '<empty>'} not found; substituted {target.id}"
                rationale += f' (Adjusted: substituted closest {target.id} for {logical_id or "<empty>"})'
                auto_sub = True
                uncertainty = True
            elif mismatch:
                mismatch_reason = 'rationale/id alignment issues'
                rationale += f' (Auto-corrected after retries: mapped to {target.id})'
                uncertainty = True
            sim_score = _pl_similarity(p_text, f"{target.name} {(target.description or '')}".strip())
            record = PhysicalLogicalMapRecord(
                physical_id=p.id,
                physical_name=p.name,
                logical_id=target.id,
                logical_name=target.name,
                similarity=round(sim_score, 3),
                rationale=rationale,
                uncertainty=uncertainty,
                model_logical_id=model_raw_id or None,
                auto_substituted=auto_sub,
                mismatch_reason=mismatch_reason,
            )
            break
        if record is None:
            # ultimate fallback
            target = logical[0]
            sim_score = _pl_similarity(p_text, f"{target.name} {(target.description or '')}".strip())
            record = PhysicalLogicalMapRecord(
                physical_id=p.id,
                physical_name=p.name,
                logical_id=target.id,
                logical_name=target.name,
                similarity=round(sim_score, 3),
                rationale=f"Retries exhausted; fallback to {target.id}",
                uncertainty=True,
                model_logical_id=None,
                auto_substituted=True,
                mismatch_reason='retries_exhausted_fallback',
            )
        return record

    # Execute calls (limit parallelism to avoid rate spikes)
    # Determine concurrency respecting request hint but cap for safety.
    hint = payload.max_concurrency or 4
    max_workers = min(100, max(1, min(hint, len(phys))))
    results: List[PhysicalLogicalMapRecord] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = [ex.submit(_call, p) for p in phys]
        for fut in concurrent.futures.as_completed(futures):
            rec = fut.result()
            if rec:
                results.append(rec)
    # Preserve original order by physical id sequence
    order = {p.id: i for i, p in enumerate(phys)}
    results.sort(key=lambda r: order.get(r.physical_id, 1_000_000))
    uncertain = sum(1 for m in results if m.uncertainty)
    auto_subs = sum(1 for m in results if getattr(m, 'auto_substituted', False))
    summary = {
        "physical": len(phys),
        "logical": len(logical),
        "mapped": len(results),
        "uncertain": uncertain,
        "mece_physical_coverage": len(results) == len(phys),
        "mode": "llm",
        "auto_substitutions": auto_subs,
    }
    return {"mappings": results, "summary": summary}


@router.post("/applications/physical-logical/map.xlsx")
async def physical_logical_map_xlsx(payload: PhysicalLogicalMapRequest):
    # Heuristic route removed; reject if invoked
    raise HTTPException(status_code=410, detail="Heuristic mapping removed. Use /applications/physical-logical/map-llm.xlsx")
    df = pd.DataFrame([m.model_dump() for m in resp["mappings"]]) if resp["mappings"] else pd.DataFrame(columns=[
        "physical_id", "physical_name", "logical_id", "logical_name", "similarity", "rationale", "uncertainty"
    ])
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name="Mappings")
        pd.DataFrame([resp["summary"]]).to_excel(writer, index=False, sheet_name="Summary")
    return Response(content=bio.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=physical_logical_mapping.xlsx"})


@router.post("/applications/physical-logical/map-from-files", response_model=PhysicalLogicalMapResponse)
async def physical_logical_map_from_files(
    physical_file: UploadFile = File(...),
    physical_id_column: str = Form(...),
    physical_text_columns: str = Form(..., description="JSON array of text columns for physical apps"),
    logical_file: UploadFile = File(...),
    logical_id_column: str = Form(...),
    logical_text_columns: str = Form(..., description="JSON array of text columns for logical apps"),
    additional_context: Optional[str] = Form(""),
    uncertainty_threshold: Optional[float] = Form(0.22),
    physical_sheet: Optional[str] = Form(None),
    logical_sheet: Optional[str] = Form(None),
    physical_header_row_index: Optional[int] = Form(None),
    logical_header_row_index: Optional[int] = Form(None),
):
    import pandas as _pd, json as _json, io as _io
    from ..services.pain_points import _read_dataframe_from_upload as _read_df
    phys_bytes = await physical_file.read()
    log_bytes = await logical_file.read()
    try:
        phys_txt_cols = list(dict.fromkeys(_json.loads(physical_text_columns))) if physical_text_columns else []
        log_txt_cols = list(dict.fromkeys(_json.loads(logical_text_columns))) if logical_text_columns else []
    except Exception:
        phys_txt_cols, log_txt_cols = [], []
    phys_df = _read_df(physical_file.filename or "physical", phys_bytes, physical_sheet, physical_header_row_index)
    log_df = _read_df(logical_file.filename or "logical", log_bytes, logical_sheet, logical_header_row_index)
    for col in [physical_id_column] + phys_txt_cols:
        if col not in phys_df.columns:
            raise HTTPException(status_code=400, detail=f"Physical column not found: {col}")
    for col in [logical_id_column] + log_txt_cols:
        if col not in log_df.columns:
            raise HTTPException(status_code=400, detail=f"Logical column not found: {col}")
    phys_records: List[PhysicalAppItem] = []
    log_records: List[LogicalAppItem] = []
    def _concat(df, cols):
        if not cols: return [""] * len(df)
        return df[cols].astype(str).agg(" ".join, axis=1).tolist()
    for pid, desc in zip(phys_df[physical_id_column].astype(str).tolist(), _concat(phys_df, phys_txt_cols)):
        phys_records.append(PhysicalAppItem(id=pid, name=pid, description=desc))
    for lid, desc in zip(log_df[logical_id_column].astype(str).tolist(), _concat(log_df, log_txt_cols)):
        log_records.append(LogicalAppItem(id=lid, name=lid, description=desc))
    # Heuristic path removed; direct users to LLM endpoints
    raise HTTPException(status_code=410, detail="Heuristic mapping removed. Use LLM endpoints.")


@router.post("/applications/physical-logical/map-from-files-llm", response_model=PhysicalLogicalMapResponse)
async def physical_logical_map_from_files_llm(
    physical_file: UploadFile = File(...),
    physical_id_column: str = Form(...),
    physical_text_columns: str = Form(...),
    logical_file: UploadFile = File(...),
    logical_id_column: str = Form(...),
    logical_text_columns: str = Form(...),
    additional_context: Optional[str] = Form(""),
    physical_sheet: Optional[str] = Form(None),
    logical_sheet: Optional[str] = Form(None),
    physical_header_row_index: Optional[int] = Form(None),
    logical_header_row_index: Optional[int] = Form(None),
    max_concurrency: Optional[int] = Form(4),
):
    # Reuse file ingestion then delegate to LLM mapping endpoint
    import json as _json
    from ..services.pain_points import _read_dataframe_from_upload as _read_df
    phys_bytes = await physical_file.read(); log_bytes = await logical_file.read()
    try:
        phys_txt_cols = list(dict.fromkeys(_json.loads(physical_text_columns))) if physical_text_columns else []
        log_txt_cols = list(dict.fromkeys(_json.loads(logical_text_columns))) if logical_text_columns else []
    except Exception:
        phys_txt_cols, log_txt_cols = [], []
    phys_df = _read_df(physical_file.filename or "physical", phys_bytes, physical_sheet, physical_header_row_index)
    log_df = _read_df(logical_file.filename or "logical", log_bytes, logical_sheet, logical_header_row_index)
    for col in [physical_id_column] + phys_txt_cols:
        if col not in phys_df.columns:
            raise HTTPException(status_code=400, detail=f"Physical column not found: {col}")
    for col in [logical_id_column] + log_txt_cols:
        if col not in log_df.columns:
            raise HTTPException(status_code=400, detail=f"Logical column not found: {col}")
    def _concat(df, cols):
        if not cols: return [""] * len(df)
        return df[cols].astype(str).agg(" ".join, axis=1).tolist()
    phys_records = [PhysicalAppItem(id=str(pid), name=str(pid), description=desc) for pid, desc in zip(phys_df[physical_id_column].astype(str).tolist(), _concat(phys_df, phys_txt_cols))]
    log_records = [LogicalAppItem(id=str(lid), name=str(lid), description=desc) for lid, desc in zip(log_df[logical_id_column].astype(str).tolist(), _concat(log_df, log_txt_cols))]
    return await physical_logical_map_llm(PhysicalLogicalMapRequest(physical_apps=phys_records, logical_apps=log_records, context=additional_context or "", max_concurrency=max_concurrency))


@router.post("/applications/physical-logical/map-from-files-llm-stream")
async def physical_logical_map_from_files_llm_stream(
    physical_file: UploadFile = File(...),
    physical_id_column: str = Form(...),
    physical_text_columns: str = Form(...),
    logical_file: UploadFile = File(...),
    logical_id_column: str = Form(...),
    logical_text_columns: str = Form(...),
    additional_context: Optional[str] = Form(""),
    physical_sheet: Optional[str] = Form(None),
    logical_sheet: Optional[str] = Form(None),
    physical_header_row_index: Optional[int] = Form(None),
    logical_header_row_index: Optional[int] = Form(None),
    max_concurrency: Optional[int] = Form(4),
):
    """Streaming (SSE-style) variant of LLM mapping: emits progress events per physical app.
    Each event line is formatted as 'data: {json}\n\n'. Final event has type=complete.
    """
    from ..services.pain_points import _read_dataframe_from_upload as _read_df
    import json as _json, concurrent.futures
    from fastapi.responses import StreamingResponse
    from langchain_core.messages import HumanMessage

    phys_bytes = await physical_file.read(); log_bytes = await logical_file.read()
    try:
        phys_txt_cols = list(dict.fromkeys(_json.loads(physical_text_columns))) if physical_text_columns else []
        log_txt_cols = list(dict.fromkeys(_json.loads(logical_text_columns))) if logical_text_columns else []
    except Exception:
        phys_txt_cols, log_txt_cols = [], []
    phys_df = _read_df(physical_file.filename or "physical", phys_bytes, physical_sheet, physical_header_row_index)
    log_df = _read_df(logical_file.filename or "logical", log_bytes, logical_sheet, logical_header_row_index)
    for col in [physical_id_column] + phys_txt_cols:
        if col not in phys_df.columns:
            raise HTTPException(status_code=400, detail=f"Physical column not found: {col}")
    for col in [logical_id_column] + log_txt_cols:
        if col not in log_df.columns:
            raise HTTPException(status_code=400, detail=f"Logical column not found: {col}")
    def _concat(df, cols):
        if not cols: return [""] * len(df)
        return df[cols].astype(str).agg(" ".join, axis=1).tolist()
    phys_records = [PhysicalAppItem(id=str(pid), name=str(pid), description=desc) for pid, desc in zip(phys_df[physical_id_column].astype(str).tolist(), _concat(phys_df, phys_txt_cols))]
    log_records = [LogicalAppItem(id=str(lid), name=str(lid), description=desc) for lid, desc in zip(log_df[logical_id_column].astype(str).tolist(), _concat(log_df, log_txt_cols))]

    # If no LLM configured, degrade to heuristic streaming (still per app but local)
    if llm is None:
        raise HTTPException(status_code=503, detail="LLM not configured for streaming mapping")
    use_llm = True
    logical_catalogue = "\n".join(f"- {l.id}: {l.name} {(l.description or '').strip()}".strip() for l in log_records)
    # Build both exact and normalized lookup maps
    logical_by_norm: Dict[str, LogicalAppItem] = {}
    logical_by_exact: Dict[str, LogicalAppItem] = {}
    for l in log_records:
        logical_by_exact[l.id] = l
        norm_key = _norm_id(l.id)
        logical_by_norm[norm_key] = l
    hint = max_concurrency or 4
    max_workers = min(100, max(1, min(hint, len(phys_records))))

    from time import time as _time
    start_time = _time()

    def _map_one(p: PhysicalAppItem):
        p_text = f"{p.name} {(p.description or '').strip()}".strip()
        if use_llm:
            logical_id = ''; uncertainty_flag = False; rationale = 'No response.'
            import re as _re
            attempts = 0; max_attempts = 2; last_issue = ''
            allowed_ids = ", ".join(l.id for l in log_records)
            base_parts = [
                'You are an expert enterprise architect performing a one-to-one mapping from a PHYSICAL application to exactly ONE LOGICAL application.\n',
                'Choose exactly one logical_id from the provided catalogue (no new IDs). If none fit well, still pick the closest and set uncertainty true.\n',
                'Output STRICT JSON ONLY: {"logical_id":"<ID from catalogue>", "rationale":"<one concise sentence referencing ONLY that ID>", "uncertainty": true|false}.\n',
                'Rules: rationale must mention only the chosen logical_id, be <= 220 characters, and briefly justify fit.\n',
                f"Allowed logical_ids: [{allowed_ids}]\n",
                "Context: ", (additional_context or ""), "\n\n",
                "Logical Applications Catalogue (ID: Name Description):\n", logical_catalogue, "\n\n",
                "Physical Application: ", p.id, ": ", p_text, "\n",
                "JSON:",
            ]
            base_prompt = "".join(base_parts)
            while attempts < max_attempts:
                attempts += 1
                effective_prompt = base_prompt if not last_issue else base_prompt + f"\nIssue to correct: {last_issue}\nRe-output strict JSON."
                try:
                    out = llm.invoke([HumanMessage(content=effective_prompt)])
                    raw = getattr(out, 'content', '') or ''
                    s = raw; st = s.find('{'); en = s.rfind('}')
                    if st != -1 and en != -1 and en > st:
                        s = s[st:en+1]
                    data = _json.loads(s)
                    logical_id = str(data.get('logical_id') or '').strip()
                    uncertainty_flag = bool(data.get('uncertainty'))
                    rationale = str(data.get('rationale') or '').strip() or 'Model supplied no rationale.'
                except Exception:
                    last_issue = 'Unparseable output'
                    continue
                mentioned_ids = set(_re.findall(r'\b[A-Z]{2,}-\d+\b', rationale))
                mismatch = False; issues = []
                if not logical_id:
                    mismatch = True; issues.append('missing logical_id')
                if mentioned_ids and (len(mentioned_ids) > 1 or (logical_id and logical_id not in mentioned_ids)):
                    mismatch = True; issues.append(f'rationale IDs {sorted(mentioned_ids)} misaligned')
                if mismatch and attempts < max_attempts:
                    last_issue = "; ".join(issues)
                    continue
                if mismatch:
                    uncertainty_flag = True
                    rationale += ' (Auto-corrected after retries)'
                break
        else:
            logical_id = ''
            uncertainty_flag = False
            rationale = 'Heuristic mapping (LLM not configured).'
        # Try exact match first, then fallback to similarity + normalized lookup
        target = logical_by_exact.get(logical_id) if logical_id else None
        best_sim = -1.0; original_id = logical_id
        
        if target is None:
            # No exact match, try normalized lookup
            if logical_id:
                norm = _norm_id(logical_id)
                target = logical_by_norm.get(norm)
        
        if target is None:
            # Still no match, find best similarity
            for l in log_records:
                sim = _pl_similarity(p_text, f"{l.name} {(l.description or '')}".strip())
                if sim > best_sim:
                    best_sim = sim; target = l
        if target is None:
            return None
        # If chosen differs from provided id or rationale references other IDs, annotate & mark uncertainty
        import re
        mismatch_reason = None; auto_sub = False
        if not logical_id:
            mismatch_reason = f"model id <empty> not found; substituted {target.id}"
            rationale += f' (Adjusted: model id <empty> not found, substituted {target.id})'
            uncertainty_flag = True; auto_sub = True
        elif target.id != logical_id and _norm_id(logical_id) == _norm_id(target.id):
            # Normalized match: accept without marking as substitution (case or zero padding only)
            mismatch_reason = None; auto_sub = False
            # Optionally annotate minimal normalization
            if _norm_id(logical_id) == _norm_id(target.id):
                rationale += ' (Normalized ID variant accepted)'
        elif target.id != logical_id:
            mismatch_reason = f"model id {original_id or '<empty>'} not found; substituted {target.id}"
            rationale += f' (Adjusted: model id {original_id or "<empty>"} not found, substituted {target.id})'
            uncertainty_flag = True; auto_sub = True
        else:
            mentioned_ids = set(re.findall(r'\b[A-Z]{2,}-\d+\b', rationale))
            if mentioned_ids and (target.id not in mentioned_ids or len(mentioned_ids) > 1):
                mismatch_reason = f"rationale referenced IDs {sorted(mentioned_ids)}; mapping kept {target.id}"
                rationale += f' (Note: rationale referenced IDs {sorted(mentioned_ids)}; mapped to {target.id})'
                uncertainty_flag = True
        sim_score = _pl_similarity(p_text, f"{target.name} {(target.description or '')}".strip())
    # Uncertainty flag is as returned by model only.
        return PhysicalLogicalMapRecord(
            physical_id=p.id,
            physical_name=p.name,
            logical_id=target.id,
            logical_name=target.name,
            similarity=round(sim_score, 3),
            rationale=rationale,
            uncertainty=uncertainty_flag,
            model_logical_id=original_id or None,
            auto_substituted=auto_sub,
            mismatch_reason=mismatch_reason,
        )

    async def event_generator():
        import asyncio as _asyncio
        total = len(phys_records)
        yield f"data: {_json.dumps({'type':'start','total': total, 'mode':'llm' if use_llm else 'heuristic'})}\n\n"
        results: List[PhysicalLogicalMapRecord] = []
        loop = __import__('asyncio').get_event_loop()
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
            futures = {ex.submit(_map_one, p): p.id for p in phys_records}
            processed = 0
            for fut in concurrent.futures.as_completed(futures):
                rec = await loop.run_in_executor(None, fut.result) if False else fut.result()  # fut.result is already blocking; just get result
                if rec:
                    results.append(rec)
                    processed += 1
                    yield f"data: {_json.dumps({'type':'progress','processed': processed,'total': total,'record': rec.model_dump()})}\n\n"
                await _asyncio.sleep(0)  # cooperative yield
        # Order
        order = {p.id: i for i, p in enumerate(phys_records)}
        results.sort(key=lambda r: order.get(r.physical_id, 1_000_000))
        uncertain = sum(1 for m in results if m.uncertainty)
        auto_subs = sum(1 for m in results if getattr(m, 'auto_substituted', False))
        summary = {
            'physical': len(phys_records),
            'logical': len(log_records),
            'mapped': len(results),
            'uncertain': uncertain,
            'mece_physical_coverage': len(results) == len(phys_records),
            'mode': 'llm',
            'elapsed_sec': round(_time() - start_time, 2),
            'auto_substitutions': auto_subs,
        }
        yield f"data: {_json.dumps({'type':'complete','summary': summary,'mappings':[r.model_dump() for r in results]})}\n\n"
        yield "data: {\"type\":\"end\"}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
    })

@router.post("/applications/physical-logical/map-llm.xlsx")
async def physical_logical_map_llm_xlsx(payload: PhysicalLogicalMapRequest):
    """Excel export using LLM mapping only."""
    result = await physical_logical_map_llm(payload)
    df = pd.DataFrame([m.model_dump() for m in result["mappings"]]) if result["mappings"] else pd.DataFrame(columns=[
        "physical_id","physical_name","logical_id","logical_name","similarity","rationale","uncertainty","model_logical_id","auto_substituted","mismatch_reason"
    ])
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name="Mappings")
        pd.DataFrame([result["summary"]]).to_excel(writer, index=False, sheet_name="Summary")
    return Response(content=bio.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=physical_logical_mapping_llm.xlsx"})


class PhysicalLogicalExportRequest(BaseModel):
    mappings: List[PhysicalLogicalMapRecord]
    summary: Dict[str, Any]


@router.post("/applications/physical-logical/export.xlsx")
async def physical_logical_export_xlsx(payload: PhysicalLogicalExportRequest):
    """Export provided mapping results to Excel without re-running LLM."""
    df = pd.DataFrame([m.model_dump() for m in payload.mappings]) if payload.mappings else pd.DataFrame(columns=[
        "physical_id","physical_name","logical_id","logical_name","similarity","rationale","uncertainty","model_logical_id","auto_substituted","mismatch_reason"
    ])
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name="Mappings")
        pd.DataFrame([payload.summary]).to_excel(writer, index=False, sheet_name="Summary")
    return Response(content=bio.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=physical_logical_mapping.xlsx"})


# ---------------------------------------------------------------------------
# Engagement Planning Toolkit


class EngagementPlanRequest(BaseModel):
    audience: str
    goal: str


class EngagementPlanResponse(BaseModel):
    touchpoints: List[str]


@router.post("/engagement/plan", response_model=EngagementPlanResponse)
async def engagement_plan(payload: EngagementPlanRequest):
    touchpoints = [
        f"Initial email to {payload.audience}",
        "Follow-up meeting",
        f"Deliverable addressing {payload.goal}",
    ]
    return {"touchpoints": touchpoints}


# ---------------------------------------------------------------------------
# Strategy and Motivations Toolkit


class StrategyMapRequest(BaseModel):
    strategies: List[str]
    capabilities: List[CapItem]


class StrategyCapMap(BaseModel):
    strategy: str
    capability_ids: List[str]


@router.post("/strategy/capabilities/map", response_model=List[StrategyCapMap])
async def strategy_capability_map(payload: StrategyMapRequest):
    caps = payload.capabilities or []
    results: List[StrategyCapMap] = []
    for strat in payload.strategies:
        matched = [c.id for c in caps if c.name.lower() in strat.lower()]
        if not matched and caps:
            matched = [caps[0].id]
        results.append(StrategyCapMap(strategy=strat, capability_ids=matched))
    return results


class TacticsToStrategiesRequest(BaseModel):
    tactics: List[str]


class TacticsToStrategiesResponse(BaseModel):
    strategies: List[str]


@router.post("/strategy/tactics/generate", response_model=TacticsToStrategiesResponse)
async def tactics_to_strategies(payload: TacticsToStrategiesRequest):
    strategies = [f"Support tactic: {t}" for t in payload.tactics]
    return {"strategies": strategies}


# ---------------------------------------------------------------------------
# Data, Information, and AI Toolkit


class ConceptualDataModelRequest(BaseModel):
    """Request body for conceptual model generation."""
    context: str = ""


class DataEntity(BaseModel):
    subject_area: str
    entity: str
    description: str


class ConceptualDataModelResponse(BaseModel):
    subject_areas: List[str]
    entities: List[DataEntity]


@router.post("/data/conceptual-model", response_model=ConceptualDataModelResponse)
async def conceptual_data_model(payload: ConceptualDataModelRequest):
    """Generate simple subject areas and entities from supplied context."""
    words = [w.strip(" ,.;:-") for w in payload.context.split()]
    areas: List[str] = []
    for w in words:
        if len(w) > 3:
            t = w.title()
            if t not in areas:
                areas.append(t)
            if len(areas) >= 5:
                break
    if not areas:
        areas = ["General"]
    entities: List[Dict[str, str]] = []
    for area in areas:
        for i in range(1, 4):
            entities.append(
                {
                    "subject_area": area,
                    "entity": f"{area} Entity {i}",
                    "description": f"Example entity {i} for {area}",
                }
            )
    return {"subject_areas": areas, "entities": entities}


class DataAppMapRequest(BaseModel):
    data_entities: List[str]
    applications: List[str]


class DataAppMapping(BaseModel):
    data_entity: str
    application: str
    relationship: str
    rationale: str


class DataAppMapResponse(BaseModel):
    mappings: List[DataAppMapping]


@router.post("/data/application/map", response_model=DataAppMapResponse)
async def data_application_map(payload: DataAppMapRequest):
    """Produce simple mappings between data entities and applications."""
    apps = payload.applications or []
    rel_types = ["System of Record", "System of Entry"]
    mappings: List[Dict[str, str]] = []
    for i, de in enumerate(payload.data_entities):
        app = apps[i % len(apps)] if apps else ""
        rel = rel_types[i % len(rel_types)]
        mappings.append(
            {
                "data_entity": de,
                "application": app,
                "relationship": rel,
                "rationale": f"{app} serves as the {rel.lower()} for {de}.",
            }
        )
    return {"mappings": mappings}


class UseCaseCustomiseRequest(BaseModel):
    use_cases: List[str]
    context: str = ""


class UseCaseCustomiseItem(BaseModel):
    use_case: str
    customised: str
    score: int
    rationale: str


class UseCaseCustomiseResponse(BaseModel):
    results: List[UseCaseCustomiseItem]


@router.post("/use-case/customise", response_model=UseCaseCustomiseResponse)
async def customise_use_case(payload: UseCaseCustomiseRequest):
    """Rank and customise supplied use cases for the given context."""
    results: List[Dict[str, Any]] = []
    for uc in payload.use_cases:
        base = len(uc) % 10
        score = min(10, base + (2 if payload.context else 0) + 1)
        customised = f"{uc.strip()} for {payload.context.strip()}" if payload.context else uc.strip()
        rationale = "Score based on description length; placeholder rationale."
        results.append(
            {
                "use_case": uc,
                "customised": customised,
                "score": score,
                "rationale": rationale,
            }
        )
    results.sort(key=lambda x: x["score"], reverse=True)
    return {"results": results}


# ---------------------------------------------------------------------------
# General LLM Chat Endpoint

class ChatMessage(BaseModel):
    role: str = Field(..., description="Message role: 'user', 'assistant', or 'system'")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="Conversation messages")
    temperature: Optional[float] = Field(None, description="Response temperature (0-2)")
    max_tokens: Optional[int] = Field(None, description="Maximum tokens in response")


class ChatResponse(BaseModel):
    response: str = Field(..., description="LLM response content")
    usage: Optional[Dict[str, Any]] = Field(None, description="Token usage information")


@router.post("/llm/chat", response_model=ChatResponse)
async def llm_chat(payload: ChatRequest):
    """Direct LLM chat interface for arbitrary conversations."""
    if llm is None:
        raise HTTPException(status_code=503, detail="LLM not configured")
    
    try:
        from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
        
        # Convert messages to LangChain format
        lc_messages = []
        for msg in payload.messages:
            if msg.role == "system":
                lc_messages.append(SystemMessage(content=msg.content))
            elif msg.role == "assistant":
                lc_messages.append(AIMessage(content=msg.content))
            else:  # user or any other role
                lc_messages.append(HumanMessage(content=msg.content))
        
        # Call LLM
        response = llm.invoke(lc_messages)
        content = getattr(response, 'content', '') or ''
        
        # Extract usage information if available
        usage_info = None
        if hasattr(response, 'usage_metadata'):
            usage_info = response.usage_metadata
        elif hasattr(response, 'response_metadata') and 'token_usage' in response.response_metadata:
            usage_info = response.response_metadata['token_usage']
        
        return ChatResponse(
            response=content,
            usage=usage_info
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM chat failed: {str(e)}")


# ---------------------------------------------------------------------------
# Portfolio Analysis Endpoints

class CapabilityItem(BaseModel):
    id: str
    text_content: str


class ApplicationItem(BaseModel):
    id: str
    text_content: str


class PainPointMapping(BaseModel):
    pain_point_id: str
    pain_point_desc: str
    capability_id: str


class CapabilityRecommendation(BaseModel):
    capability: str
    pain_points: List[str]
    affected_applications: List[str]
    recommendation: str
    priority: str  # "High", "Medium", "Low"
    impact: str
    effort: str


class AnalyzeCapabilityRequest(BaseModel):
    capability: CapabilityItem
    related_pain_points: List[PainPointMapping]
    affected_applications: List[ApplicationItem]
    all_applications: List[ApplicationItem]


@router.post("/applications/portfolio/analyze-capability", response_model=CapabilityRecommendation)
async def analyze_capability_for_portfolio(payload: AnalyzeCapabilityRequest):
    """Analyze a single capability for portfolio recommendations."""
    if llm is None:
        raise HTTPException(status_code=503, detail="LLM not configured")
    
    try:
        from langchain_core.messages import HumanMessage
        
        # Build the analysis prompt
        pain_points_text = "\n".join([f"- {pp.pain_point_desc}" for pp in payload.related_pain_points])
        
        affected_apps_text = "\n".join([
            f"- {app.id}: {app.text_content}" for app in payload.affected_applications
        ])
        
        prompt = f"""You are an enterprise architect analyzing application portfolios. 

CAPABILITY TO ANALYZE:
- ID: {payload.capability.id}
- Description: {payload.capability.text_content}

RELATED PAIN POINTS:
{pain_points_text}

AFFECTED APPLICATIONS:
{affected_apps_text}

Based on this information, provide a recommendation for this capability. Consider:
1. How the pain points affect this capability
2. Which applications should be modified, replaced, or enhanced
3. The priority level (High/Medium/Low) based on business impact
4. The estimated effort and impact

Respond in JSON format only:
{{
  "capability": "{payload.capability.id}",
  "painPoints": [array of pain point descriptions],
  "affectedApplications": [array of application IDs],
  "recommendation": "detailed recommendation text",
  "priority": "High|Medium|Low",
  "impact": "description of business impact",
  "effort": "description of implementation effort"
}}"""

        response = llm.invoke([HumanMessage(content=prompt)])
        content = getattr(response, 'content', '') or ''
        
        # Parse JSON response
        import json
        try:
            # Extract JSON from response (handle potential markdown formatting)
            json_start = content.find('{')
            json_end = content.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                json_content = content[json_start:json_end]
                result = json.loads(json_content)
                
                return CapabilityRecommendation(
                    capability=result.get('capability', payload.capability.id),
                    pain_points=result.get('painPoints', [pp.pain_point_desc for pp in payload.related_pain_points]),
                    affected_applications=result.get('affectedApplications', [app.id for app in payload.affected_applications]),
                    recommendation=result.get('recommendation', 'Analysis could not be completed'),
                    priority=result.get('priority', 'Medium'),
                    impact=result.get('impact', 'Impact assessment pending'),
                    effort=result.get('effort', 'Effort estimation pending')
                )
            else:
                raise HTTPException(status_code=500, detail="LLM analysis failed to provide valid recommendation structure")
                
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(status_code=500, detail=f"LLM response parsing failed: {str(e)}. LLM service is required for capability analysis.")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Capability analysis failed: {str(e)}")


class HarmonizedRecommendation(BaseModel):
    application: str
    actions: List[str]
    overall_priority: str  # "High", "Medium", "Low"
    total_impact: str
    consolidated_rationale: str


class HarmonizeRecommendationsRequest(BaseModel):
    recommendations: List[CapabilityRecommendation]
    applications: List[ApplicationItem]


class HarmonizeRecommendationsResponse(BaseModel):
    harmonized_recommendations: List[HarmonizedRecommendation]


@router.post("/applications/portfolio/harmonize", response_model=HarmonizeRecommendationsResponse)
async def harmonize_portfolio_recommendations(payload: HarmonizeRecommendationsRequest):
    """Harmonize capability recommendations across applications."""
    if llm is None:
        raise HTTPException(status_code=503, detail="LLM not configured")
    
    try:
        from langchain_core.messages import HumanMessage
        import json
        
        # Group recommendations by affected applications
        app_recommendations = {}
        for rec in payload.recommendations:
            for app_id in rec.affected_applications:
                if app_id not in app_recommendations:
                    app_recommendations[app_id] = []
                app_recommendations[app_id].append(rec)
        
        harmonized = []
        
        for app_id, app_recs in app_recommendations.items():
            # Find application details
            app_details = next((app for app in payload.applications if app.id == app_id), None)
            
            # Build harmonization prompt
            recommendations_text = ""
            for idx, rec in enumerate(app_recs, 1):
                recommendations_text += f"""
{idx}. Capability: {rec.capability}
   Recommendation: {rec.recommendation}
   Priority: {rec.priority}
   Impact: {rec.impact}
   Effort: {rec.effort}
"""

            prompt = f"""You are an enterprise architect harmonizing multiple capability recommendations for a single application.

APPLICATION:
- ID: {app_id}
- Description: {app_details.text_content if app_details else 'No description available'}

CAPABILITY RECOMMENDATIONS FOR THIS APPLICATION:
{recommendations_text}

Your task is to harmonize these recommendations into consolidated actions for this application. Consider:
1. Are there conflicting recommendations that need resolution?
2. Can actions be combined for efficiency?
3. What is the overall priority when considering all capabilities?
4. What is the consolidated rationale for the recommended actions?

Respond in JSON format only:
{{
  "application": "{app_id}",
  "actions": [array of specific action strings],
  "overallPriority": "High|Medium|Low",
  "totalImpact": "description of overall business impact",
  "consolidatedRationale": "explanation of why these actions were chosen"
}}"""

            response = llm.invoke([HumanMessage(content=prompt)])
            content = getattr(response, 'content', '') or ''
            
            try:
                # Extract JSON from response
                json_start = content.find('{')
                json_end = content.rfind('}') + 1
                if json_start != -1 and json_end > json_start:
                    json_content = content[json_start:json_end]
                    result = json.loads(json_content)
                    
                    harmonized.append(HarmonizedRecommendation(
                        application=result.get('application', app_id),
                        actions=result.get('actions', [f"Review application {app_id} based on capability recommendations"]),
                        overall_priority=result.get('overallPriority', 'Medium'),
                        total_impact=result.get('totalImpact', f'Multiple capabilities require attention in {app_id}'),
                        consolidated_rationale=result.get('consolidatedRationale', f'Harmonized recommendations for {len(app_recs)} capabilities')
                    ))
                else:
                    raise HTTPException(status_code=500, detail="LLM harmonization failed to provide valid response structure")
                    
            except (json.JSONDecodeError, ValueError) as e:
                raise HTTPException(status_code=500, detail=f"LLM harmonization response parsing failed: {str(e)}. LLM service is required for recommendation harmonization.")
        
        return HarmonizeRecommendationsResponse(harmonized_recommendations=harmonized)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Harmonization failed: {str(e)}")


class PortfolioAnalysisRequest(BaseModel):
    capabilities: List[CapabilityItem]
    applications: List[ApplicationItem]
    pain_point_mappings: List[PainPointMapping]
    application_mappings: List[ApplicationItem]  # Applications with capability mappings


class PortfolioAnalysisResponse(BaseModel):
    recommendations: List[CapabilityRecommendation]
    harmonized_recommendations: List[HarmonizedRecommendation]
    summary: Dict[str, Any]


@router.post("/applications/portfolio/analyze-from-files")
async def analyze_portfolio_from_files(
    applications: UploadFile = File(...),
    capabilities: UploadFile = File(...),
    pain_point_mapping: UploadFile = File(...),
    application_mapping: UploadFile = File(...),
    pain_point_id_col: str = Form(...),
    pain_point_desc_cols: str = Form(...),  # JSON array string
    capability_id_col: str = Form(...),
    app_id_col: str = Form(...),
    app_name_col: str = Form(...),
    cap_id_col: str = Form(...),
    cap_name_col: str = Form(...),
    additional_context: str = Form(""),
    max_capabilities: int = Form(3),  # Limit capabilities for performance
    fast_mode: bool = Form(False),  # Skip harmonization for speed
):
    """Complete portfolio analysis from uploaded files with performance limits."""
    if llm is None:
        raise HTTPException(status_code=503, detail="LLM not configured")
    
    try:
        import pandas as pd
        from io import BytesIO
        import json
        
        # Parse pain point description columns from JSON
        try:
            pain_point_desc_cols_list = json.loads(pain_point_desc_cols)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON format for pain_point_desc_cols")
        
        # Read uploaded files
        apps_content = await applications.read()
        caps_content = await capabilities.read()
        pp_content = await pain_point_mapping.read()
        app_map_content = await application_mapping.read()
        
        # Parse files based on extension
        def parse_file(content: bytes, filename: str) -> pd.DataFrame:
            if filename.endswith('.xlsx') or filename.endswith('.xls'):
                return pd.read_excel(BytesIO(content))
            elif filename.endswith('.csv'):
                return pd.read_csv(BytesIO(content))
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported file format: {filename}")
        
        apps_df = parse_file(apps_content, applications.filename)
        caps_df = parse_file(caps_content, capabilities.filename)
        pp_df = parse_file(pp_content, pain_point_mapping.filename)
        app_map_df = parse_file(app_map_content, application_mapping.filename)
        
        # Validate required columns exist
        def validate_columns(df: pd.DataFrame, required_cols: list, file_name: str):
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                available_cols = list(df.columns)
                raise HTTPException(
                    status_code=400, 
                    detail=f"Missing columns in {file_name}: {missing_cols}. Available columns: {available_cols}"
                )
        
        validate_columns(apps_df, [app_id_col, app_name_col], "applications")
        validate_columns(caps_df, [cap_id_col, cap_name_col], "capabilities")
        validate_columns(pp_df, [pain_point_id_col, capability_id_col] + pain_point_desc_cols_list, "pain_point_mapping")
        validate_columns(app_map_df, [app_id_col, cap_id_col], "application_mapping")
        
        # Limit capabilities for performance (take first N)
        caps_df_limited = caps_df.head(max_capabilities)
        print(f"Processing {len(caps_df_limited)} capabilities (limited from {len(caps_df)} for performance)")
        
        # Convert DataFrames to the expected data structures
        applications_data = []
        for _, row in apps_df.iterrows():
            applications_data.append(ApplicationItem(
                id=str(row[app_id_col]),
                text_content=str(row[app_name_col])
            ))
        
        capabilities_data = []
        for _, row in caps_df_limited.iterrows():  # Use limited set
            capabilities_data.append(CapabilityItem(
                id=str(row[cap_id_col]),
                text_content=str(row[cap_name_col])
            ))
        
        pain_point_mappings_data = []
        for _, row in pp_df.iterrows():
            # Only include pain points for the capabilities we're processing
            if str(row[capability_id_col]) in [cap.id for cap in capabilities_data]:
                # Combine description columns
                desc_parts = []
                for col in pain_point_desc_cols_list:
                    if pd.notna(row[col]):
                        desc_parts.append(str(row[col]))
                pain_point_desc = " | ".join(desc_parts)
                
                pain_point_mappings_data.append(PainPointMapping(
                    pain_point_id=str(row[pain_point_id_col]),
                    pain_point_desc=pain_point_desc,
                    capability_id=str(row[capability_id_col])
                ))
        
        application_mappings_data = []
        for _, row in app_map_df.iterrows():
            # Only include mappings for the capabilities we're processing
            if str(row[cap_id_col]) in [cap.id for cap in capabilities_data]:
                # Find the capability name
                cap_info = caps_df[caps_df[cap_id_col] == row[cap_id_col]]
                cap_name = cap_info.iloc[0][cap_name_col] if not cap_info.empty else str(row[cap_id_col])
                
                application_mappings_data.append(ApplicationItem(
                    id=str(row[app_id_col]),
                    text_content=cap_name
                ))
        
        # Create the portfolio analysis request
        portfolio_request = PortfolioAnalysisRequest(
            applications=applications_data,
            capabilities=capabilities_data,
            pain_point_mappings=pain_point_mappings_data,
            application_mappings=application_mappings_data,
            additional_context=f"{additional_context}\n\nNote: Analysis limited to {max_capabilities} capabilities for performance. Fast mode: {fast_mode}"
        )
        
        # Choose analysis approach based on fast_mode
        if fast_mode:
            print("Running in fast mode - capability analysis only, no harmonization")
            # Just do capability analysis, skip harmonization
            try:
                recommendations = []
                
                # Analyze each capability quickly
                for capability in capabilities_data:
                    # Find related pain points
                    related_pain_points = [
                        pm for pm in pain_point_mappings_data 
                        if pm.capability_id == capability.id
                    ]
                    
                    # Find affected applications
                    affected_apps = [
                        app for app in application_mappings_data
                        if capability.id.lower() in app.text_content.lower() or 
                           capability.text_content.lower() in app.text_content.lower()
                    ]
                    
                    # Create a simple recommendation without LLM
                    simple_rec = CapabilityRecommendation(
                        capability=capability.id,
                        pain_points=[pp.pain_point_desc for pp in related_pain_points],
                        affected_applications=[app.id for app in affected_apps],
                        recommendation=f"Review {capability.text_content} - {len(related_pain_points)} pain points identified",
                        priority="Medium",
                        impact=f"{len(related_pain_points)} pain points affecting {len(affected_apps)} applications",
                        effort="Assessment needed"
                    )
                    recommendations.append(simple_rec)
                
                # Simple harmonization
                harmonized = []
                for app in applications_data:
                    app_recs = [r for r in recommendations if app.id in r.affected_applications]
                    if app_recs:
                        harmonized.append(HarmonizedRecommendation(
                            application=app.id,
                            actions=[f"Review {len(app_recs)} capabilities"],
                            overall_priority="Medium",
                            total_impact=f"Affected by {len(app_recs)} capability issues",
                            consolidated_rationale=f"Application {app.text_content} requires review based on {len(app_recs)} capability assessments"
                        ))
                
                return PortfolioAnalysisResponse(
                    recommendations=recommendations,
                    harmonized_recommendations=harmonized,
                    summary={
                        "total_capabilities": len(capabilities_data),
                        "total_applications": len(applications_data),
                        "high_priority_actions": 0,
                        "total_recommendations": len(recommendations),
                        "applications_affected": len(harmonized),
                        "mode": "fast_mode_heuristic"
                    }
                )
                
            except Exception as e:
                print(f"Fast mode error: {e}")
                raise HTTPException(status_code=500, detail=f"Fast mode analysis failed: {str(e)}")
        else:
            # Full LLM analysis (original approach)
            # Call the existing portfolio analysis function with a timeout wrapper
            import asyncio
            try:
                print(f"Starting analysis of {len(capabilities_data)} capabilities...")
                result = await asyncio.wait_for(
                    analyze_portfolio(portfolio_request), 
                    timeout=45.0  # Shorter timeout
                )
                print("Analysis completed successfully!")
                return result
            except asyncio.TimeoutError:
                print("Analysis timed out, providing partial results...")
                # Return a simplified response if timeout occurs
                return PortfolioAnalysisResponse(
                    recommendations=[],
                    harmonized_recommendations=[],
                    summary={
                        "error": "Analysis timed out",
                        "total_capabilities": len(capabilities_data),
                        "total_applications": len(applications_data),
                        "message": f"Analysis of {len(capabilities_data)} capabilities exceeded 45 second limit. Try reducing complexity or number of capabilities."
                    }
                )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Portfolio analysis from files error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/applications/portfolio/analyze", response_model=PortfolioAnalysisResponse)
async def analyze_portfolio(payload: PortfolioAnalysisRequest):
    """Complete portfolio analysis workflow."""
    if llm is None:
        raise HTTPException(status_code=503, detail="LLM not configured")
    
    try:
        recommendations = []
        
        # Analyze each capability
        for capability in payload.capabilities:
            # Find related pain points
            related_pain_points = [
                pm for pm in payload.pain_point_mappings 
                if pm.capability_id == capability.id
            ]
            
            # Find affected applications
            affected_apps = [
                app for app in payload.application_mappings
                if capability.id.lower() in app.text_content.lower() or 
                   capability.text_content.lower() in app.text_content.lower()
            ]
            
            # Analyze capability
            analysis_request = AnalyzeCapabilityRequest(
                capability=capability,
                related_pain_points=related_pain_points,
                affected_applications=affected_apps,
                all_applications=payload.applications
            )
            
            recommendation = await analyze_capability_for_portfolio(analysis_request)
            recommendations.append(recommendation)
        
        # Harmonize recommendations
        harmonize_request = HarmonizeRecommendationsRequest(
            recommendations=recommendations,
            applications=payload.applications
        )
        
        harmonize_response = await harmonize_portfolio_recommendations(harmonize_request)
        
        # Generate summary
        high_priority_count = len([hr for hr in harmonize_response.harmonized_recommendations if hr.overall_priority == "High"])
        
        summary = {
            "total_capabilities": len(payload.capabilities),
            "total_applications": len(payload.applications),
            "high_priority_actions": high_priority_count,
            "total_recommendations": len(recommendations),
            "applications_affected": len(harmonize_response.harmonized_recommendations)
        }
        
        return PortfolioAnalysisResponse(
            recommendations=recommendations,
            harmonized_recommendations=harmonize_response.harmonized_recommendations,
            summary=summary
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Portfolio analysis failed: {str(e)}")


# Graphic Design Tools
class SlideFeedback(BaseModel):
    overall_score: int
    visual_consistency: str
    typography: str
    color_harmony: str
    layout_balance: str
    suggestions: List[str]

class SlideReview(BaseModel):
    slide_number: int
    image_path: str
    feedback: SlideFeedback

class SlidePreview(BaseModel):
    slide_number: int
    image_path: str

class SlidePreviewResponse(BaseModel):
    slides: List[SlidePreview]

class OverallSummary(BaseModel):
    average_score: float
    key_strengths: List[str]
    priority_improvements: List[str]

class PowerPointReviewResponse(BaseModel):
    presentation_name: str
    total_slides: int
    reviews: List[SlideReview]
    overall_summary: OverallSummary
    mode: Optional[str] = None


# ---------------------------------------------------------------------------
# Brand Consistency Checker

class StyleGuideIngestResponse(BaseModel):
    style_guide_id: str
    rules: List[Dict[str, Any]]
    summary: str
    characters: int


@router.post("/brand/style-guide", response_model=StyleGuideIngestResponse)
async def brand_style_guide_ingest(file: UploadFile = File(...)):
    """Ingest a style guide PDF and extract brand rules."""
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF style guides supported")
    import tempfile, shutil
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        path = tmp.name
    try:
        result = ingest_style_guide(path, file.filename)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Style guide ingestion failed: {e}")
    finally:
        try:
            os.unlink(path)
        except Exception:
            pass


class DeckIngestResponse(BaseModel):
    deck_id: str
    slides: List[Dict[str, Any]]
    total_slides: int


@router.post("/brand/deck", response_model=DeckIngestResponse)
async def brand_deck_ingest(file: UploadFile = File(...)):
    """Ingest a deck (PDF presentation) for brand consistency analysis."""
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF decks supported")
    import tempfile, shutil
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        path = tmp.name
    try:
        result = ingest_deck(path, file.filename)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deck ingestion failed: {e}")
    finally:
        try:
            os.unlink(path)
        except Exception:
            pass


class BrandAnalysisRequest(BaseModel):
    style_guide_id: str
    deck_id: str
    selected_slides: Optional[List[int]] = None


class BrandSlideResult(BaseModel):
    slide_number: int
    score: int
    issues: List[str]
    adherence: List[str]
    recommendations: List[str]
    image_path: str


class BrandAnalysisSummary(BaseModel):
    average_score: float
    slides_evaluated: int
    style_guide_rules: int
    style_guide_id: str
    deck_id: str


class BrandAnalysisResponse(BaseModel):
    results: List[BrandSlideResult]
    summary: BrandAnalysisSummary
    rules: List[Dict[str, Any]]


@router.post("/brand/analyse", response_model=BrandAnalysisResponse)
async def brand_analyse(payload: BrandAnalysisRequest):
    try:
        result = analyse_brand_consistency(payload.style_guide_id, payload.deck_id, payload.selected_slides)
        # Pydantic model coercion
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Brand analysis failed: {e}")

@router.post("/graphic-design/powerpoint/preview", response_model=SlidePreviewResponse)
async def preview_powerpoint_slides(presentation: UploadFile = File(...)):
    """Preview PDF presentation pages as images.

    (Legacy path name retained for backward compatibility; now PDF-only.)
    """
    from ..services.powerpoint_review import extract_slides_as_images
    if not presentation.filename:
        raise HTTPException(status_code=400, detail="File required")
    fname = presentation.filename.lower()
    if not fname.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported now. Please export your presentation to PDF.")
    import tempfile, shutil
    # Preserve correct extension (.pdf) so downstream detection works
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        shutil.copyfileobj(presentation.file, tmp_file)
        tmp_path = tmp_file.name
    try:
        slide_images = await extract_slides_as_images(tmp_path)
        slides = [
            {
                "slide_number": s["slide_number"],
                "image_path": f"data:image/png;base64,{s['image_base64']}"
            } for s in slide_images
        ]
        return {"slides": slides}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF preview failed: {e}")
    finally:
        os.unlink(tmp_path)

@router.post("/graphic-design/powerpoint/review", response_model=PowerPointReviewResponse)
async def review_powerpoint_presentation(
    presentation: UploadFile = File(...),
    selected_slides: str = Form(None),
    mode: str = Form("presentation_aid", description="presentation_aid or deliverable")
):
    """Review a PDF presentation for visual consistency and design quality (PDF-only)."""
    from ..services.powerpoint_review import review_presentation
    if not presentation.filename:
        raise HTTPException(status_code=400, detail="File required")
    fname = presentation.filename.lower()
    if not fname.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported now. Export your deck to PDF.")
    # Parse selected pages
    slides_to_review = None
    if selected_slides:
        try:
            import json
            slides_to_review = json.loads(selected_slides)
        except Exception:
            slides_to_review = None
    import tempfile, shutil
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        shutil.copyfileobj(presentation.file, tmp_file)
        tmp_path = tmp_file.name
    try:
        result = await review_presentation(tmp_path, presentation.filename, slides_to_review, mode=mode)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF review failed: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
    return result
