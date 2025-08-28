#!/usr/bin/env bash
set -euo pipefail

# Development Electron Build Script
# Starts all services and launches Electron in development mode with hot reload

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Starting Consulting Toolkit in Development Mode"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to cleanup background processes on exit
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up processes...${NC}"
    pkill -f "uvicorn\|npm.*dev\|electron" 2>/dev/null || true
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3 first.${NC}"
    exit 1
fi

# Install main dependencies if needed
echo -e "${BLUE}📦 Checking main dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing main dependencies...${NC}"
    npm install
fi

# Check backend virtual environment
echo -e "${BLUE}🐍 Checking backend environment...${NC}"
if [ ! -d "apps/backend/venv" ]; then
    echo -e "${YELLOW}🐍 Creating Python virtual environment...${NC}"
    cd apps/backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    cd "$PROJECT_ROOT"
else
    echo -e "${GREEN}✅ Backend virtual environment exists${NC}"
fi

# Check frontend dependencies
echo -e "${BLUE}⚛️  Checking frontend dependencies...${NC}"
if [ ! -d "apps/frontend/node_modules" ]; then
    echo -e "${YELLOW}⚛️  Installing frontend dependencies...${NC}"
    cd apps/frontend
    npm install
    cd "$PROJECT_ROOT"
else
    echo -e "${GREEN}✅ Frontend dependencies exist${NC}"
fi

# Start development environment
echo -e "\n${GREEN}🚀 Starting development environment...${NC}"
echo -e "${BLUE}   • Backend: http://localhost:8000${NC}"
echo -e "${BLUE}   • Frontend: http://localhost:3000${NC}"
echo -e "${BLUE}   • Electron: Desktop app window${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}\n"

# Use npm script for coordinated startup
npm run electron:dev
