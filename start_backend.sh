#!/bin/bash

# Navigate to backend directory
cd /Users/acousland/Documents/Code/consultingToolkit-next/backend

# Set Python path
export PYTHONPATH=/Users/acousland/Documents/Code/consultingToolkit-next/backend

# Start the server
echo "🚀 Starting Portfolio Analysis Backend Server..."
echo "📡 Server will be available at: http://127.0.0.1:8000"
echo "🔍 Health endpoint: http://127.0.0.1:8000/health"
echo "🎯 AI endpoints: http://127.0.0.1:8000/ai/*"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

/Users/acousland/Documents/Code/consultingToolkit-next/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
