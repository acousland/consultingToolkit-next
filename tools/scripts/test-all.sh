#!/usr/bin/env bash
set -euo pipefail

# Directory setup
ROOT_DIR=$(dirname "$(readlink -f "$0")")/..
LOG_DIR="$ROOT_DIR/test-results"
mkdir -p "$LOG_DIR"

echo "Running backend tests..."
# Capture output to log and record exit status. Pytest exit code 5 means no tests were collected.
set +e
python -m pytest backend 2>&1 | tee "$LOG_DIR/backend.log"
backend_status=${PIPESTATUS[0]}
set -e
if [[ "$backend_status" -ne 0 && "$backend_status" -ne 5 ]]; then
  echo "Backend tests failed (exit code $backend_status). See $LOG_DIR/backend.log for details."
  exit "$backend_status"
fi

echo "Running frontend lint..."
pushd frontend >/dev/null
set +e
npm ci 2>&1 | tee "$LOG_DIR/frontend-install.log"
install_status=${PIPESTATUS[0]}
if [[ "$install_status" -ne 0 ]]; then
  echo "Frontend dependency installation failed (exit code $install_status). See $LOG_DIR/frontend-install.log for details."
  popd >/dev/null
  exit "$install_status"
fi

npm run lint 2>&1 | tee "$LOG_DIR/frontend-lint.log"
lint_status=${PIPESTATUS[0]}
set -e
popd >/dev/null
if [[ "$lint_status" -ne 0 ]]; then
  echo "Frontend lint failed (exit code $lint_status). See $LOG_DIR/frontend-lint.log for details."
  exit "$lint_status"
fi

echo "All tests and lint checks passed. Logs are available in $LOG_DIR."
