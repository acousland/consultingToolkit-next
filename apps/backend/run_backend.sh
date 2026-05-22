#!/bin/bash

# Backend startup script for apps/backend
cd "$(dirname "$0")"

export PYTHONPATH="$(pwd):$PYTHONPATH"

echo "Starting backend server..."
echo "Directory: $(pwd)"
echo "Python path: $PYTHONPATH"

python3 -c "
import sys
sys.path.insert(0, '.')
print('Python path:', sys.path[:3])

try:
    from app.main import app
    print('✓ Successfully imported app')
    import uvicorn
    print('✓ Starting uvicorn server on http://0.0.0.0:8000')
    uvicorn.run(app, host='0.0.0.0', port=8000, reload=False)
except ImportError as e:
    print('✗ Import error:', e)
    import os
    print('Current dir contents:', os.listdir('.'))
    if os.path.exists('app'):
        print('app/ contents:', os.listdir('app'))
except Exception as e:
    print('✗ Error:', e)
"
