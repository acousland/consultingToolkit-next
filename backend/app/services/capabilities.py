import io
from typing import List, Dict, Tuple, Optional

import pandas as pd
from langchain_core.messages import HumanMessage

from .llm import llm
from .prompts import pain_point_capability_mapping_prompt


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


def _parse_capability_lines(raw: str) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for line in raw.splitlines():
        s = line.strip()
        if not s or "->" not in s:
            continue
        try:
            left, right = s.split("->", 1)
            pid = left.strip().replace("**", "").replace("*", "").replace("`", "").strip().strip('"').strip("'")
            cap = right.strip().split()[0].strip().strip(',')
            mapping[str(pid)] = cap
        except Exception:
            continue
    return mapping


async def map_capabilities(
    pain_filename: str,
    pain_content: bytes,
    pain_id_column: str,
    pain_text_columns: List[str],
    capabilities_text: str,
    additional_context: str = "",
    batch_size: int = 15,
    sheet_name: Optional[str] = None,
) -> pd.DataFrame:
    df = _read_sheet(pain_filename, pain_content, sheet_name)
    if pain_id_column not in df.columns:
        raise ValueError(f"ID column not found: {pain_id_column}")
    for c in pain_text_columns:
        if c not in df.columns:
            raise ValueError(f"Text column not found: {c}")

    ids = [str(x) for x in df[pain_id_column].astype(str).tolist()]
    texts = _concat_text_cols(df, pain_text_columns)

    if llm is None:
        # naive fallback: map all to NONE
        return pd.DataFrame({
            "Pain_Point_ID": ids,
            "Capability_ID": ["NONE"] * len(ids),
            "Pain_Point_Text": texts,
        })

    rows: List[Tuple[str, str, str]] = []
    for i in range(0, len(ids), max(1, batch_size)):
        batch_ids = ids[i : i + batch_size]
        batch_txts = texts[i : i + batch_size]
        pain_points_text = "\n".join(f"- {pid}: {txt}" for pid, txt in zip(batch_ids, batch_txts))
        prompt = pain_point_capability_mapping_prompt.format(
            pain_points=pain_points_text,
            capabilities=capabilities_text,
            additional_context=additional_context or "",
        )
        out = llm.invoke([HumanMessage(content=prompt)])
        raw = getattr(out, "content", "") or ""
        mapping = _parse_capability_lines(raw)
        for pid in batch_ids:
            cap = mapping.get(pid, "NONE")
            ptxt = batch_txts[batch_ids.index(pid)] if pid in batch_ids else ""
            rows.append((pid, cap, ptxt))

    return pd.DataFrame(rows, columns=["Pain_Point_ID", "Capability_ID", "Pain_Point_Text"])


def dataframe_to_xlsx_bytes(df: pd.DataFrame) -> bytes:
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False)
    return bio.getvalue()
