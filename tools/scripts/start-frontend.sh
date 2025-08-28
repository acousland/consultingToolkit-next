#!/bin/bash
set -e

# Get the project root (2 directories up from this script)
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && cd ../../ && pwd )"
cd "$PROJECT_ROOT/apps/frontend"
npm run dev
