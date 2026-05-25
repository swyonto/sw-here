const { app, BrowserWindow, Tray, Menu, Notification } = require('electron');
const path = require('path');

// Prevent multiple instances of the app from running simultaneously
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

let mainWindow = null;
let tray = null;
app.isQuitting = false;

// Dynamically select the native icon format (.ico for Windows, .png for other OS)
const iconExt = process.platform === 'win32' ? 'ico' : 'png';
const appIconPath = path.join(__dirname, `public/images/sw-here-logo.${iconExt}`);

// Handle uncaught exceptions gracefully (e.g. port already in use)
process.on('uncaughtException', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('[Electron] Port 3000 is already in use. Assuming server is already running.');
  } else {
    console.error('[Electron] Uncaught Exception:', err);
  }
});

// Boot background Express server
function startServer() {
  try {
    process.env.PORT = process.env.PORT || '3000';
    // Require app.js which starts the server automatically
    require('./app.js');
    console.log('[Electron] Background Express server successfully loaded.');
  } catch (err) {
    console.error('[Electron] Failed to boot local server:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 680,
    minWidth: 420,
    minHeight: 600,
    resizable: true,
    icon: appIconPath,
    backgroundColor: '#09090b', // Zinc-950 dark background color
    title: 'SW-HERE | Hybrid P2P sharing',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // Load the locally hosted server URL
  mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // Send a native desktop notification to let user know it's in tray
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: 'SW-HERE',
          body: 'Application minimized to system tray and is still active.',
          icon: appIconPath,
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

function createTray() {
  tray = new Tray(appIconPath);

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
}

// Second instance focus behavior
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('ready', () => {
  startServer();
  createWindow();
  createTray();
  console.log('[Electron] Native app successfully initialized.');
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
