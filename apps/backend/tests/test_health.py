import os, sys
from fastapi.testclient import TestClient
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.main import app

client = TestClient(app)


def test_health_endpoint_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "backend_version" in data
    assert "build_time" in data


def test_ai_router_ping():
    response = client.get("/ai/ping")
    assert response.status_code == 200
    assert response.json() == {"message": "AI router alive"}
