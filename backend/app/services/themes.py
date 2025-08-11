import io
from typing import List, Dict, Tuple, Optional

import pandas as pd
from langchain_core.messages import HumanMessage

from .llm import llm
from .prompts import theme_perspective_mapping_prompt


PREDEFINED_THEMES = [
    "Manual Processes", "No Single Source of Truth", "Skills & Capacity",
    "Technology Limitations", "Vendor Dependency", "Risk & Compliance",
    "Market Pressures", "Capacity Constraints", "Project Mobilisation",
    "Governance & Decision-Making", "Integration / Data Silos", "Process Improvement",
    "Technology Opportunity", "Cross-Service Alignment", "Budget & Investment",
    "Culture & Change", "Capacity Planning", "Inefficient Governance",
    "Process Timing", "Process Inconsistencies",
]

PREDEFINED_PERSPECTIVES = [
    "Process", "Data / Information", "People", "Technology",
    "Risk", "Market", "Governance",
]


def _read_sheet(filename: str, content: bytes, sheet_name: Optional[str]) -> pd.DataFrame:
    name = (filename or "").lower()
    bio = io.BytesIO(content)
    if name.endswith(".csv"):
        return pd.read_csv(bio)
    if name.endswith((".xls", ".xlsx", ".xlsm")):
        xls = pd.ExcelFile(bio)
        sheet = sheet_name or xls.sheet_names[0]
        return pd.read_excel(xls, sheet_name=sheet)
    raise ValueError("Unsupported file type. Please upload CSV or Excel.")


def _concat_text_cols(df: pd.DataFrame, cols: List[str]) -> List[str]:
    if not cols:
        return []
    s = df[cols].astype(str).agg(" ".join, axis=1)
    return [str(x) for x in s.tolist()]


def _format_batch(pain_ids: List[str], pain_texts: List[str]) -> str:
    lines = []
    for pid, ptxt in zip(pain_ids, pain_texts):
        lines.append(f"- {pid}: {ptxt}")
    return "\n".join(lines)


def _parse_theme_perspective_lines(raw: str) -> Dict[str, Tuple[str, str]]:
    mapping: Dict[str, Tuple[str, str]] = {}
    for line in raw.splitlines():
        s = line.strip()
        if not s or "->" not in s:
            continue
        try:
            left, right = s.split("->", 1)
            pid = left.strip().replace("**", "").replace("*", "").replace("`", "").strip().strip('"').strip("'")
            theme = "Unknown"
            perspective = "Unknown"
            upper = right.upper()
            if "THEME:" in upper:
                t_start = upper.find("THEME:") + 6
                t_part = right[t_start:]
                if "|" in t_part:
                    theme = t_part.split("|", 1)[0].strip()
                elif "PERSPECTIVE:" in upper:
                    theme = t_part.split("PERSPECTIVE:", 1)[0].strip()
                else:
                    theme = t_part.strip()
            if "PERSPECTIVE:" in upper:
                p_start = upper.find("PERSPECTIVE:") + 12
                perspective = right[p_start:].strip()
            theme = theme.replace("**", "").replace("*", "").replace("`", "").strip().strip('"').strip("'")
            perspective = perspective.replace("**", "").replace("*", "").replace("`", "").strip().strip('"').strip("'")
            if theme and perspective and theme != "Unknown" and perspective != "Unknown":
                mapping[str(pid)] = (theme, perspective)
        except Exception:
            continue
    return mapping


async def map_themes_perspectives(
    filename: str,
    content: bytes,
    id_column: str,
    text_columns: List[str],
    additional_context: str = "",
    batch_size: int = 10,
    sheet_name: Optional[str] = None,
) -> pd.DataFrame:
    df = _read_sheet(filename, content, sheet_name)
    if id_column not in df.columns:
        raise ValueError(f"ID column not found: {id_column}")
    for c in text_columns:
        if c not in df.columns:
            raise ValueError(f"Text column not found: {c}")

    ids = [str(x) for x in df[id_column].astype(str).tolist()]
    texts = _concat_text_cols(df, text_columns)

    # Fallback: if LLM missing, return Unknowns with provided defaults
    if llm is None:
        return pd.DataFrame(
            {
                "Pain_Point_ID": ids,
                "Theme": [PREDEFINED_THEMES[0] if PREDEFINED_THEMES else "Unknown"] * len(ids),
                "Perspective": [PREDEFINED_PERSPECTIVES[0] if PREDEFINED_PERSPECTIVES else "Unknown"] * len(ids),
                "Pain_Point_Text": texts,
            }
        )

    all_rows: List[Tuple[str, str, str]] = []
    for i in range(0, len(ids), max(1, batch_size)):
        batch_ids = ids[i : i + batch_size]
        batch_txts = texts[i : i + batch_size]
        pain_points_text = _format_batch(batch_ids, batch_txts)
        prompt = theme_perspective_mapping_prompt.format(
            pain_points=pain_points_text,
            themes=", ".join(PREDEFINED_THEMES),
            perspectives=", ".join(PREDEFINED_PERSPECTIVES),
            additional_context=additional_context or "",
        )
        out = llm.invoke([HumanMessage(content=prompt)])
        raw = getattr(out, "content", "") or ""
        mapping = _parse_theme_perspective_lines(raw)
        for pid, theme_persp in mapping.items():
            theme, persp = theme_persp
            # attempt to find original text
            try:
                idx = batch_ids.index(pid)
                ptxt = batch_txts[idx]
            except ValueError:
                ptxt = ""
            all_rows.append((pid, theme, persp, ptxt))

    if not all_rows:
        # Return empty DataFrame with expected columns
        return pd.DataFrame({"Pain_Point_ID": [], "Theme": [], "Perspective": [], "Pain_Point_Text": []})

    return pd.DataFrame(all_rows, columns=["Pain_Point_ID", "Theme", "Perspective", "Pain_Point_Text"])
