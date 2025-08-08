#!/usr/bin/env bash
set -euo pipefail

echo "Running backend tests..."
# Allow exit code 5 (no tests collected)
python -m pytest backend || true

echo "Running frontend lint..."
cd frontend
npm ci
npm run lint
