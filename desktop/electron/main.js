'use strict';

/**
 * Chttrix Desktop — Electron Main Process
 *
 * Responsibilities:
 *  1. Create and manage the main BrowserWindow (loads the Chttrix web client)
 *  2. Persist and restore window state (bounds, maximized) via electron-store
 *  3. Security: navigation guard, permission handlers, CSP for local pages
 *  4. System tray integration (open, DnD, updates, quit)
 *  5. Native desktop notifications with deep-link click routing
 *  6. IPC bridge: notify, badge, settings, version, deep-link events
 *  7. Background running — closing the window hides it; quit via tray/menu
 *  8. Single instance + chttrix:// deep links + auto-update
 */

const {
  app, BrowserWindow, ipcMain, session, shell, Menu, dialog,
} = require('electron');
const path = require('path');
const { fileURLToPath } = require('url');
const store = require('./store');
const { createTray, setUnreadCount, refreshTrayMenu } = require('./tray');
const notifications = require('./notifications');

// ─── Configuration ────────────────────────────────────────────────────────────
const IS_DEV = process.env.ELECTRON_IS_DEV === '1' ||
               process.env.NODE_ENV === 'development';

const PROD_URL = 'https://app.chttrix.com';
// Dev: the client's Vite server (client/vite.config.js → port 3000, strictPort).
// Prod: the hosted client. Either can be overridden via CHTTRIX_WEB_URL.
const WEB_URL = process.env.CHTTRIX_WEB_URL ||
  (IS_DEV ? 'http://localhost:3000' : PROD_URL);

const PROTOCOL = 'chttrix';
const OFFLINE_PAGE = path.join(__dirname, '..', 'renderer', 'index.html');

function originOf(url) {
  try { return new URL(url).origin; } catch { return null; }
}

// Origins the app window may navigate to / open in-app.
const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5001'];
const ALLOWED_ORIGINS = new Set([
  PROD_URL,
  'https://api.chttrix.com',
  originOf(WEB_URL),                       // C12: CHTTRIX_WEB_URL override
  ...(IS_DEV ? DEV_ORIGINS : []),          // C4: dev ports only in dev
].filter(Boolean));

// Origins allowed to receive media / notification / clipboard permissions.
const PERMISSION_ORIGINS = new Set([
  PROD_URL,
  originOf(WEB_URL),
  ...(IS_DEV ? DEV_ORIGINS : []),
].filter(Boolean));
const GRANTABLE_PERMISSIONS = new Set([
  'media', 'notifications', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen',
]);

// Schemes we are willing to hand to the OS (C3). Everything else is dropped.
const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

// Content-Security-Policy for local (file://) pages — the offline fallback.
const LOCAL_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

// ─── State ────────────────────────────────────────────────────────────────────
let mainWindow = null;
let isQuitting = false;        // C5: lets close handlers distinguish hide vs quit
let pendingDeepLink = null;    // deep link received before the web client loaded
let autoUpdater = null;

// ─── Single-instance lock (P1) ────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isLocalAppFile(urlString) {
  try {
    if (!urlString.startsWith('file://')) return false;
    return fileURLToPath(urlString).startsWith(app.getAppPath());
  } catch {
    return false;
  }
}

function isAllowedUrl(urlString) {
  if (isLocalAppFile(urlString)) return true;
  const origin = originOf(urlString);
  return origin !== null && ALLOWED_ORIGINS.has(origin);
}

// Identity providers whose sign-in popups must open inside the app.
const OAUTH_POPUP_ORIGINS = new Set([
  'https://accounts.google.com',
  'https://github.com',
  'https://www.linkedin.com',
]);

function isOAuthPopupUrl(urlString) {
  try {
    const { origin, protocol } = new URL(urlString);
    return protocol === 'https:' && OAUTH_POPUP_ORIGINS.has(origin);
  } catch {
    return false;
  }
}

function openExternalSafely(urlString) {
  try {
    const { protocol } = new URL(urlString);
    if (EXTERNAL_PROTOCOLS.has(protocol)) {
      shell.openExternal(urlString).catch((err) =>
        console.warn('[Security] openExternal failed:', err.message));
      return;
    }
  } catch {
    // unparsable → fall through and deny
  }
  console.warn('[Security] Refused to open external URL:', urlString);
}

function isTrustedPermissionOrigin(url) {
  const origin = originOf(url || '');
  return origin !== null && PERMISSION_ORIGINS.has(origin);
}

function windowAlive() {
  return mainWindow && !mainWindow.isDestroyed();
}

/** Show + focus the window, recreating it if it was destroyed (C6). */
function showWindow() {
  if (!app.isReady()) return;
  if (!windowAlive()) {
    createWindow();
    return; // shown on ready-to-show
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function toggleWindow() {
  if (windowAlive() && mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

function sendToRenderer(channel, payload) {
  if (windowAlive()) mainWindow.webContents.send(channel, payload);
}

function isOnWebClient() {
  return windowAlive() && isAllowedUrl(mainWindow.webContents.getURL()) &&
    !isLocalAppFile(mainWindow.webContents.getURL());
}

function loadWebClient() {
  if (!windowAlive()) return;
  mainWindow.loadURL(WEB_URL).catch((err) => {
    console.error('[Main] Failed to load URL:', WEB_URL, err.message);
    if (!windowAlive()) return;
    mainWindow.loadFile(OFFLINE_PAGE).catch((fileErr) => {
      console.error('[Main] Failed to load offline page:', fileErr.message);
    });
  });
}

// ─── Notification state (single code path for tray + IPC, C8) ────────────────
function broadcastNotificationState() {
  refreshTrayMenu();
  sendToRenderer('notifications-toggled', {
    enabled: notifications.isEnabled(),
    doNotDisturb: notifications.isDoNotDisturb(),
  });
}

function applyNotificationsEnabled(enabled) {
  notifications.setEnabled(enabled);
  store.set('notificationsEnabled', !!enabled);
  broadcastNotificationState();
}

function applyDoNotDisturb(value) {
  notifications.setDoNotDisturb(value);
  store.set('doNotDisturb', !!value);
  broadcastNotificationState();
}

// ─── Deep links (P2) ──────────────────────────────────────────────────────────
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const WORKSPACE_SECTIONS = new Set([
  'home', 'channels', 'messages', 'tasks', 'notes', 'files', 'knowledge',
  'updates', 'apps', 'search', 'huddles',
]);
const WORKSPACE_ITEMS = new Set(['channel', 'dm', 'notes', 'files', 'knowledge', 'meetings']);

/**
 * Parse chttrix://workspace/<wsId>[/<section>[/<id>]] into a safe in-app route.
 * Returns null for anything unrecognised.
 *   chttrix://workspace/abc/channel/123 → { path: '/workspace/abc/channel/123', ... }
 */
function parseDeepLink(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== `${PROTOCOL}:`) return null;

  // chttrix://workspace/abc → host "workspace", path "/abc"
  let parts;
  try {
    parts = [url.hostname, ...url.pathname.split('/')].filter(Boolean)
      .map((p) => decodeURIComponent(p));
  } catch {
    return null; // malformed percent-encoding
  }

  if (parts[0] === 'workspaces' && parts.length === 1) {
    return { path: '/workspaces', kind: 'workspaces' };
  }
  if (parts[0] !== 'workspace' || !ID_RE.test(parts[1] || '')) return null;
  const workspaceId = parts[1];
  const [, , section, id] = parts;

  if (!section) return { path: `/workspace/${workspaceId}/home`, workspaceId, kind: 'home' };
  if (id !== undefined) {
    if (!WORKSPACE_ITEMS.has(section) || !ID_RE.test(id) || parts.length > 4) return null;
    return { path: `/workspace/${workspaceId}/${section}/${id}`, workspaceId, kind: section, id };
  }
  if (!WORKSPACE_SECTIONS.has(section)) return null;
  return { path: `/workspace/${workspaceId}/${section}`, workspaceId, kind: section };
}

function handleDeepLink(raw) {
  const link = parseDeepLink(raw);
  if (!link) {
    if (raw) console.warn('[DeepLink] Ignored:', raw);
    return;
  }
  showWindow();
  if (isOnWebClient() && !mainWindow.webContents.isLoading()) {
    sendToRenderer('deep-link', link);
  } else {
    pendingDeepLink = link; // flushed on did-finish-load
  }
}

function findDeepLinkArg(argv = []) {
  return argv.find((a) => typeof a === 'string' && a.startsWith(`${PROTOCOL}://`));
}

function registerProtocol() {
  try {
    if (process.defaultApp && process.argv.length >= 2) {
      // `electron .` in development: register the electron binary + app path
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }
  } catch (err) {
    console.warn('[DeepLink] Could not register protocol:', err.message);
  }
}

// ─── Auto-update (P3) ─────────────────────────────────────────────────────────
let manualUpdateCheck = false;

function initAutoUpdater() {
  if (!app.isPackaged) return;
  try {
    ({ autoUpdater } = require('electron-updater'));
    autoUpdater.on('error', (err) => {
      console.warn('[Updater] error:', err && err.message);
      if (manualUpdateCheck) {
        manualUpdateCheck = false;
        dialog.showMessageBox({ type: 'error', message: 'Could not check for updates.', detail: String(err && err.message) });
      }
    });
    autoUpdater.on('update-not-available', () => {
      if (!manualUpdateCheck) return;
      manualUpdateCheck = false;
      dialog.showMessageBox({ type: 'info', message: 'Chttrix is up to date.', detail: `Version ${app.getVersion()}` });
    });
    autoUpdater.on('update-available', () => { manualUpdateCheck = false; });
    // Make sure hide-on-close doesn't block the updater's quit-and-install.
    autoUpdater.on('before-quit-for-update', () => { isQuitting = true; });
    autoUpdater.checkForUpdatesAndNotify().catch((err) =>
      console.warn('[Updater] check failed:', err && err.message));
  } catch (err) {
    autoUpdater = null;
    console.warn('[Updater] unavailable:', err.message);
  }
}

function checkForUpdatesManually() {
  if (!autoUpdater) {
    dialog.showMessageBox({
      type: 'info',
      message: 'Updates are only available in packaged builds.',
      detail: `Version ${app.getVersion()}`,
    });
    return;
  }
  manualUpdateCheck = true;
  autoUpdater.checkForUpdatesAndNotify().catch((err) =>
    console.warn('[Updater] manual check failed:', err && err.message));
}

// ─── Application menu (P5) ────────────────────────────────────────────────────
function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Check for Updates…', click: checkForUpdatesManually },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Session security (registered once, C2 + C4) ─────────────────────────────
function configureSession() {
  const ses = session.defaultSession;

  // C2: inject a CSP for local pages only; remote pages keep their own headers.
  // (The offline page also carries an equivalent <meta> CSP, since some
  // Electron versions do not route file:// responses through webRequest.)
  ses.webRequest.onHeadersReceived((details, callback) => {
    if (details.url.startsWith('file://')) {
      const responseHeaders = { ...(details.responseHeaders || {}) };
      for (const key of Object.keys(responseHeaders)) {
        if (key.toLowerCase() === 'content-security-policy') delete responseHeaders[key];
      }
      responseHeaders['Content-Security-Policy'] = [LOCAL_CSP];
      callback({ responseHeaders });
      return;
    }
    callback({});
  });

  // C4: grant only to the Chttrix web client's own origin(s).
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = (details && details.requestingUrl) || webContents.getURL();
    callback(GRANTABLE_PERMISSIONS.has(permission) && isTrustedPermissionOrigin(requestingUrl));
  });

  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    if (!GRANTABLE_PERMISSIONS.has(permission)) return false;
    const url = requestingOrigin || (webContents ? webContents.getURL() : '');
    return isTrustedPermissionOrigin(url);
  });
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
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0c0c0c',  // match Chttrix dark theme
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      nodeIntegration:  false,   // NEVER expose Node.js to renderer
      contextIsolation: true,    // isolate preload context from renderer world
      sandbox:          true,    // Chromium sandbox
      webSecurity:      true,    // enforce same-origin
      allowRunningInsecureContent: false,
    },
  });

  const win = mainWindow;

  // ── Show once ready to paint ───────────────────────────────────────────────
  win.once('ready-to-show', () => {
    if (wasMaximized) win.maximize();
    win.show();
    if (IS_DEV) win.webContents.openDevTools();
  });

  // ── Load the Chttrix web client (falls back to the offline page) ──────────
  loadWebClient();

  // ── Flush a deep link that arrived before the client was ready ────────────
  win.webContents.on('did-finish-load', () => {
    if (pendingDeepLink && isOnWebClient()) {
      const link = pendingDeepLink;
      pendingDeepLink = null;
      // Give the SPA a moment to mount its bridge listeners.
      setTimeout(() => sendToRenderer('deep-link', link), 500);
    }
  });

  // ── Persist window state on resize / move ─────────────────────────────────
  const saveBounds = () => {
    if (win.isDestroyed() || win.isMaximized() || win.isMinimized()) return;
    store.set('windowBounds', win.getBounds());
  };
  win.on('resize', saveBounds);
  win.on('move',   saveBounds);
  win.on('maximize',   () => store.set('windowMaximized', true));
  win.on('unmaximize', () => store.set('windowMaximized', false));

  // ── Hide instead of close on every platform unless quitting (C5/C6) ───────
  win.on('close', (event) => {
    saveBounds();
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  // ── Security: block navigation to untrusted origins (C3) ──────────────────
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      console.warn('[Security] Blocked navigation to:', url);
      openExternalSafely(url);
    }
  });

  // ── Security: open external links in the system browser (C3) ──────────────
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) return { action: 'allow' };

    // OAuth providers open a popup (window.open) and talk back to the opener
    // with postMessage, so they must stay inside Electron. The popup gets a
    // locked-down, preload-free window and no access to the desktop bridge.
    if (isOAuthPopupUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 680,
          autoHideMenuBar: true,
          title: 'Sign in',
          webPreferences: {
            preload: undefined,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        },
      };
    }

    openExternalSafely(url);
    return { action: 'deny' };
  });

  return win;
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function str(value, max = 500) {
  if (value === undefined || value === null) return undefined;
  return String(value).slice(0, max);
}

// ── Notifications ──────────────────────────────────────────────────────────
ipcMain.on('notify', (_e, payload) => {
  try {
    const p = payload && typeof payload === 'object' ? payload : {};
    const type = ['message', 'task', 'mention', 'system'].includes(p.type) ? p.type : 'system';
    const ctx = {
      type,
      workspaceId: str(p.workspaceId, 64),
      channelId:   str(p.channelId, 64),
      dmSessionId: str(p.dmSessionId, 64),
    };

    const onClick = () => {
      showWindow();
      sendToRenderer('notification-clicked', ctx);
    };

    switch (type) {
      case 'message':
        notifications.notifyMessage({ senderName: str(p.senderName, 100), preview: str(p.preview), onClick });
        break;
      case 'task':
        notifications.notifyTaskReminder({ taskTitle: str(p.taskTitle, 200), dueDate: str(p.dueDate, 64), onClick });
        break;
      case 'mention':
        notifications.notifyMention({ senderName: str(p.senderName, 100), channelName: str(p.channelName, 100), onClick });
        break;
      default:
        notifications.showNotification({ title: str(p.title, 200), body: str(p.body), onClick });
    }
  } catch (err) {
    console.warn('[IPC] notify failed:', err.message);
  }
});

// ── Badge / Unread Count (C9) ──────────────────────────────────────────────
ipcMain.on('set-unread-count', (_e, payload) => {
  const count = payload && typeof payload === 'object' ? payload.count : undefined;
  if (!Number.isInteger(count) || count < 0) return;
  try {
    setUnreadCount(Math.min(count, 99999));
  } catch (err) {
    console.warn('[IPC] set-unread-count failed:', err.message);
  }
});

// ── Toggle Notifications (from renderer) ───────────────────────────────────
ipcMain.on('toggle-notifications', () => {
  applyNotificationsEnabled(!notifications.isEnabled());
});

// ── Query Notification State ───────────────────────────────────────────────
ipcMain.handle('get-notification-state', () => ({
  enabled: notifications.isEnabled(),
  doNotDisturb: notifications.isDoNotDisturb(),
}));

// ── Settings (allowlisted key-value, C8) ───────────────────────────────────
const SETTINGS = {
  notificationSound:    (v) => typeof v === 'boolean',
  lastUrl:              (v) => typeof v === 'string' && v.length <= 2048,
  doNotDisturb:         (v) => typeof v === 'boolean',
  notificationsEnabled: (v) => typeof v === 'boolean',
};

ipcMain.handle('get-settings', () => {
  const out = {};
  for (const key of Object.keys(SETTINGS)) out[key] = store.get(key);
  return out;
});

ipcMain.on('save-setting', (_e, payload) => {
  try {
    const { key, value } = payload && typeof payload === 'object' ? payload : {};
    if (!Object.prototype.hasOwnProperty.call(SETTINGS, key) || !SETTINGS[key](value)) {
      console.warn('[IPC] save-setting rejected:', key);
      return;
    }
    switch (key) {
      case 'notificationsEnabled': applyNotificationsEnabled(value); break;
      case 'doNotDisturb':         applyDoNotDisturb(value); break;
      case 'notificationSound':
        notifications.setSoundEnabled(value);
        store.set(key, value);
        break;
      default:
        store.set(key, value);
    }
  } catch (err) {
    console.warn('[IPC] save-setting failed:', err.message);
  }
});

// ── App Version ────────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());

// ── Show Window (from renderer or notification click) ─────────────────────
ipcMain.on('show-window', () => showWindow());

// ── Offline page retry ─────────────────────────────────────────────────────
ipcMain.on('retry-connect', (event) => {
  if (!windowAlive() || event.sender !== mainWindow.webContents) return;
  if (!isLocalAppFile(mainWindow.webContents.getURL())) return; // only from offline page
  loadWebClient();
});

// ─── Lifecycle ────────────────────────────────────────────────────────────────

if (gotLock) {
  // Win/Linux: a second launch (incl. clicking a chttrix:// link) lands here.
  app.on('second-instance', (_event, argv) => {
    const link = findDeepLinkArg(argv);
    if (link) handleDeepLink(link);
    else showWindow();
  });

  // macOS: deep links arrive via open-url (may fire before ready).
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (app.isReady()) handleDeepLink(url);
    else pendingDeepLink = parseDeepLink(url);
  });

  app.whenReady().then(() => {
    // Restore notification state from store
    notifications.setEnabled(store.get('notificationsEnabled'));
    notifications.setDoNotDisturb(store.get('doNotDisturb'));
    notifications.setSoundEnabled(store.get('notificationSound'));

    configureSession();
    registerProtocol();
    buildAppMenu();

    // Cold start via deep link on Windows/Linux
    const argvLink = findDeepLinkArg(process.argv);
    if (argvLink) pendingDeepLink = parseDeepLink(argvLink);

    createWindow();
    createTray({
      openWindow: showWindow,
      toggleWindow,
      setNotificationsEnabled: applyNotificationsEnabled,
      setDoNotDisturb: applyDoNotDisturb,
      checkForUpdates: checkForUpdatesManually,
      quit: () => app.quit(),
    });

    initAutoUpdater();

    // macOS: dock icon clicked (C7)
    app.on('activate', () => {
      if (windowAlive()) showWindow();
      else createWindow();
    });
  });
}

// Keep the app alive in the background (tray-based persistence).
// Windows are hidden rather than closed, so this only fires while quitting.
app.on('window-all-closed', () => {
  // Intentionally empty: the tray keeps the app alive; quit via tray/menu.
});

// Quit from tray, app menu, Cmd+Q, OS shutdown or updater (C5).
app.on('before-quit', () => {
  isQuitting = true;
  if (windowAlive()) {
    store.set('windowMaximized', mainWindow.isMaximized());
    if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  }
});
