Backend (FastAPI)

Local dev
1) python3 -m venv .venv && source .venv/bin/activate
2) pip install -r requirements.txt
3) export OPENAI_API_KEY=... ; uvicorn app.main:app --reload --port 8000

Endpoints
- GET /health
- POST /ai/use-case/evaluate
- POST /ai/ethics/review
- POST /ai/capabilities/describe
- POST /ai/applications/capabilities/map
- POST /ai/applications/logical-model
- POST /ai/applications/map
- POST /ai/engagement/plan
- POST /ai/strategy/capabilities/map
- POST /ai/strategy/tactics/generate
- POST /ai/data/conceptual-model
- POST /ai/data/application/map
- POST /ai/use-case/customise
