#!/bin/bash
# Quick Development Test Script
# Run this before and after making changes

set -e  # Exit on any error

echo "🚀 Running Quick Development Tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${2}${1}${NC}"
}

# Check if backend is running
print_status "Checking backend health..." $BLUE
if curl -s http://localhost:8000/health > /dev/null; then
    print_status "✅ Backend is healthy" $GREEN
else
    print_status "❌ Backend not responding - start it first!" $RED
    echo "Run: cd backend && source venv/bin/activate && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &"
    exit 1
fi

# Check if frontend is running
print_status "Checking frontend..." $BLUE
if curl -s http://localhost:3000 > /dev/null; then
    print_status "✅ Frontend is accessible" $GREEN
else
    print_status "❌ Frontend not responding - start it first!" $RED
    echo "Run: cd frontend && npm run dev &"
    exit 1
fi

# Test critical API endpoints
print_status "Testing API endpoints..." $BLUE

# Test brand consistency endpoints
for endpoint in "brand/style-guide" "brand/deck" "brand/analyse"; do
    if curl -s -X POST -H "Content-Type: application/json" -d '{}' "http://localhost:8000/ai/${endpoint}" | grep -q "422\|Field required"; then
        print_status "✅ /ai/${endpoint} endpoint working" $GREEN
    else
        print_status "❌ /ai/${endpoint} endpoint issue" $RED
    fi
done

# Test pain points endpoint
if curl -s -X POST -H "Content-Type: application/json" -d '{}' "http://localhost:8000/ai/pain-points/extract/text" | grep -q "422\|Field required"; then
    print_status "✅ Pain points endpoint working" $GREEN
else
    print_status "❌ Pain points endpoint issue" $RED
fi

# Test critical frontend routes
print_status "Testing frontend routes..." $BLUE
critical_routes=("/" "/toolkits/graphic-design/brand-consistency-checker" "/pain-points" "/applications/capabilities")

for route in "${critical_routes[@]}"; do
    if curl -s -L "http://localhost:3000${route}" | grep -q "html\|<!DOCTYPE"; then
        print_status "✅ Route ${route} working" $GREEN
    else
        print_status "❌ Route ${route} issue" $RED
    fi
done

# Check for critical files
print_status "Checking critical files..." $BLUE
critical_files=(
    "apps/backend/app/services/brand_consistency.py"
    "backend/app/routers/ai.py"  
    "frontend/src/components/NavBar.tsx"
    "apps/frontend/src/app/toolkits/graphic-design/brand-consistency-checker/page.tsx"
)

for file in "${critical_files[@]}"; do
    if [ -f "$file" ] && [ -s "$file" ]; then
        print_status "✅ ${file} exists and not empty" $GREEN
    else
        print_status "❌ ${file} missing or empty" $RED
    fi
done

print_status "🎉 Quick tests completed!" $GREEN
print_status "If all tests passed, your changes are likely safe to deploy." $YELLOW
