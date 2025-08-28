import os, sys
from fastapi.testclient import TestClient
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.main import app

client = TestClient(app)


def test_cleanup_propose_endpoint():
    payload = {
        "raw_points": [
            "Data exports are slow",
            "Slow data export process",
            "UI crashes sometimes",
        ],
        # similarity between first two may be <0.5; use 0.35 to encourage clustering
        "options": {"style_rules": {}, "thresholds": {"merge": 0.35}, "context": ""},
    }
    resp = client.post("/ai/pain-points/cleanup/propose", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "proposal" in data and "summary" in data
    assert data["summary"]["total_raw"] == 3

    # Apply actions
    apply_payload = {"proposal": data["proposal"]}
    resp2 = client.post("/ai/pain-points/cleanup/apply", json=apply_payload)
    assert resp2.status_code == 200
    applied = resp2.json()
    assert applied["count"] >= 2


def test_cleanup_report_endpoint():
    payload = {
        "raw_points": ["A slow job", "A slow job", "Another issue"],
        "options": {"style_rules": {}, "thresholds": {"merge": 0.9}, "context": ""},
    }
    prop = client.post("/ai/pain-points/cleanup/propose", json=payload).json()
    report_payload = {"proposal": prop["proposal"], "summary": prop["summary"]}
    r = client.post("/ai/pain-points/cleanup/report.xlsx", json=report_payload)
    assert r.status_code == 200
    assert r.content[:2] == b"PK"
    assert r.headers["content-type"].startswith("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
