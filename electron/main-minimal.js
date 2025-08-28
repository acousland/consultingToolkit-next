const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  console.log('Creating window...');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  console.log('Window created, loading content...');
  
  // Try to find and load the index.html file
  const possiblePaths = [
    path.join(__dirname, '../apps/frontend/out/index.html'),
    path.join(__dirname, 'apps/frontend/out/index.html'),
    path.join(__dirname, '../out/index.html'),
    path.join(__dirname, 'out/index.html')
  ];
  
  console.log('__dirname:', __dirname);
  
  let indexPath = null;
  for (const testPath of possiblePaths) {
    console.log('Testing path:', testPath, '- exists:', fs.existsSync(testPath));
    if (fs.existsSync(testPath)) {
      indexPath = testPath;
      break;
    }
  }
  
  if (indexPath) {
    console.log('Loading from:', indexPath);
    mainWindow.loadFile(indexPath).then(() => {
      console.log('File loaded successfully');
    }).catch(error => {
      console.error('Error loading file:', error);
      loadFallbackPage(`Error loading UI: ${error.message}`);
    });
  } else {
    console.log('No index.html found, loading fallback');
    loadFallbackPage('Could not find index.html file');
  }
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  function loadFallbackPage(message) {
    const fallbackHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Consulting Toolkit</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            margin: 0; 
        }
        .container { 
            text-align: center; 
            padding: 3rem; 
            background: rgba(255,255,255,0.1); 
            border-radius: 12px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            max-width: 600px;
        }
        h1 { color: #4ade80; margin-bottom: 2rem; }
        .error { 
            background: rgba(239,68,68,0.2); 
            padding: 1rem; 
            border-radius: 8px; 
            margin: 1rem 0;
            border: 1px solid rgba(239,68,68,0.3);
        }
        .paths { 
            text-align: left; 
            background: rgba(0,0,0,0.3); 
            padding: 1rem; 
            border-radius: 8px; 
            font-family: monospace; 
            font-size: 0.9rem;
            margin: 1rem 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Consulting Toolkit</h1>
        <p>Electron app is running, but there was an issue loading the main UI.</p>
        <div class="error">${message}</div>
        <div class="paths">
            <strong>Searched paths:</strong><br>
            ${possiblePaths.map((p, i) => `${i + 1}. ${p} - ${fs.existsSync(p) ? '✅ Found' : '❌ Not found'}`).join('<br>')}
        </div>
        <p><strong>__dirname:</strong> ${__dirname}</p>
        <p>This confirms Electron is working. The issue is with file loading.</p>
    </div>
</body>
</html>`;
    
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHtml)}`);
  }
}

app.whenReady().then(() => {
  console.log('App ready, creating window...');
  createWindow();
});

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
