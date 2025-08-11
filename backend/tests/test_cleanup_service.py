import json
import os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.services.cleanup import build_proposals, apply_actions, export_report


def test_build_proposals_basic_cluster():
    raw = [
        "Slow report generation in finance system",
        "Finance system reports generate slowly",
        "Unrelated issue about login",
    ]
    # difflib similarity between first two ~0.359 so set merge threshold lower
    opts = {"style_rules": {}, "thresholds": {"merge": 0.35}, "context": ""}
    result = build_proposals(raw, opts)
    proposal = result["proposal"]
    # Expect 3 rows
    assert len(proposal) == 3
    # Two should be in same group id
    group_ids = {p["group_id"] for p in proposal}
    assert len(group_ids) == 2
    summary = result["summary"]
    assert summary["total_raw"] == 3
    assert summary["merge_candidates"] >= 1


def test_apply_actions_merges_and_keep():
    raw = ["Duplicate A", "Duplicate A", "Different B"]
    opts = {"style_rules": {}, "thresholds": {"merge": 0.9}, "context": ""}
    result = build_proposals(raw, opts)
    cleaned = apply_actions(result["proposal"])
    # Should keep canonical + Different B -> 2 results
    assert cleaned["count"] == 2
    texts = [r["text"].lower() for r in cleaned["clean_pain_points"]]
    assert any("duplicate a" in t for t in texts)
    assert any("different b" in t for t in texts)


def test_export_report_excel_bytes():
    raw = ["Issue one", "Issue two similar", "Issue two similar"]
    opts = {"style_rules": {}, "thresholds": {"merge": 0.8}, "context": ""}
    result = build_proposals(raw, opts)
    xbytes = export_report(result["proposal"], result["summary"])
    assert isinstance(xbytes, (bytes, bytearray))
    # XLSX files start with PK zip header
    assert xbytes[:2] == b"PK"
