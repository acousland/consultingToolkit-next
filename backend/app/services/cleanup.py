"""Pain Point Cleanup & Normalisation service (MVP).

Implements lightweight heuristic based clustering & rewrite suggestions without heavy
embedding dependencies (can be upgraded to sentence-transformers + FAISS later).

Design goals:
- Zero extra dependency beyond stdlib + pandas + existing llm adapter.
- Deterministic heuristics when LLM disabled.
- Clear data structure for proposal rows so frontend can adjust actions.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Tuple, Optional
import re
import io
import difflib
import pandas as pd

from .llm import llm
from langchain_core.messages import HumanMessage

WEAK_VERBS = {"be", "is", "are", "have", "has", "do", "does", "get"}
VAGUE_TERMS = {"improve", "better", "stuff", "things", "various", "misc", "some", "unclear"}
METRIC_PATTERN = re.compile(r"\b\d+[%]?\b")
COMPOUND_PATTERN = re.compile(r"\b(and|;|,\s*and)\b", re.IGNORECASE)
PROPER_NOUN_RATIO_THRESHOLD = 0.6  # simple heuristic

def normalise_sentence(s: str) -> str:
    s2 = (s or "").strip()
    s2 = re.sub(r"\s+", " ", s2)
    return s2

def _present_tense_enforcement(s: str) -> str:
    words = s.split()
    out: List[str] = []
    for w in words:
        lw = w.lower()
        if lw.endswith("ed") and len(lw) > 4 and lw[:-2] + "e" not in {"need", "speed"}:
            out.append(w[:-2])
        else:
            out.append(w)
    return " ".join(out)

def _remove_metrics(s: str) -> str:
    return METRIC_PATTERN.sub("", s).replace("  ", " ").strip()

def _remove_proper_nouns(s: str) -> str:
    tokens = s.split()
    proper = [t for t in tokens if t[:1].isupper() and t[1:].islower()]
    if tokens and len(proper) / max(1, len(tokens)) > PROPER_NOUN_RATIO_THRESHOLD:
        kept = [tokens[0]] + [t for t in tokens[1:] if not (t[:1].isupper() and t[1:].islower())]
        return " ".join(kept)
    return s

def apply_style_rules(s: str, rules: Dict[str, bool], max_length: Optional[int]) -> str:
    out = normalise_sentence(s)
    if rules.get("present_tense"):
        out = _present_tense_enforcement(out)
    if rules.get("remove_metrics"):
        out = _remove_metrics(out)
    if rules.get("remove_proper_nouns"):
        out = _remove_proper_nouns(out)
    if max_length and len(out.split()) > max_length:
        words = out.split()[:max_length]
        out = " ".join(words)
    return out.strip().rstrip(";,")

def similarity(a: str, b: str) -> float:
    return difflib.SequenceMatcher(a=a.lower(), b=b.lower()).ratio()

def cluster_sentences(sentences: List[str], threshold: float) -> List[List[int]]:
    clusters: List[List[int]] = []
    for idx, s in enumerate(sentences):
        placed = False
        for c in clusters:
            rep_idx = c[0]
            if similarity(sentences[rep_idx], s) >= threshold:
                c.append(idx)
                placed = True
                break
        if not placed:
            clusters.append([idx])
    return clusters

def heuristic_flags(s: str) -> Dict[str, bool]:
    low = s.lower()
    words = re.findall(r"[A-Za-z']+", low)
    verb_count = sum(1 for w in words if w not in WEAK_VERBS)
    weak = len(words) < 5 or verb_count == 0
    vague = any(t in low for t in VAGUE_TERMS)
    metric = bool(METRIC_PATTERN.search(s))
    compound = bool(COMPOUND_PATTERN.search(s)) and len(words) > 12
    return {"weak": weak, "vague": vague, "metric": metric, "compound": compound}

def choose_canonical(originals: List[str]) -> str:
    def score(s: str) -> Tuple[int, int]:
        vt = sum(1 for t in VAGUE_TERMS if t in s.lower())
        return (len(s.split()), vt)
    return sorted(originals, key=score)[0]

def llm_canonicalise(cluster: List[str], context: str, max_length: Optional[int]) -> Optional[str]:
    if llm is None:
        return None
    try:
        joined = "\n".join(f"- {c}" for c in cluster)
        prompt = (
            "You will receive a cluster of near-duplicate pain point statements.\n"
            "Return ONE canonical, concise sentence (Australian English, present tense, <= 28 words) combining the substance of all points without redundancy.\n"
            f"Context: {context[:300]}\n\nCluster:\n{joined}\n\nCanonical:"
        )
        msg = llm.invoke([HumanMessage(content=prompt)])
        out = getattr(msg, "content", "").strip().splitlines()[0]
        return out.strip("-• ")
    except Exception:
        return None

@dataclass
class ProposalRow:
    id: str
    original: str
    group_id: str
    proposed: str
    action: str  # Keep | Drop | Merge->ID | Rewrite
    rationale: str
    merged_ids: List[str]

def build_proposals(raw_points: List[str], options: Dict[str, Any]) -> Dict[str, Any]:
    style_rules = options.get("style_rules", {})
    thresholds = options.get("thresholds", {})
    merge_threshold = float(thresholds.get("merge", 0.80))
    additional_context = options.get("context", "")
    max_length = 28 if style_rules.get("max_length") else None

    cleaned = [apply_style_rules(s, style_rules, max_length) for s in raw_points]
    clusters = cluster_sentences(cleaned, merge_threshold)

    proposal: List[ProposalRow] = []
    exact_dupes = 0
    merge_candidates = 0
    near_duplicates = 0
    for ci, c in enumerate(clusters):
        originals = [cleaned[i] for i in c]
        canonical = choose_canonical(originals)
        llm_can = llm_canonicalise(originals, additional_context, max_length) if len(c) > 1 else None
        if llm_can and (max_length is None or len(llm_can.split()) <= max_length):
            canonical = llm_can
        if len(c) > 1:
            merge_candidates += 1
            near_duplicates += len(c) - 1
        group_id = f"G{ci+1}"
        primary_id = f"PP{c[0]+1}"
        for j, idx in enumerate(c):
            orig = cleaned[idx]
            rid = f"PP{idx+1}"
            flags = heuristic_flags(orig)
            if j == 0:
                act = "Rewrite" if flags.get("weak") or flags.get("vague") else "Keep"
                prop = canonical if act in {"Rewrite", "Keep"} else orig
                merged_ids = [f"PP{x+1}" for x in c[1:]]
            else:
                act = f"Merge->{primary_id}"
                prop = ""
                merged_ids = []
                if orig.lower() == originals[0].lower():
                    exact_dupes += 1
            rationale_parts = [k for k, v in flags.items() if v]
            if j > 0:
                rationale_parts.append("duplicate")
            rationale = ", ".join(rationale_parts) or ("canonical" if j == 0 else "")
            proposal.append(ProposalRow(id=rid, original=orig, group_id=group_id, proposed=prop, action=act, rationale=rationale, merged_ids=merged_ids))

    summary = {
        "total_raw": len(raw_points),
        "exact_duplicates": exact_dupes,
        "near_duplicates": near_duplicates,
        "merge_candidates": merge_candidates,
        "groups_detected": len(clusters),
    }
    return {"proposal": [asdict(r) for r in proposal], "summary": summary}

def apply_actions(proposal_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    final: List[Dict[str, Any]] = []
    kept_ids = set()
    for r in proposal_rows:
        act = r.get("action", "Keep")
        rid = r.get("id")
        if act.startswith("Merge->"):
            continue
        if act == "Drop":
            continue
        text = r.get("proposed") or r.get("original")
        if not text or rid in kept_ids:
            continue
        kept_ids.add(rid)
        final.append({"id": rid, "text": text})
    return {"clean_pain_points": final, "count": len(final)}

def export_report(proposal_rows: List[Dict[str, Any]], summary: Dict[str, Any]) -> bytes:
    df = pd.DataFrame(proposal_rows)
    df_final = pd.DataFrame(apply_actions(proposal_rows)["clean_pain_points"])
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name="Proposed")
        df_final.to_excel(writer, index=False, sheet_name="Final")
        pd.DataFrame([summary]).to_excel(writer, index=False, sheet_name="Summary")
    return bio.getvalue()
