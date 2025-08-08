import asyncio
import io
import re
import difflib
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


def _read_dataframe_from_upload(
    filename: str,
    content: bytes,
    sheet_name: str | None,
    header_row_index: int | None = None,
) -> pd.DataFrame:
    name = (filename or "").lower()
    bio = io.BytesIO(content)
    def _detect_header(df_nohdr: pd.DataFrame) -> int:
        # Heuristic: choose a row among the first 10 that looks most like headers
        limit = min(10, len(df_nohdr))
        best_idx = 0
        best_score = -1
        for i in range(limit):
            row = df_nohdr.iloc[i]
            vals = [str(x) if pd.notna(x) else "" for x in row.tolist()]
            def is_header_like(s: str) -> bool:
                s2 = s.strip()
                if not s2:
                    return False
                if len(s2) > 60:
                    return False
                if "\n" in s2 or "•" in s2:
                    return False
                letters = sum(c.isalpha() for c in s2)
                digits = sum(c.isdigit() for c in s2)
                if letters == 0:
                    return False
                if digits > letters:  # likely data or IDs
                    return False
                return True
            header_like = [v for v in vals if is_header_like(v)]
            uniq = len(set(v.strip().lower() for v in header_like if v.strip()))
            score = len(header_like) * 2 + uniq
            if score > best_score:
                best_score = score
                best_idx = i
        return best_idx

    if name.endswith(".csv"):
        if header_row_index is not None:
            return pd.read_csv(bio, header=header_row_index)
        # read without header then detect
        df_raw = pd.read_csv(bio, header=None)
        hdr_idx = _detect_header(df_raw)
        headers = [str(x) for x in df_raw.iloc[hdr_idx].tolist()]
        df = df_raw.iloc[hdr_idx + 1 :].reset_index(drop=True)
        df.columns = headers
        return df
    if name.endswith((".xls", ".xlsx", ".xlsm")):
        xls = pd.ExcelFile(bio)
        sheet = sheet_name or xls.sheet_names[0]
        if header_row_index is not None:
            return pd.read_excel(xls, sheet_name=sheet, header=header_row_index)
        df_raw = pd.read_excel(xls, sheet_name=sheet, header=None)
        hdr_idx = _detect_header(df_raw)
        headers = [str(x) for x in df_raw.iloc[hdr_idx].tolist()]
        df = df_raw.iloc[hdr_idx + 1 :].reset_index(drop=True)
        df.columns = headers
        return df
    raise ValueError("Unsupported file type. Please upload CSV or Excel.")


def _read_raw_table(
    filename: str,
    content: bytes,
    sheet_name: str | None,
) -> pd.DataFrame:
    """Read sheet with no header to allow custom header row selection."""
    name = (filename or "").lower()
    bio = io.BytesIO(content)
    if name.endswith(".csv"):
        return pd.read_csv(bio, header=None)
    if name.endswith((".xls", ".xlsx", ".xlsm")):
        xls = pd.ExcelFile(bio)
        sheet = sheet_name or xls.sheet_names[0]
        return pd.read_excel(xls, sheet_name=sheet, header=None)
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
    header_row_index: int | None = None,
) -> Tuple[List[str], List[str]]:
    df = _read_dataframe_from_upload(filename, content, sheet_name, header_row_index)
    available_cols = [str(c) for c in df.columns]
    # Validate selected columns
    if not selected_columns:
        raise ValueError("No columns selected for analysis.")

    def _norm(s: str) -> str:
        # Lowercase, replace ampersand with 'and', collapse whitespace, strip non-alnum except spaces -> then remove spaces
        s2 = (s or "").strip().lower()
        s2 = s2.replace("&", "and")
        s2 = re.sub(r"\s+", " ", s2)
        s2 = re.sub(r"[^a-z0-9 ]", "", s2)
        return s2.replace(" ", "")

    actual_map = {str(c): _norm(str(c)) for c in df.columns}
    # Build reverse index: normalized -> actual names (first wins)
    reverse = {}
    for k, v in actual_map.items():
        reverse.setdefault(v, k)

    resolved: List[str] = []
    missing: List[str] = []
    suggestions: List[str] = []
    for sel in selected_columns:
        key = _norm(str(sel))
        hit = reverse.get(key)
        if hit is None:
            missing.append(str(sel))
            # Suggest close matches by normalized similarity against available
            choices = list(actual_map.keys())
            close = difflib.get_close_matches(str(sel), choices, n=1, cutoff=0.6)
            if close:
                suggestions.append(f"{sel} -> {close[0]}")
        else:
            resolved.append(hit)

    if missing:
        # Targeted fallback: search top rows for a header row that matches requested columns
        try:
            raw = _read_raw_table(filename, content, sheet_name)
            limit = min(20, len(raw))
            best_idx = None
            best_cov = -1
            # Reuse normalizer
            def _norm(s: str) -> str:
                s2 = (s or "").strip().lower()
                s2 = s2.replace("&", "and")
                s2 = re.sub(r"\s+", " ", s2)
                s2 = re.sub(r"[^a-z0-9 ]", "", s2)
                return s2.replace(" ", "")
            targets = {_norm(t) for t in selected_columns}
            for i in range(limit):
                headers = [str(x) for x in raw.iloc[i].tolist()]
                norm_headers = {_norm(h) for h in headers}
                cov = len([t for t in targets if t in norm_headers])
                if cov > best_cov:
                    best_cov = cov
                    best_idx = i
                if cov == len(targets):
                    best_idx = i
                    break
            if best_idx is not None and best_cov > 0:
                headers = [str(x) for x in raw.iloc[best_idx].tolist()]
                df3 = raw.iloc[best_idx + 1 :].reset_index(drop=True)
                df3.columns = headers
                available_cols3 = [str(c) for c in df3.columns]
                actual_map3 = {str(c): _norm(str(c)) for c in df3.columns}
                reverse3 = {}
                for k, v in actual_map3.items():
                    reverse3.setdefault(v, k)
                resolved3: List[str] = []
                for sel in selected_columns:
                    hit = reverse3.get(_norm(sel))
                    if hit:
                        resolved3.append(hit)
                if len(resolved3) == len(selected_columns):
                    rows = _concat_columns(df3, resolved3)
                    points = await extract_from_texts(rows, additional_prompts, chunk_size)
                    return points, available_cols3
        except Exception:
            pass

        # Fallback: try auto-detected header row if user-specified header index was wrong
        if header_row_index is not None:
            df2 = _read_dataframe_from_upload(filename, content, sheet_name, None)
            available_cols2 = [str(c) for c in df2.columns]
            actual_map2 = {str(c): _norm(str(c)) for c in df2.columns}
            reverse2 = {}
            for k, v in actual_map2.items():
                reverse2.setdefault(v, k)
            resolved2: List[str] = []
            missing2: List[str] = []
            for sel in selected_columns:
                key = _norm(str(sel))
                hit = reverse2.get(key)
                if hit is None:
                    missing2.append(str(sel))
                else:
                    resolved2.append(hit)
            if not missing2 and resolved2:
                rows = _concat_columns(df2, resolved2)
                points = await extract_from_texts(rows, additional_prompts, chunk_size)
                return points, available_cols2

        avail_preview = ", ".join(available_cols[:20]) + ("..." if len(available_cols) > 20 else "")
        hint = f" Did you mean: {', '.join(suggestions)}" if suggestions else ""
        raise ValueError(
            f"Selected columns not found: {', '.join(missing)}. Available: {avail_preview}.{hint}"
        )

    rows = _concat_columns(df, resolved)
    points = await extract_from_texts(rows, additional_prompts, chunk_size)
    return points, available_cols
