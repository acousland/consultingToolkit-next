# Consulting Toolkit (Next.js + FastAPI) – Architecture

Last updated: 2025-08-08

## High-level design

- Frontend: Next.js 15 (App Router), React 19, Tailwind v4. Client pages call the backend API via a typed fetch wrapper. For file uploads, a lightweight Next.js API route proxies to the backend to avoid CORS/multipart hassles during local dev.
- Backend: FastAPI with modular routers. LLM functionality provided via LangChain's ChatOpenAI, configured once in `services/llm.py`. Core domain services live under `backend/app/services/*` and are thin, testable functions used by routers.
- Goals: Port features from the Streamlit reference app (`migration_reference`) into a production-ready client/server web app with clear separation, stateless endpoints, and reusable prompts/services.

## Modules and routes

- AI Router (`/ai`):
  - GET `/ai/ping`: health check for AI router
  - POST `/ai/use-case/evaluate`: placeholder evaluator
  - POST `/ai/ethics/review`: placeholder ethics review
  - POST `/ai/pain-points/extract/text`: new – accept array of text rows, returns unique pain points
  - POST `/ai/pain-points/extract/file`: new – accept CSV/XLS(X) upload plus selected columns & options
  - POST `/ai/pain-points/themes/map`: new – upload CSV/XLS(X) with ID + text columns, returns theme & perspective mapping table

## Services

- `services/llm.py`: Shared ChatOpenAI client (env: OPENAI_MODEL, OPENAI_TEMPERATURE)
- `services/prompts.py`: Centralised prompt templates (pain point extraction, theme & perspective mapping)
- `services/pain_points.py`: Chunking, cleaning and aggregation logic for pain point extraction; CSV/XLSX parsing and concatenation of selected columns.
 - `services/themes.py`: Maps pain points to predefined themes and perspectives; parses LLM output to a table.

## Frontend pages

- `/` – demo page with use-case evaluation and ethics review (already present)
- `/pain-points` – page to paste rows or upload a file, choose options, and display extracted pain points
- `/pain-points/themes` – page to upload pain points and generate Theme & Perspective mappings
- `/api/ai/pain-points/extract/file` – proxy to backend for multipart upload
- `/api/ai/pain-points/themes/map` – proxy to backend for multipart upload

## Porting plan (from Streamlit app)

1) Pain Point Toolkit
- [x] Pain Point Extraction (text + file upload, chunking, dedupe)
- [x] Theme & Perspective Mapping
- [ ] Capability Mapping (ID-based) + Excel export
- [ ] Pain Point Impact Estimation

2) Capability Toolkit
- [ ] Capability Description Generation

3) Applications Toolkit
- [ ] Application → Capability Mapping
- [ ] Logical Application Model Generator
- [ ] Individual Application Mapping

4) Engagement Planning Toolkit
- [ ] Engagement Touchpoint Planning

5) Strategy and Motivations Toolkit
- [ ] Strategy → Capability Mapping
- [ ] Tactics to Strategies Generator

6) Data, Information, and AI Toolkit
- [ ] Conceptual Data Model Generator
- [ ] Data-Application Mapping
- [ ] AI Use Case Customiser
- [ ] Use Case Ethics Review (streamlined) – backend placeholder exists, unify

## Key decisions

- Stateless API: All long prompts run server-side. Chunking is done in the service based on client-provided chunk_size to manage token limits.
- Output normalisation: We clean and deduplicate model output server-side, mirroring the reference logic but keeping it framework-agnostic.
- Upload proxy: For local dev simplicity, a Next.js API route proxies multipart to FastAPI; in production, route through an API gateway or set CORS correctly and call FastAPI directly from the client.
- Incremental prompts: Prompt templates live in `services/prompts.py` to consolidate them and allow gradual port of all templates from `migration_reference/prompts.py` and `app_config.py`.

## Environment

- Backend env vars: `OPENAI_API_KEY` (required), `OPENAI_MODEL` (default gpt-4o-mini), `OPENAI_TEMPERATURE` (default 0.2)
- Frontend env vars: `NEXT_PUBLIC_API_BASE_URL` pointing to FastAPI

## Open items / next steps

- Add remaining prompts and endpoints for all toolkits listed in the plan
- Implement Excel export endpoints for mapping pages (return xlsx bytes), and corresponding download buttons in frontend
- Add server-side input validation and rate limiting
- Add minimal tests for services (prompt generation, cleaning/parsing)
- Consider background tasks with RQ/Celery for larger jobs, returning job IDs and polling endpoints
- Add UI navigation and layout matching the reference app’s top-level toolkits
- Document local dev scripts and docker-compose for API + frontend

## Run with Docker

Prereqs: Docker Desktop installed and running.

Steps:
1) Optional: export your OpenAI API key
  - macOS/Linux: `export OPENAI_API_KEY=sk-...`
2) Build and start
  - Default ports: API 8000, Web 3000
  - If 3000 is in use, set an override: `export WEB_PORT=3001`
  - `docker compose up --build -d`
3) Access
  - API: http://localhost:8000 (docs: http://localhost:8000/docs)
  - Web: http://localhost:${WEB_PORT:-3000}
4) Stop
  - `docker compose down`

Notes:
- The frontend is built for production and points to the API container using `NEXT_PUBLIC_API_BASE_URL=http://api:8000`.
- Without an OpenAI key, LLM-backed endpoints return deterministic placeholders/naive parsing for smoke tests.
