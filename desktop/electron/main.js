'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');

const WEB_URL = process.env.CHTTRIX_WEB_URL || 'http://localhost:5173';

/**
 * Creates the main BrowserWindow for the Chttrix desktop client.
 * The window loads the web client (local dev server or deployed URL).
 */
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Chttrix',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,      // Never expose Node.js to renderer
      contextIsolation: true,      // Isolate preload context from renderer
      sandbox: true,               // Additional sandboxing for renderer process
    },
  });

  // Load the Chttrix web client
  win.loadURL(WEB_URL);

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

// --- Lifecycle Events ---

app.whenReady().then(() => {
  createWindow();

  // macOS: re-create the window when the dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
