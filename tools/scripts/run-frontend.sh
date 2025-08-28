#!/usr/bin/env bash
set -euo pipefail

# Standalone Frontend Script
# Runs Next.js frontend server independently without Electron

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT/apps/frontend"

echo "⚛️  Starting Consulting Toolkit Frontend Server"
echo "==============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check Node.js and npm are available
for cmd in node npm; do
    if ! command -v "$cmd" &> /dev/null; then
        echo -e "${RED}❌ $cmd is not installed. Please install it first.${NC}"
        exit 1
    fi
done

# Show Node.js version
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
echo -e "${BLUE}📋 Node.js version: ${NODE_VERSION}${NC}"
echo -e "${BLUE}📋 npm version: ${NPM_VERSION}${NC}"

# Check if node_modules exists and has packages
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

# Verify key packages
echo -e "${BLUE}🔍 Verifying Next.js installation...${NC}"
if npm list next >/dev/null 2>&1; then
    NEXT_VERSION=$(npm list next --depth=0 2>/dev/null | grep next@ | sed 's/.*next@//')
    echo -e "${GREEN}✅ Next.js ${NEXT_VERSION} installed${NC}"
else
    echo -e "${RED}❌ Next.js not found in dependencies${NC}"
    exit 1
fi

# Get port from environment or use default
PORT="${FRONTEND_PORT:-3000}"
HOST="${FRONTEND_HOST:-localhost}"

# Check if port is in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port $PORT is already in use${NC}"
    echo -e "${BLUE}💡 You can set a different port with: FRONTEND_PORT=3001 ./run-frontend.sh${NC}"
    
    # Try to find an alternative port
    for alt_port in 3001 3002 3003; do
        if ! lsof -Pi :$alt_port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "${BLUE}💡 Alternative port available: $alt_port${NC}"
            break
        fi
    done
    echo ""
fi

echo -e "\n${GREEN}🌐 Server Configuration:${NC}"
echo -e "${BLUE}   Development Server: http://${HOST}:${PORT}${NC}"
echo -e "${BLUE}   Environment: ${NODE_ENV:-development}${NC}"
echo -e "${BLUE}   Hot Reload: Enabled${NC}"

# Check for backend connectivity (optional)
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
echo -e "${BLUE}   Backend API: ${BACKEND_URL}${NC}"

# Test backend connection (non-blocking)
echo -e "${BLUE}🔗 Testing backend connection...${NC}"
if curl -s "${BACKEND_URL}/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running and accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Backend not available at ${BACKEND_URL}${NC}"
    echo -e "${BLUE}💡 Start backend with: ./tools/scripts/run-backend.sh${NC}"
fi

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down frontend server...${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

echo -e "\n${GREEN}🚀 Starting frontend development server...${NC}"
echo -e "${YELLOW}   Press Ctrl+C to stop${NC}"
echo -e "${BLUE}   The application will automatically open in your browser${NC}"
echo ""

# Start the development server
NEXT_TELEMETRY_DISABLED=1 npm run dev -- --port "$PORT" --hostname "$HOST"
