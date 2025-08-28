"""Service logic for AI Use Case Customiser (context summarisation & evaluation).

Implements:
- Summarise long company context (cached by hash)
- Evaluate list of AI use cases against company context with 1–10 scoring

Design notes:
* Strict JSON prompts reduce parsing errors. We still include a light
  repair step if model returns surrounding prose/markdown.
* Concurrency bounded by an asyncio.Semaphore to avoid rate spikes.
* Simple in‑memory cache; for multi‑process deployments replace with Redis.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from .llm import llm

SUMMARY_THRESHOLD = 1500  # chars
SUMMARY_MAX_WORDS = 300
EVAL_MAX_CONCURRENCY = 8

_summary_cache: Dict[str, str] = {}


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


async def summarise_company_context(context: str, force: bool = False) -> Dict[str, Any]:
    """Summarise company context if length exceeds threshold.

    Returns dict with keys: summary, original_length, summary_length, summarised, cached.
    """
    context = context.strip()
    original_length = len(context)
    cache_key = _hash(context)

    if not force and original_length <= SUMMARY_THRESHOLD:
        return {
            "summary": context,
            "original_length": original_length,
            "summary_length": original_length,
            "summarised": False,
            "cached": False,
        }

    if not force and cache_key in _summary_cache:
        summary = _summary_cache[cache_key]
        return {
            "summary": summary,
            "original_length": original_length,
            "summary_length": len(summary),
            "summarised": True,
            "cached": True,
        }

    if llm is None:
        # Fallback: truncate
        truncated = context[:2000]
        _summary_cache[cache_key] = truncated
        return {
            "summary": truncated,
            "original_length": original_length,
            "summary_length": len(truncated),
            "summarised": True,
            "cached": False,
        }

    system = SystemMessage(content="You are a business analyst creating concise factual summaries.")
    user = HumanMessage(
        content=(
            f"Create a concise summary (MAX {SUMMARY_MAX_WORDS} words) of the company information for the sole purpose of evaluating AI use cases. "
            "Include only: Industry & Business Model; Key Operations & Size; Strategic Priorities; Technology/Data Maturity; Principal Challenges.\n\n"
            f"Company Information:\n{context}\n\nStrictly output plain text (no lists longer than 5 items)."
        )
    )
    try:
        resp = await asyncio.get_event_loop().run_in_executor(None, llm.invoke, [system, user])
        summary = (getattr(resp, "content", "") or "").strip()
        if not summary:
            summary = context[:2000]
    except Exception:
        summary = context[:2000]
    _summary_cache[cache_key] = summary
    return {
        "summary": summary,
        "original_length": original_length,
        "summary_length": len(summary),
        "summarised": True,
        "cached": False,
    }


@dataclass
class UseCaseInput:
    id: str
    description: str


async def evaluate_use_cases(
    company_context: str,
    use_cases: List[UseCaseInput],
    parallelism: int = 4,
    temperature: Optional[float] = None,
) -> Dict[str, Any]:
    """Evaluate use cases with 1–10 scoring.

    Returns dict with evaluated list & stats.
    """
    company_context = company_context.strip()
    parallelism = max(1, min(EVAL_MAX_CONCURRENCY, parallelism))

    if not use_cases:
        return {"evaluated": [], "stats": {"count": 0}}

    # If no LLM configured produce heuristic scores.
    if llm is None:
        evaluated = []
        for uc in use_cases:
            base = ((len(uc.description) % 90) + 10)  # Range 10-99
            evaluated.append(
                {
                    "id": uc.id,
                    "description": uc.description,
                    "score": base,
                    "reasoning": "Placeholder heuristic score (LLM disabled).",
                    "raw_response": None,
                }
            )
        evaluated.sort(key=lambda x: x["score"], reverse=True)
        return _finalise(evaluated)

    semaphore = asyncio.Semaphore(parallelism)

    async def _eval(uc: UseCaseInput) -> Dict[str, Any]:
        prompt = (
            "You are an AI strategy consultant. Evaluate the AI use case for this specific company.\n"  # noqa: E501
            "Return ONLY valid JSON with keys: score (int 1-100), reasoning (string). No markdown, no extra keys.\n\n"  # noqa: E501
            f"Company Context:\n{company_context}\n\nUse Case ID: {uc.id}\nDescription: {uc.description}\n\n"
            "Scoring Guidance (1=very low benefit/misaligned, 100=exceptional strategic fit & high value, feasible).\n"  # noqa: E501
            "Assess: Strategic Alignment, Business Impact Potential, Technical Feasibility, Implementation Complexity (inverse), Risk vs Reward.\n"  # noqa: E501
            "Choose a single integer 1-100. Output JSON now:"
        )

        async with semaphore:
            try:
                resp = await asyncio.get_event_loop().run_in_executor(
                    None, llm.invoke, [HumanMessage(content=prompt)]
                )
                raw = (getattr(resp, "content", "") or "").strip()
                score, reasoning = _parse_eval_json(raw)
                return {
                    "id": uc.id,
                    "description": uc.description,
                    "score": score,
                    "reasoning": reasoning,
                    "raw_response": raw,
                }
            except Exception as e:
                return {
                    "id": uc.id,
                    "description": uc.description,
                    "score": 50,  # Mid-range fallback for 1-100 scale
                    "reasoning": f"Evaluation error: {e}",
                    "raw_response": None,
                }

    tasks = [_eval(uc) for uc in use_cases]
    evaluated = await asyncio.gather(*tasks)
    evaluated.sort(key=lambda x: x["score"], reverse=True)
    return _finalise(evaluated)


def _parse_eval_json(raw: str) -> tuple[int, str]:
    """Extract score & reasoning from model raw output."""
    # Trim to outermost braces
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end > start:
        candidate = raw[start : end + 1]
    else:
        candidate = raw
    try:
        data = json.loads(candidate)
        score = int(data.get("score", 50))  # Mid-range fallback for 1-100 scale
        reasoning = str(data.get("reasoning", "No reasoning provided")).strip()
    except Exception:
        # Fallback regex
        import re

        m = re.search(r"score\D(\d{1,3})", raw, re.IGNORECASE)  # Allow up to 3 digits
        score = int(m.group(1)) if m else 50
        reasoning = raw[:400]
    if score < 1:
        score = 1
    if score > 100:  # Update max score to 100
        score = 100
    return score, reasoning or "No reasoning provided"


def _finalise(evaluated: List[Dict[str, Any]]) -> Dict[str, Any]:
    scores = [e["score"] for e in evaluated] or [0]
    stats = {
        "count": len(evaluated),
        "avg": round(sum(scores) / len(scores), 2) if evaluated else 0,
        "min": min(scores) if evaluated else 0,
        "max": max(scores) if evaluated else 0,
        "high_threshold": 80,  # Adjust threshold for 1-100 scale
        "high_count": len([s for s in scores if s >= 80]),
    }
    # Rank assignment
    for idx, rec in enumerate(evaluated, 1):
        rec["rank"] = idx
    return {"evaluated": evaluated, "stats": stats}


def build_excel_bytes(evaluated: List[Dict[str, Any]], stats: Dict[str, Any]) -> bytes:
    import pandas as pd
    import io

    df = pd.DataFrame(evaluated)[
        ["rank", "id", "score", "description", "reasoning"]
    ].rename(
        columns={
            "rank": "Rank",
            "id": "Use Case ID",
            "score": "Score",
            "description": "Description",
            "reasoning": "Reasoning",
        }
    )
    stats_df = (
        pd.DataFrame(
            [
                {
                    "Metric": k.replace("_", " ").title(),
                    "Value": v,
                }
                for k, v in stats.items()
            ]
        )
    )
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="xlsxwriter") as writer:
        df.to_excel(writer, sheet_name="Evaluations", index=False)
        stats_df.to_excel(writer, sheet_name="Summary", index=False)
    return bio.getvalue()
