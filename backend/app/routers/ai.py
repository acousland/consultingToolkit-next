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
    # Normalized lookup map
    logical_by_norm: Dict[str, LogicalAppItem] = { _norm_id(l.id): l for l in logical }
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
            target = next((l for l in logical if l.id == logical_id), None)
            if target is None and logical_id:
                # Try normalized lookup (case / zero padding differences)
                target = logical_by_norm.get(_norm_id(logical_id))
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
    logical_by_norm: Dict[str, LogicalAppItem] = { _norm_id(l.id): l for l in log_records }
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
        # If model didn't give an id or heuristic path: choose best lexical
        target = None; best_sim = -1.0; original_id = logical_id
        for l in log_records:
            sim = _pl_similarity(p_text, f"{l.name} {(l.description or '')}".strip())
            if sim > best_sim:
                best_sim = sim; target = l
            if logical_id and l.id == logical_id:
                target = l; best_sim = sim
        if target is None and logical_id:
            # Normalized lookup
            norm = _norm_id(logical_id)
            target = logical_by_norm.get(norm, target)
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
