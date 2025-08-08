# Consulting Toolkit (Next.js + FastAPI)

This repository contains the split-out Next.js frontend and FastAPI backend.

- Frontend: `frontend/` (Next.js + TypeScript + Tailwind)
- Backend: `backend/` (FastAPI + Uvicorn)

## Dev Quickstart

Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Frontend:

```bash
cd frontend
# Ensure .env.local has: NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001
npm install
npm run dev
```

Open http://localhost:3000 (or whichever port Next.js selects).
