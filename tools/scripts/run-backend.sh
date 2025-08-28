#!/usr/bin/env bash
set -euo pipefail

# Standalone Backend Script
# Runs FastAPI backend server independently without Electron

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT/apps/backend"

echo "🚀 Starting Consulting Toolkit Backend Server"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}🐍 Creating Python virtual environment...${NC}"
    python3 -m venv venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
fi

# Activate virtual environment
echo -e "${BLUE}🐍 Activating virtual environment...${NC}"
source venv/bin/activate

# Install/update dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
pip install --upgrade pip
pip install -r requirements.txt

# Test imports
echo -e "${BLUE}🧪 Testing backend imports...${NC}"
python3 -c "
try:
    from app.main import app
    print('✅ Backend imports successfully')
    print('✅ FastAPI app initialized')
except Exception as e:
    print(f'❌ Import error: {e}')
    exit(1)
"

# Set environment variables
export PYTHONPATH="${PWD}:${PYTHONPATH:-}"

# Get port from environment or use default
PORT="${BACKEND_PORT:-8000}"
HOST="${BACKEND_HOST:-0.0.0.0}"

echo -e "\n${GREEN}🌐 Server Configuration:${NC}"
echo -e "${BLUE}   Host: ${HOST}${NC}"
echo -e "${BLUE}   Port: ${PORT}${NC}"
echo -e "${BLUE}   Environment: ${ENVIRONMENT:-development}${NC}"
echo -e "${BLUE}   API Docs: http://localhost:${PORT}/docs${NC}"
echo -e "${BLUE}   Health Check: http://localhost:${PORT}/health${NC}"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down backend server...${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

echo -e "\n${GREEN}🚀 Starting backend server...${NC}"
echo -e "${YELLOW}   Press Ctrl+C to stop${NC}"
echo ""

# Start the server
uvicorn app.main:app \
    --host "$HOST" \
    --port "$PORT" \
    --reload \
    --reload-dir app \
    --log-level info
