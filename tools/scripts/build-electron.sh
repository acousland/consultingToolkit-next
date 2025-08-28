#!/usr/bin/env bash
set -euo pipefail

# Production Electron Build Script
# Builds frontend, packages Electron app for distribution

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🏭 Building Consulting Toolkit for Production"
echo "============================================="

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

# Function to check if directory exists and is not empty
check_build_output() {
    if [ -d "$1" ] && [ "$(ls -A "$1" 2>/dev/null)" ]; then
        return 0
    else
        return 1
    fi
}

# Clean previous builds
echo -e "${BLUE}🧹 Cleaning previous builds...${NC}"
rm -rf dist/
rm -rf apps/frontend/out/
rm -rf apps/frontend/.next/

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm ci

# Install frontend dependencies
echo -e "${BLUE}⚛️  Installing frontend dependencies...${NC}"
cd apps/frontend
npm ci
cd "$PROJECT_ROOT"

# Build frontend for production
echo -e "${BLUE}⚛️  Building frontend for production...${NC}"
cd apps/frontend
npm run build
if ! check_build_output "out"; then
    echo -e "${RED}❌ Frontend build failed - no output in 'out' directory${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Frontend build complete${NC}"
cd "$PROJECT_ROOT"

# Verify backend dependencies
echo -e "${BLUE}🐍 Verifying backend dependencies...${NC}"
if [ ! -d "apps/backend/venv" ]; then
    echo -e "${YELLOW}🐍 Creating Python virtual environment...${NC}"
    cd apps/backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    cd "$PROJECT_ROOT"
fi

# Test backend import
echo -e "${BLUE}🧪 Testing backend...${NC}"
cd apps/backend
source venv/bin/activate
python3 -c "import app.main; print('✅ Backend imports successfully')" || {
    echo -e "${RED}❌ Backend test failed${NC}"
    exit 1
}
cd "$PROJECT_ROOT"

# Build Electron app
echo -e "${BLUE}📱 Building Electron application...${NC}"

# Determine platform and architecture
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

if [[ "$PLATFORM" == "darwin" ]]; then
    if [[ "$ARCH" == "arm64" ]]; then
        BUILD_TARGET="--mac --arm64"
        echo -e "${BLUE}🍎 Building for macOS Apple Silicon (ARM64)${NC}"
    else
        BUILD_TARGET="--mac --x64"
        echo -e "${BLUE}🍎 Building for macOS Intel (x64)${NC}"
    fi
elif [[ "$PLATFORM" == "linux" ]]; then
    BUILD_TARGET="--linux"
    echo -e "${BLUE}🐧 Building for Linux${NC}"
else
    BUILD_TARGET="--win"
    echo -e "${BLUE}🪟 Building for Windows${NC}"
fi

# Run electron-builder
npm run electron:dist

# Verify build output
if check_build_output "dist"; then
    echo -e "\n${GREEN}🎉 Build completed successfully!${NC}"
    echo -e "${BLUE}📂 Output location: dist/${NC}"
    ls -la dist/
    
    # Show install instructions
    echo -e "\n${YELLOW}📋 Installation Instructions:${NC}"
    if [[ "$PLATFORM" == "darwin" ]]; then
        echo -e "${BLUE}   • Double-click the .dmg file to install${NC}"
        echo -e "${BLUE}   • Drag the app to Applications folder${NC}"
    elif [[ "$PLATFORM" == "linux" ]]; then
        echo -e "${BLUE}   • Make the AppImage executable: chmod +x *.AppImage${NC}"
        echo -e "${BLUE}   • Run: ./ConsultingToolkit-*.AppImage${NC}"
    else
        echo -e "${BLUE}   • Run the .exe installer${NC}"
    fi
    
    # Show distribution size
    echo -e "\n${BLUE}📊 Distribution size:${NC}"
    du -sh dist/* 2>/dev/null || echo "No files found"
    
else
    echo -e "${RED}❌ Build failed - no output in dist directory${NC}"
    exit 1
fi

echo -e "\n${GREEN}✅ Production build complete!${NC}"
