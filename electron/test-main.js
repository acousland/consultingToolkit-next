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
