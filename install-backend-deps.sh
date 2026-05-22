#!/bin/bash

# Script to install backend dependencies for packaged Electron app
# This should be run after the app is installed on the target system

echo "🔧 Installing Consulting Toolkit backend dependencies..."

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.9 or higher."
    echo "   Visit: https://www.python.org/downloads/"
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "📍 Found Python $PYTHON_VERSION"

# Check if pip is available
if ! python3 -m pip --version &> /dev/null; then
    echo "❌ pip is not available. Please install pip."
    exit 1
fi

# Get the directory where this script is located (should be the app bundle)
SCRIPT_DIR="$(dirname "$0")"
REQUIREMENTS_FILE="$SCRIPT_DIR/requirements.txt"

if [ ! -f "$REQUIREMENTS_FILE" ]; then
    echo "❌ requirements.txt not found at $REQUIREMENTS_FILE"
    exit 1
fi

echo "📦 Installing packages from $REQUIREMENTS_FILE"

# Install packages using pip
python3 -m pip install --user -r "$REQUIREMENTS_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backend dependencies installed successfully!"
    echo "   You can now use the Consulting Toolkit with full functionality."
else
    echo "❌ Failed to install some dependencies."
    echo "   You may need to install them manually or check your Python setup."
    exit 1
fi
