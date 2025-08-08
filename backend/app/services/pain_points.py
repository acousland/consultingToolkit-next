import asyncio
import io
from typing import List, Tuple

import pandas as pd
from langchain_core.messages import HumanMessage

from .llm import llm
from .prompts import pain_point_extraction_prompt


def _clean_model_output(raw: str) -> List[str]:
    """Parse LLM output into a clean list of pain-point sentences."""
    text = raw.strip()
    # Remove fenced code blocks
    if "```" in text:
        lines = text.split("\n")
        cleaned: List[str] = []
        in_code = False
        for line in lines:
            ls = line.strip()
            if ls.startswith("```"):
                in_code = not in_code
                continue
            if not in_code and ls:
                cleaned.append(ls)
        text = "\n".join(cleaned)
    # Remove simple JSON list artefacts
    text = (
        text.replace('["', "")
        .replace('"]', "")
        .replace('\",', "\n")
        .replace('"', "")
    )
    results: List[str] = []
    for line in text.splitlines():
        s = line.strip()
        # Strip bullets and numbering
        if s.startswith("•"):
            s = s[1:].strip()
        elif s.startswith("-"):
            s = s[1:].strip()
        else:
            parts = s.split(".")
            if parts and parts[0].isdigit():
                s = ".".join(parts[1:]).strip()
        if s and len(s) > 10:
            results.append(s)
    # Deduplicate preserving order
    seen = set()
    unique: List[str] = []
    for r in results:
        key = r.lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique


async def extract_from_texts(rows: List[str], additional_prompts: str = "", chunk_size: int = 20) -> List[str]:
    """Chunk input rows and aggregate pain points via LLM."""
    # Fallback: if LLM not configured, use naive parsing of rows
    if llm is None:
        seen = set()
        naive: List[str] = []
        for r in rows:
            s = str(r).strip()
            if len(s) < 12:
                continue
            if not s.endswith(('.', '!', '?')):
                s = s + '.'
            key = s.lower()
            if key not in seen:
                seen.add(key)
                naive.append(s)
        return naive

    all_points: List[str] = []
    total = len(rows)
    for i in range(0, total, max(1, chunk_size)):
        chunk = rows[i : i + chunk_size]
        chunk_text = "\n".join(str(x) for x in chunk)
        prompt = pain_point_extraction_prompt.format(
            additional_prompts=additional_prompts or "",
            data=chunk_text,
        )
        # Run blocking LLM call in executor
        msg = await asyncio.get_event_loop().run_in_executor(
            None, llm.invoke, [HumanMessage(content=prompt)]
        )
        all_points.extend(_clean_model_output(getattr(msg, "content", "")))
    # Final dedupe
    seen = set()
    unique: List[str] = []
    for r in all_points:
        key = r.lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique


def _read_dataframe_from_upload(filename: str, content: bytes, sheet_name: str | None) -> pd.DataFrame:
    name = (filename or "").lower()
    bio = io.BytesIO(content)
    if name.endswith(".csv"):
        return pd.read_csv(bio)
    if name.endswith((".xls", ".xlsx", ".xlsm")):
        xls = pd.ExcelFile(bio)
        sheet = sheet_name or xls.sheet_names[0]
        return pd.read_excel(xls, sheet_name=sheet)
    raise ValueError("Unsupported file type. Please upload CSV or Excel.")


def _concat_columns(df: pd.DataFrame, cols: List[str]) -> List[str]:
    if not cols:
        return []
    s = df[cols].astype(str).agg(" ".join, axis=1)
    return [str(x) for x in s.tolist()]


async def extract_from_file(
    filename: str,
    content: bytes,
    selected_columns: List[str],
    additional_prompts: str = "",
    chunk_size: int = 20,
    sheet_name: str | None = None,
) -> Tuple[List[str], List[str]]:
    df = _read_dataframe_from_upload(filename, content, sheet_name)
    available_cols = [str(c) for c in df.columns]
    # Validate selected columns
    if not selected_columns:
        raise ValueError("No columns selected for analysis.")
    missing = [c for c in selected_columns if c not in df.columns]
    if missing:
        raise ValueError(f"Selected columns not found: {', '.join(missing)}")
    rows = _concat_columns(df, selected_columns)
    points = await extract_from_texts(rows, additional_prompts, chunk_size)
    return points, available_cols
