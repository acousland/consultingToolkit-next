# Consulting Toolkit (Next.js + FastAPI) – Architecture

Last updated: 2025-08-08

## High-level design

- Frontend: Next.js 15 (App Router), React 19, Tailwind v4 (dark-only). Client pages use a small typed fetch wrapper (`frontend/src/lib/api.ts`). For uploads and downloads, Edge API routes in Next.js proxy to FastAPI to simplify multipart and content-disposition handling.
- Backend: FastAPI with modular routers under `backend/app/routers`. LLM functionality is provided via LangChain (ChatOpenAI) behind a small adapter in `backend/app/services/llm.py`. Domain logic lives in `backend/app/services/*` and is consumed by routers.
- Config: The API auto-loads environment from `.env` via `python-dotenv`. Docker Compose sets sane defaults and healthchecks for both services.
- Goal: Port key features from the Streamlit reference app into a production-ready client/server web app with clear separation, stateless endpoints, and reusable services.

## Modules and routes

- AI Router (`/ai`):
  - GET `/ai/ping`: router health
  - GET `/ai/llm/status`: LLM enabled/provider/model/temperature
  - GET `/ai/llm/health`: minimal round-trip model check (if enabled)
  - POST `/ai/use-case/evaluate`: basic evaluator (MVP, heuristics fallback)
  - POST `/ai/ethics/review`: basic ethics review (MVP, heuristics fallback)
  - POST `/ai/capabilities/describe`: generate capability descriptions (LLM with fallback)
  - POST `/ai/applications/capabilities/map`: application to capability mapping
  - POST `/ai/applications/logical-model`: logical application model generator
  - POST `/ai/applications/map`: individual application mapping
  - POST `/ai/engagement/plan`: engagement touchpoint planning
  - POST `/ai/strategy/capabilities/map`: strategy to capability mapping
  - POST `/ai/strategy/tactics/generate`: tactics to strategies generator
  - POST `/ai/data/conceptual-model`: conceptual data model generator
  - POST `/ai/data/application/map`: data-application mapping
  - POST `/ai/use-case/customise`: AI use case customiser
  - Pain Points:
    - POST `/ai/pain-points/extract/text`
    - POST `/ai/pain-points/extract/file`
    - POST `/ai/pain-points/themes/map` and `/ai/pain-points/themes/map.xlsx`
    - POST `/ai/pain-points/capabilities/map` and `/ai/pain-points/capabilities/map.xlsx`
    - POST `/ai/pain-points/impact/estimate` and `/ai/pain-points/impact/estimate.xlsx`

## Services

- `services/llm.py`: central LLM adapter (reads OPENAI_API_KEY, OPENAI_MODEL, OPENAI_TEMPERATURE), provides helpers and a disabled-mode fallback.
- `services/pain_points.py`: parsing (CSV/XLSX), cleaning, chunking/aggregation, mapping helpers, and XLSX writers.
- Additional service modules handle themes, capability mapping/description, and impact scoring.

## Frontend pages

- `/` – dark-only landing with hero + toolkit cards (use-case cards moved under Data & AI toolkit)
- Toolkit hubs – `/toolkits/{pain-points,capabilities,applications,data-ai,engagement,strategy}`
- Pain Points – `/pain-points`, `/pain-points/themes`, `/pain-points/capabilities`, `/pain-points/impact`
- Capabilities – `/capabilities/describe`
- Applications – `/applications/capabilities`, `/applications/logical-model`, `/applications/map`
- Engagement – `/engagement/plan`
- Strategy – `/strategy/capabilities`, `/strategy/tactics`
- Data & AI – `/toolkits/data-ai/use-cases/{evaluate,ethics}`, `/data/conceptual-model`, `/data/application-map`, `/use-cases/customise`

Edge API routes (proxy to FastAPI):
- `/api/ai/pain-points/{extract/file, themes/map, themes/map.xlsx, capabilities/map, capabilities/map.xlsx, impact/estimate, impact/estimate.xlsx}`
- `/api/ai/use-case/evaluate`, `/api/ai/ethics/review`, `/api/ai/capabilities/describe`
- `/api/ai/applications/{capabilities/map, logical-model, map}`
- `/api/ai/engagement/plan`
- `/api/ai/strategy/{capabilities/map, tactics/generate}`
- `/api/ai/data/{conceptual-model, application/map}`
- `/api/ai/use-case/customise`

## Porting status (from Streamlit app)

1) Pain Point Toolkit
- [x] Pain Point Extraction (text + file upload, chunking, dedupe)
- [x] Theme & Perspective Mapping
- [x] Capability Mapping (ID-based) + Excel export
- [x] Pain Point Impact Estimation

2) Capability Toolkit
- [x] Capability Description Generation

3) Applications Toolkit
 - [x] Application → Capability Mapping
 - [x] Logical Application Model Generator
 - [x] Individual Application Mapping

4) Engagement Planning Toolkit
 - [x] Engagement Touchpoint Planning

5) Strategy and Motivations Toolkit
 - [x] Strategy → Capability Mapping
 - [x] Tactics to Strategies Generator

6) Data, Information, and AI Toolkit
 - [x] Conceptual Data Model Generator
 - [x] Data-Application Mapping
 - [x] AI Use Case Customiser
  - [x] Use Case Evaluation (MVP)
  - [x] Use Case Ethics Review (MVP)

## Key decisions

- Stateless API: All prompt work runs server-side. Chunking is parameterised and handled in services to manage token limits.
- Output normalisation: Clean/dedupe server-side and return tabular JSON; XLSX variants are produced by the API for convenient exports.
- Upload/download proxy: Next.js Edge API routes proxy multipart and binary responses to FastAPI (simplifies local dev and CORS); production can call FastAPI directly behind an API gateway.
- Config via `.env`: Backend loads `.env` (python-dotenv); safe defaults allow heuristic fallbacks when LLM is disabled.

## Environment

- Backend: `OPENAI_API_KEY` (optional; if missing, endpoints use heuristics), `OPENAI_MODEL` (default gpt-4o-mini), `OPENAI_TEMPERATURE` (default 0.2). `.env` is auto-loaded.
- Frontend: `NEXT_PUBLIC_API_BASE_URL` (defaults to http://127.0.0.1:8000 for local dev; in Docker, set to http://api:8000).

## Open items / next steps

 - Refine toolkit prompts and add server-side validation.
- Add server-side validation and basic rate limiting.
- Add unit tests for services (parsing/cleaning/mapping; XLSX generation).
- Consider background jobs (RQ/Celery) for large files; introduce job status endpoints.
- Optional: auth and per-tenant configuration.

## Run with Docker

Prereqs: Docker Desktop installed and running.

Steps:
1) Optional: export your OpenAI API key
  - macOS/Linux: `export OPENAI_API_KEY=sk-...`
2) Build and start
  - Default ports: API 8000, Web 3000
  - If 3000 is in use, override: `export WEB_PORT=8001` (or any free port)
  - `docker compose up --build -d`
3) Access
  - API: http://localhost:8000 (docs: http://localhost:8000/docs)
  - Web: http://localhost:${WEB_PORT:-3000}
4) Stop
  - `docker compose down`

Notes:
- The frontend image is built on `node:20-bookworm-slim` for stable native deps.
- Compose includes healthchecks for API (`/health`) and Web (root page).
- In Docker, the frontend points to the API container via `NEXT_PUBLIC_API_BASE_URL=http://api:8000`.
- Without an OpenAI key, LLM-backed endpoints degrade to deterministic heuristics for smoke tests.
