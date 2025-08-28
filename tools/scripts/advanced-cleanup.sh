#!/bin/bash
# Advanced Repository Cleanup Script
# More aggressive cleanup for maximum space savings

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${2}${1}${NC}"
}

print_status "🚀 Advanced Repository Cleanup..." $BLUE
print_status "=================================" $BLUE

# Check if services are running
print_status "\n⚠️  Checking running services..." $YELLOW
if pgrep -f "uvicorn\|npm" > /dev/null; then
    print_status "🛑 Services are running. Please stop them first:" $RED
    print_status "   pkill -f 'uvicorn'  # Stop backend" $YELLOW
    print_status "   pkill -f 'npm'      # Stop frontend" $YELLOW
    exit 1
fi

# 1. Clean up dist directory more aggressively
print_status "\n💿 Step 1: Advanced dist cleanup..." $BLUE
if [ -d "./frontend/dist" ]; then
    dist_size=$(du -sh "./frontend/dist" | cut -f1)
    print_status "   Current dist size: $dist_size" $YELLOW
    
    # Keep only the final app, remove all intermediate build files
    find "./frontend/dist" -name "*.js.map" -delete 2>/dev/null || true
    find "./frontend/dist" -name "*.d.ts" -delete 2>/dev/null || true
    find "./frontend/dist" -name "builder-*" -delete 2>/dev/null || true
    
    # Remove the large unpacked asar if it exists (we have the packed version)
    if [ -d "./frontend/dist/mac-arm64/Consulting Toolkit.app/Contents/Resources/app.asar.unpacked" ]; then
        rm -rf "./frontend/dist/mac-arm64/Consulting Toolkit.app/Contents/Resources/app.asar.unpacked"
        print_status "   ✅ Removed unpacked asar directory" $GREEN
    fi
    
    new_dist_size=$(du -sh "./frontend/dist" | cut -f1)
    print_status "   New dist size: $new_dist_size" $GREEN
fi

# 2. Clean up node_modules more selectively
print_status "\n📦 Step 2: Node modules cleanup..." $BLUE
if [ -d "./frontend/node_modules" ]; then
    # Remove development-only packages' cache and test files
    find "./frontend/node_modules" -name "*.md" -not -name "README.md" -delete 2>/dev/null || true
    find "./frontend/node_modules" -name "CHANGELOG*" -delete 2>/dev/null || true
    find "./frontend/node_modules" -name "*.test.js" -delete 2>/dev/null || true
    find "./frontend/node_modules" -name "*.spec.js" -delete 2>/dev/null || true
    find "./frontend/node_modules" -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true
    find "./frontend/node_modules" -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
    find "./frontend/node_modules" -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
    find "./frontend/node_modules" -name "examples" -type d -exec rm -rf {} + 2>/dev/null || true
    find "./frontend/node_modules" -name "docs" -type d -exec rm -rf {} + 2>/dev/null || true
    
    print_status "   ✅ Cleaned node_modules metadata and test files" $GREEN
fi

# 3. Clean up Python virtual environment
print_status "\n🐍 Step 3: Python venv cleanup..." $BLUE
if [ -d "./backend/venv" ]; then
    venv_size_before=$(du -sh "./backend/venv" | cut -f1)
    
    # Remove test files from packages
    find "./backend/venv" -name "test*" -type d -exec rm -rf {} + 2>/dev/null || true
    find "./backend/venv" -name "*test*" -name "*.py" -delete 2>/dev/null || true
    find "./backend/venv" -name "*.md" -not -name "README.md" -delete 2>/dev/null || true
    find "./backend/venv" -name "CHANGELOG*" -delete 2>/dev/null || true
    find "./backend/venv" -name "*.pyi" -delete 2>/dev/null || true  # Type hint files
    
    venv_size_after=$(du -sh "./backend/venv" | cut -f1)
    print_status "   Before: $venv_size_before → After: $venv_size_after" $GREEN
fi

# 4. Remove large unnecessary files
print_status "\n🗑️  Step 4: Removing large unnecessary files..." $BLUE

# Remove source maps if they exist
find . -name "*.js.map" -not -path "./node_modules/*" -delete 2>/dev/null || true
find . -name "*.css.map" -not -path "./node_modules/*" -delete 2>/dev/null || true

# Remove any remaining .DS_Store files
find . -name ".DS_Store" -delete 2>/dev/null || true

print_status "   ✅ Removed source maps and system files" $GREEN

# 5. Optimize git repository more aggressively
print_status "\n🗃️  Step 5: Aggressive git optimization..." $BLUE
if [ -d ".git" ]; then
    # Clean up git more thoroughly
    git reflog expire --expire=now --all 2>/dev/null || true
    git gc --prune=now --aggressive 2>/dev/null || true
    print_status "   ✅ Git repository deeply optimized" $GREEN
fi

# 6. Create .gitignore improvements
print_status "\n📝 Step 6: Updating .gitignore..." $BLUE
cat >> .gitignore << 'EOF'

# Additional cleanup patterns
*.log
*.map
.DS_Store
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
archives/
*.dmg
*.blockmap
EOF

print_status "   ✅ Enhanced .gitignore with cleanup patterns" $GREEN

# Final summary
print_status "\n📊 Final size comparison:" $BLUE
final_size=$(du -sh . | cut -f1)
print_status "   Repository size: $final_size" $GREEN

print_status "\n🎯 Advanced cleanup complete!" $GREEN
print_status "=============================" $GREEN

print_status "\n🔍 Remaining large directories:" $BLUE
du -sh */ | sort -hr | head -5

print_status "\n💡 Additional space-saving tips:" $YELLOW
print_status "   • Run 'npm prune' in frontend/ to remove unused packages" $YELLOW
print_status "   • Consider using 'npm ci' instead of 'npm install' for cleaner installs" $YELLOW
print_status "   • The built .app in dist/ contains everything needed for distribution" $YELLOW

print_status "\n✅ Repository is now maximally optimized!" $GREEN
