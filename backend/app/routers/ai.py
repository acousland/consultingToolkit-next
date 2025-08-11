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


@router.post("/pain-points/cleanup/propose", response_model=CleanupProposalResponse)
async def cleanup_propose(raw_points: List[str], options: CleanupOptions):  # body expects JSON array + options
    if not raw_points:
        return {"proposal": [], "summary": {"total_raw": 0}}
    result = build_proposals(raw_points, options.model_dump())
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


class AppCapMapResponse(BaseModel):
    application_id: str
    capability_ids: List[str]


@router.post("/applications/capabilities/map", response_model=List[AppCapMapResponse])
async def map_applications_to_capabilities(payload: AppCapMapRequest):
    caps = payload.capabilities or []
    if not caps:
        return []
    out: List[AppCapMapResponse] = []
    for app in payload.applications:
        desc = (app.description or "").lower()
        matched = [c.id for c in caps if c.name.lower() in desc]
        if not matched:
            idx = sum(ord(ch) for ch in app.id) % len(caps)
            matched = [caps[idx].id]
        out.append(AppCapMapResponse(application_id=app.id, capability_ids=matched))
    return out


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
    application_description: str
    capabilities: List[CapItem]


class IndividualAppMapResponse(BaseModel):
    capability_ids: List[str]


@router.post("/applications/map", response_model=IndividualAppMapResponse)
async def individual_application_map(payload: IndividualAppMapRequest):
    caps = payload.capabilities or []
    desc = payload.application_description.lower()
    matched = [c.id for c in caps if c.name.lower() in desc]
    if not matched and caps:
        matched = [caps[0].id]
    return {"capability_ids": matched}


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
    uncertainty_threshold: Optional[float] = 0.22


class PhysicalLogicalMapRecord(BaseModel):
    physical_id: str
    physical_name: str
    logical_id: str
    logical_name: str
    similarity: float
    rationale: str
    uncertainty: bool


class PhysicalLogicalMapResponse(BaseModel):
    mappings: List[PhysicalLogicalMapRecord]
    summary: Dict[str, Any]


def _pl_similarity(a: str, b: str) -> float:
    import difflib
    return difflib.SequenceMatcher(a=a.lower(), b=b.lower()).ratio()


@router.post("/applications/physical-logical/map", response_model=PhysicalLogicalMapResponse)
async def physical_logical_map(payload: PhysicalLogicalMapRequest):
    phys = payload.physical_apps or []
    logical = payload.logical_apps or []
    if not phys or not logical:
        return {"mappings": [], "summary": {"physical": len(phys), "logical": len(logical), "uncertain": 0}}
    mappings: List[PhysicalLogicalMapRecord] = []
    for p in phys:
        p_text = f"{p.name} {p.description or ''}".strip()
        best = None
        best_sim = -1.0
        for l in logical:
            l_text = f"{l.name} {l.description or ''}".strip()
            sim = _pl_similarity(p_text, l_text)
            if sim > best_sim:
                best_sim = sim
                best = l
        if best is None:
            continue
        # Simple rationale: overlapping words
        p_tokens = {t for t in (p_text.lower().split()) if len(t) > 3}
        l_tokens = {t for t in (f"{best.name} {best.description or ''}".lower().split()) if len(t) > 3}
        overlap = sorted(p_tokens & l_tokens)
        rationale = "Overlap: " + (", ".join(overlap) if overlap else "minimal lexical overlap; closest overall semantic/heuristic match")
        mappings.append(
            PhysicalLogicalMapRecord(
                physical_id=p.id,
                physical_name=p.name,
                logical_id=best.id,
                logical_name=best.name,
                similarity=round(best_sim, 3),
                rationale=rationale,
                uncertainty=best_sim < (payload.uncertainty_threshold or 0.22),
            )
        )
    uncertain = sum(1 for m in mappings if m.uncertainty)
    summary = {
        "physical": len(phys),
        "logical": len(logical),
        "mapped": len(mappings),
        "uncertain": uncertain,
        "mece_physical_coverage": len(mappings) == len(phys),
    }
    return {"mappings": mappings, "summary": summary}


@router.post("/applications/physical-logical/map.xlsx")
async def physical_logical_map_xlsx(payload: PhysicalLogicalMapRequest):
    resp = await physical_logical_map(payload)  # reuse logic
    df = pd.DataFrame([m.model_dump() for m in resp["mappings"]]) if resp["mappings"] else pd.DataFrame(columns=[
        "physical_id", "physical_name", "logical_id", "logical_name", "similarity", "rationale", "uncertainty"
    ])
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name="Mappings")
        pd.DataFrame([resp["summary"]]).to_excel(writer, index=False, sheet_name="Summary")
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
