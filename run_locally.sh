#!/bin/bash
set -e

# Start backend in background
cd backend

if [ -f venv/bin/activate ]; then
  echo "Activating backend virtual environment..."
  source venv/bin/activate
else
  echo "No virtual environment found in backend/venv — using current Python environment."
fi

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "Backend running on http://localhost:8000 (PID: $BACKEND_PID)"
echo "Frontend running on http://localhost:3000 (PID: $FRONTEND_PID)"
echo "Press Ctrl+C to stop both services"

cleanup() {
  echo
  echo "Shutting down…"
  trap - INT TERM

  for pid in "$BACKEND_PID" "$FRONTEND_PID"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done

  wait || true
}

trap cleanup INT TERM

wait $BACKEND_PID $FRONTEND_PID
