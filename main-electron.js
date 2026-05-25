const { app, BrowserWindow, Tray, Menu, Notification } = require('electron');
const path = require('path');
const http = require('http');

// ─── Single Instance Lock ─────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let tray = null;
app.isQuitting = false;

// ─── Icon Path Resolution ─────────────────────────────────────────────────────
// When packaged, __dirname points inside the asar which is read-only.
// We must use process.resourcesPath to locate bundled assets correctly.
function getAppIconPath() {
  const iconFile = process.platform === 'win32' ? 'sw-here-logo.ico' : 'sw-here-logo.png';
  if (app.isPackaged) {
    // asarUnpack puts files in app.asar.unpacked next to app.asar
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'public', 'images', iconFile);
  }
  return path.join(__dirname, 'public', 'images', iconFile);
}

// ─── Uploads Directory (Writable in Packaged App) ────────────────────────────
// Must be set BEFORE requiring app.js so multer uses the right writable path
function getUploadsDir() {
  if (app.isPackaged) {
    // app.getPath('userData') is always writable, even when installed
    return path.join(app.getPath('userData'), 'uploads');
  }
  return path.join(__dirname, 'uploads');
}

// ─── Graceful Exception Handler ───────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('[Electron] Port 3000 already in use — assuming server is running.');
  } else {
    console.error('[Electron] Uncaught Exception:', err.message, err.stack);
  }
});

// ─── Boot Express Server ──────────────────────────────────────────────────────
function startServer() {
  try {
    // Inject writable uploads path before requiring app.js
    process.env.PORT = process.env.PORT || '3000';
    process.env.SW_UPLOADS_DIR = getUploadsDir();

    const fs = require('fs');
    if (!fs.existsSync(process.env.SW_UPLOADS_DIR)) {
      fs.mkdirSync(process.env.SW_UPLOADS_DIR, { recursive: true });
    }

    require('./app.js');
    console.log('[Electron] Express server booted.');
  } catch (err) {
    console.error('[Electron] Server boot error:', err.message);
  }
}

// ─── Wait for Server to be Ready ─────────────────────────────────────────────
function waitForServer(url, timeout, callback) {
  const start = Date.now();

  function attempt() {
    http.get(url, (res) => {
      callback(null); // Server is up
    }).on('error', () => {
      if (Date.now() - start > timeout) {
        callback(new Error('Server did not start in time'));
      } else {
        setTimeout(attempt, 200); // Retry every 200ms
      }
    });
  }

  attempt();
}

// ─── Create Main Window ───────────────────────────────────────────────────────
function createWindow() {
  const iconPath = getAppIconPath();

  mainWindow = new BrowserWindow({
    width: 500,
    height: 680,
    minWidth: 420,
    minHeight: 600,
    resizable: true,
    icon: iconPath,
    backgroundColor: '#08080a',
    title: 'SW-HERE',
    show: false, // Don't show until server is ready
    titleBarStyle: 'hidden',        // Hide default title text, keep native controls
    titleBarOverlay: {
      color: '#08080a',             // Match app's pitch-black navbar background
      symbolColor: '#94a3b8',       // Slate-400 — soft icon color matching UI
      height: 38                    // Match header height
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // Wait for server to be ready before loading
  waitForServer('http://localhost:3000', 10000, (err) => {
    if (err) {
      console.error('[Electron] Server timed out. Loading error page.');
      mainWindow.loadURL(`data:text/html,<h2 style="font-family:sans-serif;color:#ef4444;padding:40px">SW-HERE failed to start the local server. Please restart the app.</h2>`);
    } else {
      mainWindow.loadURL('http://localhost:3000');
    }

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      if (Notification.isSupported()) {
        const notification = new Notification({
          title: 'SW-HERE',
          body: 'Minimized to system tray. Still running in the background.',
          icon: iconPath,
          silent: true
        });
        notification.show();
      }
    }
    return false;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── System Tray ─────────────────────────────────────────────────────────────
function createTray() {
  try {
    const iconPath = getAppIconPath();
    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open SW-HERE',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: 'Toggle Light/Dark Theme',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.executeJavaScript(`
              const themeBtn = document.getElementById('theme-toggle-btn');
              if (themeBtn) themeBtn.click();
            `);
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit Application',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('SW-HERE | Hybrid P2P Share');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.error('[Electron] Tray creation failed:', err.message);
  }
}

// ─── Second Instance ──────────────────────────────────────────────────────────
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// ─── App Ready ───────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Remove the native File/Edit/View/Window menu bar completely
  Menu.setApplicationMenu(null);

  startServer();
  createWindow();
  createTray();
  console.log('[Electron] App initialized successfully.');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
