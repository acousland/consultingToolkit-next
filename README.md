# Consulting Toolkit (Next.js + FastAPI)

This repository contains the split-out Next.js frontend and FastAPI backend.

- Frontend: `apps/frontend/` (Next.js + TypeScript + Tailwind)
- Backend: `apps/backend/` (FastAPI + Uvicorn)

Documentation:
- Architecture overview: [docs/architecture.md](./docs/architecture.md)
- Functional specification: [docs/functional-spec.md](./docs/functional-spec.md)
- Changelog: [docs/CHANGELOG.md](./docs/CHANGELOG.md)
- Testing guide: [docs/TESTING_CHECKLIST.md](./docs/TESTING_CHECKLIST.md)

## Dev Quickstart

Backend:

```bash
cd apps/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Environment variables (backend):

- Copy `.env.example` to `.env` at the repo root and set your values. The FastAPI app auto-loads this file at startup:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
```

This avoids exporting vars in your shell each time. You can still override via shell env for one-off runs.

Frontend:

```bash
cd apps/frontend
# Ensure .env.local has: NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
npm install
npm run dev
```

Open http://localhost:3000 (or whichever port Next.js selects).

## Testing

Run comprehensive tests with:

```bash
npm run test
```

Run quick development tests with:

```bash
npm run test:quick
```

Run backend tests only:

```bash
npm run test:backend
```

Run the test-suite.js, quick-test.sh, health monitoring, and cleanup scripts from the `tools/` directory.

## Docker Compose

The compose file wires API and Web:

```yaml
services:
	api:
		environment:
			- OPENAI_API_KEY=${OPENAI_API_KEY}
			- OPENAI_MODEL=${OPENAI_MODEL:-gpt-4o-mini}
			- OPENAI_TEMPERATURE=${OPENAI_TEMPERATURE:-0.2}
	web:
		environment:
			- NEXT_PUBLIC_API_BASE_URL=http://api:8000
```

Create a `.env` file (not committed) alongside `docker-compose.yml` to store secrets for compose. Compose will automatically read it and pass values to the containers.

	Useful:
	- Override web port if 3000 is busy: `WEB_PORT=8001 docker compose up -d`
	- Healthchecks are enabled for API (`/health`) and Web (root page)

	## Releases

	- Latest pre-release: [v0.1.0-alpha.1](https://github.com/acousland/consultingToolkit-next/releases/tag/v0.1.0-alpha.1)
