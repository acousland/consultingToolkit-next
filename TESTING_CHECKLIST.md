# 🚀 Pre-Deployment Checklist

## Before Making Any Changes
- [ ] Run full test suite: `node test-suite.js`
- [ ] Document what you're changing and why
- [ ] Create a backup/commit current working state
- [ ] Test in development environment first

## After Making Changes
- [ ] Run test suite again: `node test-suite.js`
- [ ] Test affected features manually
- [ ] Test integration between components
- [ ] Check console for errors
- [ ] Verify all navigation links work

## Critical Features to Test After Any Change

### ✅ Backend API Health
- [ ] Health endpoint responds: `curl http://localhost:8000/health`
- [ ] All AI endpoints return proper error codes (422 for missing data)
- [ ] No 500 errors in server logs

### ✅ Frontend Navigation
- [ ] All navigation links work
- [ ] Pages load without errors
- [ ] No console JavaScript errors
- [ ] Brand consistency checker accessible

### ✅ Core Functionality
- [ ] Pain points extraction works
- [ ] Applications toolkit loads
- [ ] Strategy tools function
- [ ] Brand consistency checker loads
- [ ] File uploads work (if applicable)

### ✅ Integration Points
- [ ] Frontend can reach backend APIs
- [ ] CORS headers working
- [ ] Error handling displays properly
- [ ] Loading states work

## Automated Commands

```bash
# Quick health check
curl http://localhost:8000/health

# Run comprehensive tests
node test-suite.js

# Build and test
npm run build && npm run dist

# Start both frontend and backend for testing
# Terminal 1: Backend
cd backend && source venv/bin/activate && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend  
cd frontend && npm run dev
```

## Rollback Plan
If something breaks:
1. Stop services
2. Revert to last working commit: `git reset --hard HEAD~1`
3. Restart services
4. Confirm functionality restored
5. Analyze what went wrong before trying again

## Red Flags 🚨
Stop and investigate if you see:
- [ ] 500 server errors
- [ ] Pages returning blank/white screen
- [ ] Navigation links leading to 404s
- [ ] Console showing JavaScript errors
- [ ] API calls failing with unexpected errors
- [ ] Build process failing

## Testing Order Priority
1. **Core Infrastructure** (health checks, basic routing)
2. **Critical User Journeys** (main toolkit functionality)  
3. **New Features** (brand consistency, latest additions)
4. **Edge Cases** (error handling, validation)
5. **Performance** (load times, responsiveness)
