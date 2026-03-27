'use strict';

/**
 * Chttrix Desktop — Electron Main Process
 *
 * Responsibilities:
 *  1. Create and manage the main BrowserWindow (loads the Chttrix web client)
 *  2. System tray integration (open, toggle notifications, quit)
 *  3. Native desktop notifications (messages, tasks, mentions)
 *  4. Background sync — keep the app running when the window is closed
 *  5. IPC: bridge renderer requests for notifications / tray actions
 */

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { createTray, setUnreadCount } = require('./tray');
const notifications = require('./notifications');

// ─── Configuration ────────────────────────────────────────────────────────────
const IS_DEV = process.env.ELECTRON_IS_DEV === '1' ||
               process.env.NODE_ENV === 'development';

const WEB_URL = process.env.CHTTRIX_WEB_URL ||
  (IS_DEV ? 'http://localhost:5173' : 'http://localhost:5173');

// ─── Window Reference ─────────────────────────────────────────────────────────
let mainWindow = null;

// ─── Window Factory ───────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Chttrix',
    show: false,  // show after ready-to-show to avoid blank flash
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,   // never expose Node.js to renderer
      contextIsolation: true,   // isolate preload context
      sandbox: true,            // additional sandboxing
    },
  });

  // Load the Chttrix web client
  mainWindow.loadURL(WEB_URL);

  // Show the window once it is ready to paint (avoids blank flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (IS_DEV) mainWindow.webContents.openDevTools();
  });

  // macOS: hide to tray instead of quitting when window is closed
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

/**
 * Renderer → Main: trigger a native notification
 * Payload: { title, body, type, senderName, preview, taskTitle, dueDate, channelName }
 */
ipcMain.on('notify', (_event, payload = {}) => {
  const { type = 'system', senderName, preview, taskTitle, dueDate, channelName, title, body } = payload;

  switch (type) {
    case 'message':
      notifications.notifyMessage({ senderName, preview });
      break;
    case 'task':
      notifications.notifyTaskReminder({ taskTitle, dueDate });
      break;
    case 'mention':
      notifications.notifyMention({ senderName, channelName });
      break;
    default:
      notifications.showNotification({ title, body });
  }
});

/**
 * Renderer → Main: update unread badge count
 * Payload: { count }
 */
ipcMain.on('set-unread-count', (_event, { count = 0 } = {}) => {
  setUnreadCount(count);
});

/**
 * Renderer → Main: toggle desktop notifications on/off
 */
ipcMain.on('toggle-notifications', () => {
  notifications.setEnabled(!notifications.isEnabled());
});

/**
 * Renderer → Main: query current notification state
 */
ipcMain.handle('get-notification-state', () => ({
  enabled: notifications.isEnabled(),
}));

// ─── Lifecycle ────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  createTray();

  // macOS: re-create window when dock icon is clicked with no windows open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// Keep the app alive in the background (background sync)
// All windows closed → don't quit (managed via tray on macOS, or explicit quit on others)
app.on('window-all-closed', () => {
  // On macOS we let the tray keep things alive
  if (process.platform !== 'darwin') {
    // On Windows/Linux keep alive in background via tray
    // Only quit when user explicitly selects "Quit" from tray
  }
});
