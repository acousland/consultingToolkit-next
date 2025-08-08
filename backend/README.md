Backend (FastAPI)

Local dev
1) python3 -m venv .venv && source .venv/bin/activate
2) pip install -r requirements.txt
3) export OPENAI_API_KEY=... ; uvicorn app.main:app --reload --port 8000

Endpoints
- GET /health
- POST /ai/evaluate { description }
- POST /ai/ethics { description }
