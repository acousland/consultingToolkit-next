#!/usr/bin/env bash
set -euo pipefail

# Start Both Backend and Frontend
# Runs both services independently for web-based development

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Starting Consulting Toolkit Full Stack Development"
echo "====================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check required commands
for cmd in node npm python3; do
    if ! command -v "$cmd" &> /dev/null; then
        echo -e "${RED}❌ $cmd is not installed. Please install it first.${NC}"
        exit 1
    fi
done

# Check if concurrently is installed
if ! npm list concurrently >/dev/null 2>&1; then
    echo -e "${YELLOW}📦 Installing concurrently for process management...${NC}"
    npm install concurrently
fi

# Store PIDs for cleanup
BACKEND_PID=""
FRONTEND_PID=""

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down all services...${NC}"
    
    # Kill background processes
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes on our ports
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Set up backend first
echo -e "${BLUE}🐍 Setting up backend environment...${NC}"
cd apps/backend

if [ ! -d "venv" ]; then
    echo -e "${YELLOW}🐍 Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip >/dev/null 2>&1
pip install -r requirements.txt >/dev/null 2>&1

cd "$PROJECT_ROOT"

# Set up frontend
echo -e "${BLUE}⚛️  Setting up frontend environment...${NC}"
cd apps/frontend

if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    npm install >/dev/null 2>&1
fi

cd "$PROJECT_ROOT"

# Show configuration
echo -e "\n${GREEN}🌐 Service Configuration:${NC}"
echo -e "${BLUE}   Backend API: http://localhost:8000${NC}"
echo -e "${BLUE}   Frontend Web: http://localhost:3000${NC}"
echo -e "${BLUE}   API Documentation: http://localhost:8000/docs${NC}"

echo -e "\n${GREEN}🚀 Starting both services...${NC}"
echo -e "${YELLOW}   Press Ctrl+C to stop all services${NC}"
echo ""

# Start both services using npm script
npm run start:dev
