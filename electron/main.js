const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const isDev = require('electron-is-dev');
const serve = require('electron-serve').default;

// Configure electron-serve to serve the Next.js static files
const loadURL = serve({ 
  directory: path.join(__dirname, '../apps/frontend/out')
});

// Simple in-memory store for now
const simpleStore = new Map();

let mainWindow;
let backendProcess = null;
const BACKEND_PORT = process.env.BACKEND_PORT || 8000; // Match backend default

// Backend management
async function startBackend() {
  if (backendProcess) {
    console.log('Backend already running');
    return true;
  }

  const backendPath = isDev 
    ? path.join(__dirname, '../apps/backend')
    : path.join(process.resourcesPath, 'apps/backend');

  console.log('Starting backend from:', backendPath);

  // Start Python backend using virtual environment
  const venvPath = path.join(backendPath, 'venv/bin/python');
  const pythonCmd = require('fs').existsSync(venvPath) ? venvPath : (process.platform === 'win32' ? 'python' : 'python3');
  console.log('Using Python:', pythonCmd);
  
  backendProcess = spawn(pythonCmd, ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', BACKEND_PORT.toString()], {
    cwd: backendPath,
    stdio: isDev ? 'inherit' : 'pipe',
    env: { ...process.env, BACKEND_PORT: BACKEND_PORT.toString() }
  });

  backendProcess.on('error', (error) => {
    console.error('Backend process error:', error);
    backendProcess = null;
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend process exited with code ${code}`);
    backendProcess = null;
  });

  // Wait for backend to be ready
  console.log('Waiting for backend to start...');
  const backendReady = await waitForBackend(`http://localhost:${BACKEND_PORT}`);
  
  if (backendReady) {
    console.log('Backend started successfully');
    return true;
  } else {
    console.error('Backend failed to start within timeout');
    if (backendProcess) {
      backendProcess.kill();
      backendProcess = null;
    }
    return false;
  }
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
    console.log('Backend stopped');
  }
}

async function waitForBackend(url, attempts = 60, delayMs = 1000) {
  console.log(`Waiting for backend at ${url} (max ${attempts * delayMs / 1000}s)`);
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const res = await fetch(url + '/health', { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        console.log('Backend health check passed:', data);
        return true;
      } else {
        console.log(`Health check failed with status: ${res.status}`);
      }
    } catch (error) {
      console.log(`Health check attempt ${i + 1}/${attempts} failed:`, error.message);
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

async function createWindow() {
  // Start backend first and wait for it to be ready
  const backendStarted = await startBackend();
  if (!backendStarted) {
    console.error('Failed to start backend - app may not function correctly');
    // Show error dialog
    const { dialog } = require('electron');
    await dialog.showErrorBox(
      'Backend Startup Failed',
      `Failed to start the backend server on port ${BACKEND_PORT}. The application may not function correctly. Please check the console for errors.`
    );
  }

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
  // Security: keep enabled even in dev to avoid warnings
  webSecurity: true,
  // Do NOT allow insecure mixed content
  allowRunningInsecureContent: false,
  // Disable experimental features unless explicitly required
  experimentalFeatures: false,
  // Additional hardening options (future): sandbox: true,
    },
    show: true, // Show immediately
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: isDev 
      ? path.join(__dirname, '../apps/frontend/public/favicon.ico')
      : path.join(process.resourcesPath, 'apps/frontend/public/favicon.ico')
  });

  // CSP: apply a stricter policy ONLY in production; relax in dev to avoid blocking Next.js inline bootstrap.
  try {
    const session = mainWindow.webContents.session;
    if (!session.__cspHookInstalled) {
      session.webRequest.onHeadersReceived((details, callback) => {
        const headers = details.responseHeaders || {};
        const lower = Object.fromEntries(Object.keys(headers).map(k => [k.toLowerCase(), k]));
        if (!lower['content-security-policy']) {
          const prodCsp = [
            "default-src 'self'",
            "script-src 'self'", // no inline/eval in packaged build
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "font-src 'self'",
            "connect-src 'self' https://api.openai.com http://localhost:" + BACKEND_PORT,
            "worker-src 'self' blob:",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'self'"
          ].join('; ');
          const devCsp = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "font-src 'self'",
            "connect-src 'self' ws://localhost:* http://localhost:* https://api.openai.com",
            "worker-src 'self' blob:",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'self'"
          ].join('; ');
          headers['Content-Security-Policy'] = [(process.env.NODE_ENV === 'production') ? prodCsp : devCsp];
        }
        callback({ responseHeaders: headers });
      });
      session.__cspHookInstalled = true;
    }
  } catch (e) {
    console.warn('CSP setup failed:', e);
  }

  // Load the frontend application
  await loadURL(mainWindow);
  
  // DevTools: only auto-open if explicitly requested (set OPEN_DEVTOOLS=1)
  const autoOpenDevTools = process.env.OPEN_DEVTOOLS === '1';
  if (isDev && autoOpenDevTools) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Ensure window is visible and focused
  mainWindow.show();
  mainWindow.focus();

  // Fallback: show window after a short delay if ready-to-show doesn't fire
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('Fallback: showing window after timeout');
      mainWindow.show();
      mainWindow.focus();
    }
  }, 3000);

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Excel File...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('file-selected', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Export Results...',
          accelerator: 'CmdOrCtrl+S',
          click: async () => {
            const result = await dialog.showSaveDialog(mainWindow, {
              filters: [
                { name: 'Excel Files', extensions: ['xlsx'] },
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'Text Files', extensions: ['txt'] }
              ]
            });
            
            if (!result.canceled) {
              mainWindow.webContents.send('export-requested', result.filePath);
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Restart Backend',
          click: async () => {
            stopBackend();
            const restarted = await startBackend();
            if (!restarted) {
              dialog.showErrorBox('Restart Failed', 'Failed to restart the backend server.');
            }
          }
        },
        {
          label: 'Backend Status',
          click: () => {
            const status = backendProcess ? 'Running' : 'Stopped';
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Backend Status',
              message: `Backend is currently: ${status}`,
              buttons: ['OK']
            });
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Consulting Toolkit',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Consulting Toolkit',
              message: 'Consulting Toolkit\nVersion 1.0.0\n\nA comprehensive suite of business consulting tools.',
              buttons: ['OK']
            });
          }
        },
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal(`http://localhost:${BACKEND_PORT}/docs`);
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event listeners
app.whenReady().then(async () => {
  await createWindow(); // Backend is started inside createWindow now
  createMenu();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('get-store-value', (event, key) => {
  return simpleStore.get(key) || null;
});

ipcMain.handle('set-store-value', (event, key, value) => {
  simpleStore.set(key, value);
});

ipcMain.handle('get-backend-status', () => {
  return {
    running: backendProcess !== null,
    port: BACKEND_PORT,
    url: `http://localhost:${BACKEND_PORT}`
  };
});

ipcMain.handle('restart-backend', async () => {
  stopBackend();
  const restarted = await startBackend();
  return restarted;
});
