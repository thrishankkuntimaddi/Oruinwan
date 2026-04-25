'use strict';

/**
 * Chttrix Desktop — Electron Main Process
 *
 * Responsibilities:
 *  1. Create and manage the main BrowserWindow (loads the Chttrix web client)
 *  2. Persist and restore window state (bounds, maximized) via electron-store
 *  3. Security: will-navigate guard, permission request handler, CSP
 *  4. System tray integration (open, DnD, quit)
 *  5. Native desktop notifications with deep-link click routing
 *  6. IPC bridge: notify, badge, settings, version, deep-link events
 *  7. Background running — app stays alive when window is closed (tray)
 */

const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const store = require('./store');
const { createTray, setUnreadCount, refreshTrayMenu } = require('./tray');
const notifications = require('./notifications');

// ─── Configuration ────────────────────────────────────────────────────────────
const IS_DEV = process.env.ELECTRON_IS_DEV === '1' ||
               process.env.NODE_ENV === 'development';

// In dev: load the Vite dev server. In prod: load the configured deployment URL.
// The production URL can also be overridden via CHTTRIX_WEB_URL env var.
const WEB_URL = process.env.CHTTRIX_WEB_URL ||
  (IS_DEV ? 'http://localhost:5173' : 'https://app.chttrix.com');

// Allowed origins for will-navigate and new-window guards
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5001',
  'https://app.chttrix.com',
  'https://api.chttrix.com',
];

// ─── Window Reference ─────────────────────────────────────────────────────────
let mainWindow = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isAllowedUrl(urlString) {
  try {
    const { origin } = new URL(urlString);
    return ALLOWED_ORIGINS.some((allowed) => origin === new URL(allowed).origin);
  } catch {
    return false;
  }
}

function focusWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ─── Window Factory ───────────────────────────────────────────────────────────
function createWindow() {
  const savedBounds   = store.get('windowBounds');
  const wasMaximized  = store.get('windowMaximized');

  mainWindow = new BrowserWindow({
    ...savedBounds,
    minWidth:  900,
    minHeight: 600,
    title: 'Chttrix',
    show: false,  // show after ready-to-show to avoid blank flash
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f172a',  // match Chttrix dark theme
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      nodeIntegration:  false,   // NEVER expose Node.js to renderer
      contextIsolation: true,    // isolate preload context from renderer world
      sandbox:          true,    // Chromium sandbox
      webSecurity:      true,    // enforce same-origin
      allowRunningInsecureContent: false,
    },
  });

  // ── Load the Chttrix web client ────────────────────────────────────────────
  mainWindow.loadURL(WEB_URL).catch((err) => {
    console.error('[Main] Failed to load URL:', WEB_URL, err.message);
    // Load the offline fallback page if the web client is unreachable
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  });

  // ── Show once ready to paint ───────────────────────────────────────────────
  mainWindow.once('ready-to-show', () => {
    if (wasMaximized) {
      mainWindow.maximize();
    } else {
      mainWindow.show();
    }
    if (IS_DEV) mainWindow.webContents.openDevTools();
  });

  // ── Persist window state on resize / move ─────────────────────────────────
  const saveBounds = () => {
    if (!mainWindow || mainWindow.isMaximized() || mainWindow.isMinimized()) return;
    store.set('windowBounds', mainWindow.getBounds());
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move',   saveBounds);
  mainWindow.on('maximize',   () => store.set('windowMaximized', true));
  mainWindow.on('unmaximize', () => store.set('windowMaximized', false));

  // ── macOS: hide to tray when window is closed ──────────────────────────────
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
      event.preventDefault();
      mainWindow.hide();
    } else {
      // Windows/Linux: persist bounds before close
      store.set('windowBounds', mainWindow.getBounds());
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // ── Security: block navigation to untrusted origins ───────────────────────
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      console.warn('[Security] Blocked navigation to:', url);
      shell.openExternal(url); // open in system browser instead
    }
  });

  // ── Security: open external links in the system browser ───────────────────
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // ── Security: permission requests (camera, mic, etc.) ─────────────────────
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'notifications', 'clipboard-read', 'clipboard-sanitized-write'];
    callback(allowed.includes(permission));
  });

  return mainWindow;
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// ── Notifications ──────────────────────────────────────────────────────────
ipcMain.on('notify', (_e, payload = {}) => {
  const { type = 'system', senderName, preview, taskTitle, dueDate,
          channelName, channelId, dmSessionId, title, body } = payload;

  const onClick = (ctx) => {
    focusWindow();
    // Send deep-link context to renderer so it can navigate
    if (mainWindow) {
      mainWindow.webContents.send('notification-clicked', {
        type, channelId, dmSessionId,
      });
    }
  };

  switch (type) {
    case 'message':
      notifications.notifyMessage({ senderName, preview, onClick });
      break;
    case 'task':
      notifications.notifyTaskReminder({ taskTitle, dueDate, onClick });
      break;
    case 'mention':
      notifications.notifyMention({ senderName, channelName, onClick });
      break;
    default:
      notifications.showNotification({ title, body, onClick });
  }
});

// ── Badge / Unread Count ───────────────────────────────────────────────────
ipcMain.on('set-unread-count', (_e, { count = 0 } = {}) => {
  setUnreadCount(count);
});

// ── Toggle Notifications (from renderer) ───────────────────────────────────
ipcMain.on('toggle-notifications', () => {
  const next = !notifications.isEnabled();
  notifications.setEnabled(next);
  store.set('notificationsEnabled', next);
  refreshTrayMenu();
  // Broadcast back to renderer so UI can reflect state
  if (mainWindow) {
    mainWindow.webContents.send('notifications-toggled', { enabled: next });
  }
});

// ── Query Notification State ───────────────────────────────────────────────
ipcMain.handle('get-notification-state', () => ({
  enabled: notifications.isEnabled(),
  doNotDisturb: store.get('doNotDisturb'),
}));

// ── Settings (generic key-value) ───────────────────────────────────────────
ipcMain.handle('get-settings', () => store.store);

ipcMain.on('save-setting', (_e, { key, value }) => {
  if (key && key !== 'windowBounds' && key !== 'windowMaximized') {
    store.set(key, value);
  }
});

// ── App Version ────────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());

// ── Show Window (from renderer or notification click) ─────────────────────
ipcMain.on('show-window', () => focusWindow());

// ─── Lifecycle ────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Restore notification state from store
  notifications.setEnabled(store.get('notificationsEnabled'));

  createWindow();
  createTray(mainWindow);

  // macOS: re-create window when dock icon clicked with no windows open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// Keep the app alive in the background (tray-based persistence)
// On Windows/Linux: do NOT quit on window-all-closed — the tray keeps it alive.
// The user must select "Quit" from the tray menu to fully exit.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Intentionally not calling app.quit() — tray keeps app alive.
    // If no tray is available (edge case), app will remain in background.
  }
});

// Ensure clean quit (e.g. from tray "Quit" menu)
app.on('before-quit', () => {
  if (mainWindow) {
    store.set('windowBounds', mainWindow.getBounds());
    store.set('windowMaximized', mainWindow.isMaximized());
  }
});
