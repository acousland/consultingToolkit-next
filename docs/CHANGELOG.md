Changelog
=========

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

Unreleased
----------
- (placeholder)

v0.1.0-alpha.1 - 2025-08-08
---------------------------

Added
- Admin: LLM status and health endpoints on the backend (`/ai/llm/status`, `/ai/llm/health`) and Admin UI showing enabled provider/model/temperature and ping.
- Capability Description Generator: backend endpoint and frontend page.
- Data & AI toolkit: Use Case Evaluation and Ethics Review tools with Edge API proxies and pages.
- Docker healthchecks for API (FastAPI `/health`) and Web (Next.js root), plus removal of obsolete compose `version` key.
- Environment loading: backend auto-loads `.env` via `python-dotenv`; added `.env.example` and docs.

Changed
- Enforced dark-only theme globally; removed light/dark toggle. Restyled all toolkit hubs with the new hero + card design.
- Frontend Docker base image switched to `node:20-bookworm-slim` to fix native module builds; Next.js config skips ESLint during production builds.

Fixed
- Improved CSV/XLSX parsing and header detection; better error handling for file extraction; corrected API base URLs for Docker and proxies.

Removed
- Use Case Evaluation/Ethics Review cards from the homepage (tools live under the Data & AI toolkit only).

Links
- Tag: https://github.com/acousland/consultingToolkit-next/releases/tag/v0.1.0-alpha.1
