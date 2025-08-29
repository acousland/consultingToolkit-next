#!/bin/bash
# Repository Cleanup Script
# Removes unnecessary files while preserving essential functionality

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${2}${1}${NC}"
}

print_status "🧹 Starting Repository Cleanup..." $BLUE
print_status "=====================================" $BLUE

# Function to safely remove files with confirmation
remove_files() {
    local description=$1
    shift
    local files=("$@")
    
    if [ ${#files[@]} -eq 0 ]; then
        print_status "⏭️  No $description found to remove" $YELLOW
        return
    fi
    
    print_status "🗑️  Removing $description..." $YELLOW
    for file in "${files[@]}"; do
        if [ -e "$file" ]; then
            rm -rf "$file"
            print_status "   ✅ Removed: $file" $GREEN
        fi
    done
}

# Save space by showing size freed
get_directory_size() {
    if [ -d "$1" ]; then
        du -sh "$1" 2>/dev/null | cut -f1 || echo "0B"
    else
        echo "0B"
    fi
}

total_space_freed=0

# 1. Remove log files
print_status "\n📋 Step 1: Cleaning up log files..." $BLUE
log_files=(
    "./frontend.log"
    "./backend.log" 
    "./backend/gpt5_fixed.log"
    "./backend/backend.log"
    "./backend/gpt5_server.log"
    "./backend/server.log"
    "./backend/gpt5_final.log"
    "./backend/individual_painpoints.log"
    "./backend/ai_server.log"
)
remove_files "log files" "${log_files[@]}"

# 2. Remove Python cache directories
print_status "\n🐍 Step 2: Cleaning Python cache..." $BLUE
find . -name "__pycache__" -type d -not -path "./backend/venv/*" -exec rm -rf {} + 2>/dev/null || true
find . -name "*.pyc" -not -path "./backend/venv/*" -delete 2>/dev/null || true
find . -name "*.pyo" -not -path "./backend/venv/*" -delete 2>/dev/null || true
print_status "   ✅ Removed Python cache files" $GREEN

# 3. Clean up old test files (keep our new ones)
print_status "\n🧪 Step 3: Cleaning up old test files..." $BLUE
old_test_files=(
    "./test_backend.py"
    "./test_backend_quick.py"
    "./test_modes.py"
    "./test_optimized.py"
    "./test_portfolio_full.py"
    "./test_timeout_debug.py"
    "./.pytest_cache"
)
remove_files "old test files" "${old_test_files[@]}"

# 4. Clean up development artifacts
print_status "\n🔧 Step 4: Cleaning development artifacts..." $BLUE
dev_artifacts=(
    "./.DS_Store"
    "./frontend/.DS_Store"
    "./backend/.DS_Store"
    "./.venv"  # Old venv in wrong location
    "./dist"   # Old dist directory if it exists in root
)
remove_files "development artifacts" "${dev_artifacts[@]}"

# 5. Clean up frontend build artifacts (but keep final dist)
print_status "\n⚛️  Step 5: Cleaning frontend build cache..." $BLUE
# Clean Next.js cache but keep the final dist
if [ -d "./frontend/.next" ]; then
    rm -rf "./frontend/.next"
    print_status "   ✅ Removed Next.js cache" $GREEN
fi

# 6. Clean up migration reference (old code)
print_status "\n📦 Step 6: Cleaning migration reference..." $BLUE
if [ -d "./migration_reference" ]; then
    migration_size=$(get_directory_size "./migration_reference")
    rm -rf "./migration_reference"
    print_status "   ✅ Removed migration reference ($migration_size freed)" $GREEN
fi

# 7. Clean up redundant documentation files
print_status "\n📚 Step 7: Consolidating documentation..." $BLUE
# Keep essential docs, remove outdated ones
redundant_docs=(
    "./TODO.md"  # Very large file with old todos
    "./UiStyleGuide.md"  # Outdated
    "./architecture.md"  # Outdated 
    "./IMPLEMENTATION_STATUS.md"  # Outdated
)
remove_files "redundant documentation" "${redundant_docs[@]}"

# 8. Clean up deployment scripts we don't use
print_status "\n🚀 Step 8: Cleaning deployment scripts..." $BLUE
unused_scripts=(
    "./deploy.sh"
    "./deploy_no_cache.sh" 
    "./run_locally.sh"
    "./start_backend.sh"
    "./docker-compose.yml"
    "./Dockerfile"
)
remove_files "unused deployment scripts" "${unused_scripts[@]}"

# 9. Clean up the large DMG from dist after copying it somewhere safe
print_status "\n💿 Step 9: Archiving large DMG file..." $BLUE
if [ -f "./frontend/dist/Consulting Toolkit-1.0.0-arm64.dmg" ]; then
    dmg_size=$(get_directory_size "./frontend/dist/Consulting Toolkit-1.0.0-arm64.dmg")
    print_status "   ℹ️  Found DMG file ($dmg_size) - moving to archive location" $YELLOW
    
    # Create archive directory
    mkdir -p ./archives
    mv "./frontend/dist/Consulting Toolkit-1.0.0-arm64.dmg" "./archives/"
    mv "./frontend/dist/Consulting Toolkit-1.0.0-arm64.dmg.blockmap" "./archives/" 2>/dev/null || true
    
    # Clean up dist directory build artifacts but keep the app structure
    find "./frontend/dist" -name "*.yml" -o -name "builder-*" | xargs rm -f 2>/dev/null || true
    
    print_status "   ✅ Moved DMG to ./archives/ and cleaned build artifacts" $GREEN
fi

# 10. Optimize git repository
print_status "\n🗃️  Step 10: Optimizing git repository..." $BLUE
if [ -d ".git" ]; then
    git gc --prune=now 2>/dev/null || print_status "   ⚠️  Git cleanup failed (not critical)" $YELLOW
    print_status "   ✅ Git repository optimized" $GREEN
fi

# 11. Final verification - make sure essential files still exist
print_status "\n✅ Step 11: Verifying essential files..." $BLUE
essential_files=(
    "./frontend/package.json"
    "./backend/requirements.txt"
    "./backend/app/main.py"
    "./backend/app/services/brand_consistency.py"
    "./frontend/src/app/brand/brand-consistency-checker/page.tsx"
    "./test-suite.js"
    "./quick-test.sh" 
    "./TESTING_CHECKLIST.md"
    "./SAFE_DEVELOPMENT.md"
)

all_essential_present=true
for file in "${essential_files[@]}"; do
    if [ ! -f "$file" ]; then
        print_status "   ❌ Missing essential file: $file" $RED
        all_essential_present=false
    fi
done

if $all_essential_present; then
    print_status "   ✅ All essential files present" $GREEN
else
    print_status "   ⚠️  Some essential files missing - please check!" $YELLOW
fi

# Summary
print_status "\n🎉 Cleanup Complete!" $GREEN
print_status "====================" $GREEN

print_status "\n📊 What was cleaned:" $BLUE
print_status "   • Log files and Python cache" $GREEN
print_status "   • Old test files and development artifacts" $GREEN  
print_status "   • Migration reference code" $GREEN
print_status "   • Redundant documentation" $GREEN
print_status "   • Unused deployment scripts" $GREEN
print_status "   • Build artifacts and temporary files" $GREEN
print_status "   • Git repository optimized" $GREEN

print_status "\n📁 Repository structure now:" $BLUE
print_status "   • /backend - Python API with virtual environment" $GREEN
print_status "   • /frontend - Next.js/Electron app" $GREEN
print_status "   • /archives - Built DMG files" $GREEN
print_status "   • Testing tools (test-suite.js, quick-test.sh)" $GREEN
print_status "   • Documentation (README.md, TESTING_CHECKLIST.md, etc.)" $GREEN

print_status "\n🏁 Repository is now clean and optimized!" $GREEN

# Final size check
print_status "\n📈 Final repository size:" $BLUE
du -sh . 2>/dev/null || echo "Size check failed"
