#!/usr/bin/env bash
set -euo pipefail

# Test Production Electron App
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🧪 Testing Production Electron Application"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if build exists
if [ ! -f "dist/mac-arm64/Consulting Toolkit.app/Contents/MacOS/Consulting Toolkit" ]; then
    echo -e "${RED}❌ Production build not found. Run 'npm run build:electron' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Production build found${NC}"

# Kill any existing processes first
echo -e "${BLUE}🧹 Cleaning up any existing processes...${NC}"
pkill -f "Consulting Toolkit" || true
pkill -f "uvicorn\|npm.*dev" || true
sleep 2

echo -e "\n${GREEN}🚀 Starting production Electron app...${NC}"
echo -e "${YELLOW}   Check Console.app for debugging output if the UI doesn't appear${NC}"
echo -e "${BLUE}   App location: dist/mac-arm64/Consulting Toolkit.app${NC}"

# Run the app
open "dist/mac-arm64/Consulting Toolkit.app"

echo -e "\n${BLUE}💡 If the UI doesn't appear:${NC}"
echo -e "${BLUE}   1. Check Console.app for error messages${NC}"
echo -e "${BLUE}   2. Look for 'Loading from static files' debug messages${NC}"
echo -e "${BLUE}   3. Check if static files are being loaded correctly${NC}"

echo -e "\n${GREEN}✅ Production app launched${NC}"
