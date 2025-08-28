#!/usr/bin/env bash
set -euo pipefail

# Simple Electron Test Script
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🧪 Electron Window Test"
echo "======================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📱 Creating minimal test Electron app...${NC}"

# Create a minimal test main.js
cat > electron/test-main.js << 'EOF'
const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  console.log('Creating test window...');
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Electron Test</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
            }
            .container {
                text-align: center;
                padding: 2rem;
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            h1 { margin-bottom: 1rem; }
            .success { color: #4ade80; font-size: 48px; margin-bottom: 1rem; }
            .info { opacity: 0.9; margin-top: 1rem; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="success">✅</div>
            <h1>Electron Window Test</h1>
            <p>If you can see this, Electron windows are working correctly!</p>
            <div class="info">
                <p>Path: ${__dirname}</p>
                <p>Process: ${process.platform}</p>
                <p>Electron: ${process.versions.electron}</p>
            </div>
        </div>
    </body>
    </html>
  `;

  console.log('Loading test HTML...');
  mainWindow.loadURL(\`data:text/html;charset=utf-8,\${encodeURIComponent(testHtml)}\`);
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  console.log('Test window created and should be visible');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
EOF

echo -e "${GREEN}✅ Test file created${NC}"

# Kill any existing processes
pkill -f "Consulting Toolkit" || true
pkill -f "electron" || true
sleep 2

echo -e "${BLUE}🚀 Running minimal Electron test...${NC}"
echo -e "${YELLOW}   This should open a test window to verify Electron is working${NC}"

# Run the test
./node_modules/.bin/electron electron/test-main.js &

TEST_PID=$!

echo -e "${GREEN}✅ Test app launched (PID: $TEST_PID)${NC}"
echo -e "${YELLOW}💡 If you see a test window, Electron is working correctly${NC}"
echo -e "${YELLOW}💡 If not, there may be a system-level Electron issue${NC}"

# Clean up after 10 seconds
sleep 10
kill $TEST_PID 2>/dev/null || true

echo -e "${BLUE}🧹 Test completed${NC}"
