const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  console.log('Creating simple test window...');
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Simple test page
  const testHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Electron Test</title>
    <style>
        body { font-family: Arial, sans-serif; background: #1a1a2e; color: white; 
               display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { text-align: center; padding: 2rem; background: #16213e; border-radius: 8px; }
        h1 { color: #4ade80; margin-bottom: 1rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ Electron Test Success!</h1>
        <p>This confirms Electron windows are working on your system.</p>
        <p>The main app issue is likely a file loading problem.</p>
    </div>
</body>
</html>`;

  console.log('Loading test HTML...');
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(testHtml)}`);
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  console.log('Test window should now be visible');
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
