import os
import sys
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ai_router_ping():
    response = client.get("/ai/ping")
    assert response.status_code == 200
    assert response.json() == {"message": "AI router alive"}
