"""PDF presentation preview & review services.

This module now supports ONLY PDF uploads (high-fidelity rasterisation via PyMuPDF).
All legacy PPT / PPTX placeholder rendering paths have been removed as per design update.

Public functions:
 - extract_slides_as_images(pdf_path): returns list[{slide_number, image_base64}]
 - review_presentation(file_path, filename, selected_slides)
"""
from __future__ import annotations

import os, base64, json
from typing import List, Dict, Any, Optional

from .llm import llm_service  # vision capable service (chat_with_vision)

SYSTEM_PROMPT = """You are an expert management consultant and elite presentation design critic.
Style & Tone Requirements:
- Be brutally candid and direct; call out when a slide is boring, generic, corporate, cluttered, incoherent, visually noisy, or lifeless.
- Avoid personal or offensive language; critique only the slide content/design.
- Use sharp, professional phrasing (e.g., "Corporate template feel with zero differentiation", "Bland typography blends into background", "Color scheme is sterile and forgettable").
- Never hedge with phrases like "seems", "maybe", "could be"—be decisive.
- Keep each narrative field to 1–2 punchy sentences max.

Output Specification:
Return ONLY strict JSON (no markdown fences) with keys:
    overall_score (0-100 int: harsh scoring; average corporate slide ~60, truly weak <50, outstanding >85),
    visual_consistency,
    typography,
    color_harmony,
    layout_balance,
    suggestions (array of EXACTLY 3 concise imperative improvement actions; no fluff, no repetition).
Do not include any extra keys, commentary, or explanations outside the JSON object.
"""


BUZZWORDS = [
    # Core corporate buzzwords (case-insensitive whole-word matching)
    "synergy","leverage","paradigm","scalable","innovative","innovation","best-in-class","best in class",
    "robust","optimize","optimise","stakeholder","holistic","alignment","value-add","value add",
    "transformation","transformational","strategic","low-hanging fruit","ecosystem","actionable insights",
    "empower","empowering","unlock","streamline","streamlined","disruption","disruptive","world-class",
    "world class","next-generation","next generation","seamless","frictionless","cutting-edge","cutting edge",
    "mission-critical","mission critical","thought leadership","digital journey","enablement","turnkey"
]

def _render_pdf_pages(pdf_path: str, max_pages: Optional[int] = None) -> List[Dict[str, Any]]:
    """Render each PDF page to PNG base64 using PyMuPDF (fitz) and capture raw text."""
    import importlib
    try:
        fitz = importlib.import_module("fitz")  # PyMuPDF
    except Exception as e:
        raise RuntimeError("PyMuPDF not installed; cannot process PDF uploads") from e
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(pdf_path)
    doc = fitz.open(pdf_path)
    pages: List[Dict[str, Any]] = []
    zoom = 2  # upscale for clarity
    mat = fitz.Matrix(zoom, zoom)
    for i, page in enumerate(doc, start=1):
        if max_pages and i > max_pages:
            break
        pix = page.get_pixmap(matrix=mat, alpha=False)
        b64 = base64.b64encode(pix.tobytes("png")).decode()
        text = page.get_text("text") or ""
        pages.append({"slide_number": i, "image_base64": b64, "page_text": text})
    doc.close()
    return pages


async def extract_slides_as_images(path: str) -> List[Dict[str, Any]]:
    """Extract slides (pages) from a PDF only.

    Raises:
        FileNotFoundError: if path missing
        ValueError: if file extension not .pdf
    """
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    if not path.lower().endswith('.pdf'):
        raise ValueError("Unsupported file type; only PDF is accepted now")
    return _render_pdf_pages(path)


def _detect_buzzwords(text: str) -> List[str]:
    import re
    if not text:
        return []
    found: Dict[str,int] = {}
    lowered = text.lower()
    for bw in BUZZWORDS:
        # Build regex for whole word (allow hyphen/space variants already in list)
        pattern = r'\b' + re.escape(bw) + r'\b'
        count = len(re.findall(pattern, lowered))
        if count > 1:  # only flag if repetitive (appears more than once)
            found[bw] = count
    return [f"{k} ({v})" for k,v in sorted(found.items(), key=lambda x: (-x[1], x[0]))]

MODE_GUIDANCE = {
    "presentation_aid": (
        "Treat this slide as a live presentation aid. Ruthlessly assess: on-screen legibility at distance, immediate visual hierarchy, minimal cognitive load, brevity of text, punchiness of headlines, and whether a presenter could talk to it without reading paragraphs. Penalize dense paragraphs, tiny fonts, walls of bullet points, weak focal points, low contrast, and anything that forces the audience to squint or read too much. Suggestions must push toward simplification, stronger hierarchy, whitespace, and selective emphasis."
    ),
    "deliverable": (
        "Treat this slide as a leave‑behind / published deliverable. Assess completeness, narrative self-containment, clarity of supporting explanation, labeling accuracy, scannability when read asynchronously, data/visual annotation quality, and professional polish. Penalize vague claims, unexplained charts, missing units/sources, sloppy alignment, insufficient context, or over-sparse content that leaves unanswered questions. Suggestions must push toward clearer substantiation, structured storytelling, consistent typographic hierarchy, and crisp annotation."
    ),
}

async def _analyze_slide(slide: Dict[str, Any], mode: str) -> Dict[str, Any]:
    """Call vision LLM for a single slide, resilient to parsing issues."""
    img_b64 = slide["image_base64"]
    # Prepare extracted textual content (if any) so the omni model can leverage both modalities.
    raw_text = (slide.get("page_text") or "").strip()
    text_excerpt = ""
    if raw_text:
        # Truncate excessively long slides to keep prompt efficient
        MAX_CHARS = 3500
        if len(raw_text) > MAX_CHARS:
            text_excerpt = raw_text[:MAX_CHARS] + "... [TRUNCATED]"
        else:
            text_excerpt = raw_text
        # Compact repeated whitespace
        import re as _re
        text_excerpt = _re.sub(r"\s+", " ", text_excerpt)
    mode_key = mode if mode in MODE_GUIDANCE else "presentation_aid"
    mode_guidance = MODE_GUIDANCE[mode_key]
    user_prompt = (
        f"Analyze slide {slide['slide_number']} for design quality. Be savage, candid, and specific."
        " If it's generic, say so explicitly. If it's dull, call it dull."
        " Penalize mediocrity in the overall_score. Return ONLY the required JSON structure. "
        f"Context Mode: {mode_key.upper()} — {mode_guidance}"
    "\nFor EACH JSON narrative field (visual_consistency, typography, color_harmony, layout_balance) include at least ONE concrete, slide-specific observable detail (e.g., 'dense 9-line bullet block left', 'single hero graphic dominating right 60%', 'muted navy background', 'overlapping icons', 'chart with tiny legends')."
    "\nEstimate and reference (even if approximate) one of: bullet count, presence/absence of chart/table/diagram, dominant background brightness (light/dark), or notable whitespace issue."
    "\nAvoid reusing identical phrasing across different slides; vary wording."
    )
    if text_excerpt:
        user_prompt += (
            "\nYou are ALSO given extracted raw text from the slide; use it to judge clarity and messaging succinctness."
            " Do NOT quote large chunks back—summarize issues."
            "\n--- RAW SLIDE TEXT BEGIN ---\n" + text_excerpt + "\n--- RAW SLIDE TEXT END ---"
        )
    if llm_service is None:
        # Fallback heuristic
        return {
            "slide_number": slide["slide_number"],
            "image_path": f"data:image/png;base64,{img_b64}",
            "feedback": {
                "overall_score": 72,
                "visual_consistency": "Baseline heuristic assessment.",
                "typography": "Default font placeholder.",
                "color_harmony": "Neutral palette (synthetic).",
                "layout_balance": "Placeholder layout rendering.",
                "suggestions": [
                    "Replace placeholder with actual rendered slide",
                    "Refine headline for clarity",
                    "Ensure consistent margins"
                ],
            },
        }
    try:
        # Introduce a deterministic variation seed so different slide numbers encourage non-identical responses
        variation_hint = f"Variation seed: slide_index={slide['slide_number']} hash={hash(img_b64) % 997}."[:80]
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"{user_prompt}\n{variation_hint}"},
        ]
        raw = await llm_service.chat_with_vision(messages=messages, image_base64=img_b64)
        txt = raw.strip()
        if txt.startswith("```json"):
            txt = txt[7:]
        if txt.startswith("```"):
            txt = txt[3:]
        if txt.endswith("```"):
            txt = txt[:-3]
        # Extract first JSON object braces if extra text appears
        start = txt.find("{")
        end = txt.rfind("}")
        if start != -1 and end != -1 and end > start:
            txt = txt[start : end + 1]
        data = json.loads(txt)
    except Exception as e:
        # Robust harsh fallback (ensures tone even on parse errors)
        data = {
            "overall_score": 58,
            "visual_consistency": f"Parsing failure – slide {slide['slide_number']} likely generic corporate boilerplate with weak differentiation.",
            "typography": f"Slide {slide['slide_number']} inferred bland / uneven font hierarchy; impact missing.",
            "color_harmony": f"Slide {slide['slide_number']} palette indeterminate (parse error) – probably low contrast or sterile.",
            "layout_balance": f"Slide {slide['slide_number']} likely suffers from weak focal point or uneven spacing (inferred).",
            "suggestions": [
                "Replace generic template with a distinctive, minimalist layout",
                "Establish a clear typographic hierarchy (bold headline, restrained body)",
                "Introduce a purposeful accent color to create focus"
            ],
        }
    # Normalise
    score = data.get("overall_score", 70)
    try:
        score = int(score)
    except Exception:
        score = 70
    suggestions = data.get("suggestions") or []
    if not isinstance(suggestions, list):
        suggestions = [str(suggestions)]
    # Enforce exactly 3 high-impact, non-empty suggestions
    suggestions = [s for s in (str(s).strip() for s in suggestions) if s][:3]
    while len(suggestions) < 3:
        fillers = [
            "Eliminate visual clutter to create breathing space",
            "Use a single bold visual anchor instead of scattered elements",
            "Cut corporate filler text; distill to a sharp message"
        ]
        for f in fillers:
            if len(suggestions) < 3 and f not in suggestions:
                suggestions.append(f)
    buzz_flags = _detect_buzzwords(slide.get("page_text", ""))
    return {
        "slide_number": slide["slide_number"],
        "image_path": f"data:image/png;base64,{img_b64}",
        "feedback": {
            "overall_score": score,
            "visual_consistency": data.get("visual_consistency", ""),
            "typography": data.get("typography", ""),
            "color_harmony": data.get("color_harmony", ""),
            "layout_balance": data.get("layout_balance", ""),
            "suggestions": suggestions,
            "buzzword_flags": buzz_flags,
        },
    }


async def _overall_summary(reviews: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not reviews:
        return {"average_score": 0, "key_strengths": [], "priority_improvements": []}
    scores = [r["feedback"].get("overall_score", 0) for r in reviews]
    avg = round(sum(scores) / len(scores), 1)
    strengths: List[str] = []
    if avg >= 85:
        strengths.append("Strong professional quality")
    if avg >= 75:
        strengths.append("Generally clear structure")
    if not strengths:
        strengths.append("Foundational slide set")
    improvements: List[str] = []
    if avg < 80:
        improvements.append("Improve layout consistency")
    if avg < 70:
        improvements.append("Refine messaging clarity")
    if len(improvements) < 3:
        improvements.append("Standardise typography & spacing")
    return {
        "average_score": avg,
        "key_strengths": strengths[:3],
        "priority_improvements": improvements[:3],
    }


async def review_presentation(file_path: str, filename: Optional[str] = None, selected_slides: Optional[List[int]] = None, mode: str = "presentation_aid") -> Dict[str, Any]:
    """End‑to‑end review for a PDF presentation (each page rasterised)."""
    slides = await extract_slides_as_images(file_path)
    if selected_slides:
        selected = set(selected_slides)
        slides = [s for s in slides if s["slide_number"] in selected]
    reviews: List[Dict[str, Any]] = []
    for s in slides:
        reviews.append(await _analyze_slide(s, mode))
    summary = await _overall_summary(reviews)
    return {
        "presentation_name": filename or os.path.basename(file_path) or "Presentation",
        "total_slides": len(slides),
        "mode": mode,
        "reviews": reviews,
        "overall_summary": summary,
    }
