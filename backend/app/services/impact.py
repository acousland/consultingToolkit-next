import io
from typing import List, Dict, Tuple

import pandas as pd
from langchain_core.messages import HumanMessage

from .llm import llm
from .prompts import impact_estimation_prompt


def _read_sheet(filename: str, content: bytes, sheet_name: str | None) -> pd.DataFrame:
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


def _parse_impact_lines(raw: str) -> Dict[str, Dict[str, str]]:
    out: Dict[str, Dict[str, str]] = {}
    for line in raw.splitlines():
        s = line.strip()
        if not s or "->" not in s:
            continue
        try:
            left, right = s.split("->", 1)
            pid = left.strip()
            parts = [p.strip() for p in right.split("|")]
            rec: Dict[str, str] = {}
            for p in parts:
                if ":" in p:
                    k, v = p.split(":", 1)
                    rec[k.strip().upper()] = v.strip()
            if rec:
                out[pid] = rec
        except Exception:
            continue
    return out


async def estimate_impact(
    pain_filename: str,
    pain_content: bytes,
    pain_id_column: str,
    pain_text_columns: List[str],
    additional_context: str = "",
    batch_size: int = 15,
    sheet_name: str | None = None,
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
        return pd.DataFrame({
            "Pain_Point_ID": ids,
            "SEVERITY": ["5"] * len(ids),
            "FREQUENCY": ["5"] * len(ids),
            "EFFORT": ["5"] * len(ids),
            "COST": ["Medium"] * len(ids),
            "COMPOSITE": ["50"] * len(ids),
            "Pain_Point_Text": texts,
        })

    rows: List[Tuple[str, str, str, str, str, str]] = []
    for i in range(0, len(ids), max(1, batch_size)):
        batch_ids = ids[i : i + batch_size]
        batch_txts = texts[i : i + batch_size]
        pain_points_text = "\n".join(f"- {pid}: {txt}" for pid, txt in zip(batch_ids, batch_txts))
        prompt = impact_estimation_prompt.format(
            pain_points=pain_points_text,
            additional_context=additional_context or "",
        )
        out = llm.invoke([HumanMessage(content=prompt)])
        raw = getattr(out, "content", "") or ""
        parsed = _parse_impact_lines(raw)
        for pid in batch_ids:
            rec = parsed.get(pid, {})
            sev = rec.get("SEVERITY", "5")
            freq = rec.get("FREQUENCY", "5")
            eff = rec.get("EFFORT", "5")
            cost = rec.get("COST", "Medium")
            comp = rec.get("COMPOSITE", "50")
            rows.append((pid, sev, freq, eff, cost, comp))

    res = pd.DataFrame(rows, columns=["Pain_Point_ID", "SEVERITY", "FREQUENCY", "EFFORT", "COST", "COMPOSITE"])
    res = res.merge(pd.DataFrame({"Pain_Point_ID": ids, "Pain_Point_Text": texts}), on="Pain_Point_ID", how="left")
    return res


def dataframe_to_xlsx_bytes(df: pd.DataFrame) -> bytes:
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False)
    return bio.getvalue()
