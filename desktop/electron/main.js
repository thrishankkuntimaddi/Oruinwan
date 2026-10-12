'use strict';

/**
 * Oruinwan desktop — Electron main process.
 *
 * The window runs the Oruinwan web client (client/, built with `vite build --mode app`),
 * bundled into app/ and served from app://oruinwan. On first launch it asks for the team's
 * server address (client/src/appMode), then signs in to that self-hosted server.
 *
 *  1. app:// scheme serving the bundle (with in-app routes), with a Content-Security-Policy
 *  2. Server access like Android's native HTTP: CORS answered here, so any server works
 *  3. Security: sandboxed renderer, navigation locked to the app, links open in the browser
 *  4. Window state, single instance, menu, native notifications, dock/taskbar badge
 */

const { app, BrowserWindow, Menu, Notification, ipcMain, net, protocol, screen, session, shell } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

/**
 * scheme://host[:port]. Not URL#origin: that is the opaque "null" for custom schemes such as
 * app://, which would make every custom-scheme URL look like the app's own origin.
 */
function originOf(url) {
  try {
    const u = new URL(url);
    return u.host ? `${u.protocol}//${u.host}` : null;
  } catch {
    return null;
  }
}

const IS_DEV = process.env.ELECTRON_IS_DEV === '1' || process.env.NODE_ENV === 'development';
// Dev: the web client's Vite server in app mode (cd client && npx vite --mode app). Prod: the bundle.
const DEV_URL = process.env.ORUINWAN_DEV_URL || 'http://localhost:3000';
const SCHEME = 'app';
const APP_ORIGIN = `${SCHEME}://oruinwan`;
const START_URL = IS_DEV ? DEV_URL : `${APP_ORIGIN}/index.html`;
const PAGE_ORIGIN = originOf(START_URL);
const APP_DIR = path.join(__dirname, '..', 'app');
const REPO_URL = 'https://github.com/thrishankkuntimaddi/Oruniwan';

const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);
const GRANTABLE = new Set(['notifications', 'clipboard-read', 'clipboard-sanitized-write', 'media', 'fullscreen']);

// Must run before the app is ready. `standard` + `secure` give the bundle a real origin, so
// localStorage, IndexedDB and WebCrypto (the encryption keys) work as they do on https.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

let mainWindow = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function openExternalSafely(url) {
  try {
    if (EXTERNAL_PROTOCOLS.has(new URL(url).protocol)) {
      shell.openExternal(url).catch((err) => console.warn('[links] openExternal failed:', err.message));
      return true;
    }
  } catch {
    /* unparsable: refuse */
  }
  console.warn('[links] refused to open:', url);
  return false;
}

function showWindow() {
  if (!app.isReady()) return;
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ─── Window state (a small JSON file; no extra dependency) ────────────────────

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const b = saved.bounds;
    if (!b || ![b.x, b.y, b.width, b.height].every(Number.isFinite)) return { maximized: Boolean(saved.maximized) };
    // Forget the position if that screen is gone (e.g. an unplugged monitor).
    const visible = screen.getAllDisplays().some(({ workArea: a }) =>
      b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y);
    return {
      bounds: visible ? b : { width: b.width, height: b.height },
      maximized: Boolean(saved.maximized),
    };
  } catch {
    return {};
  }
}

function saveWindowState(win) {
  if (win.isDestroyed() || win.isMinimized()) return;
  const state = { maximized: win.isMaximized(), bounds: win.isMaximized() ? win.getNormalBounds() : win.getBounds() };
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(state));
  } catch (err) {
    console.warn('[window] could not save state:', err.message);
  }
}

// ─── app:// — the bundled app ─────────────────────────────────────────────────

/** CSP for the bundle. Inline scripts in index.html (the theme bootstrap) are allowed by hash. */
function contentSecurityPolicy() {
  const hashes = [];
  try {
    const html = fs.readFileSync(path.join(APP_DIR, 'index.html'), 'utf8');
    for (const [, body] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
      hashes.push(`'sha256-${crypto.createHash('sha256').update(body).digest('base64')}'`);
    }
  } catch {
    /* no bundle yet: the page will 404 anyway */
  }
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    // Inter comes from Google Fonts (client/index.html); offline, the system font is used.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Servers are self-hosted at any address, so http(s) and ws(s) to anywhere. Frames show
    // PDF previews and video embeds.
    'img-src \'self\' data: blob: https: http:',
    'media-src \'self\' data: blob: https: http:',
    'connect-src \'self\' https: http: wss: ws:',
    'frame-src \'self\' blob: data: https: http:',
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

function registerAppScheme() {
  const csp = contentSecurityPolicy();
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'oruinwan') return new Response('Not found', { status: 404 });
    let rel;
    try {
      rel = decodeURIComponent(url.pathname);
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    let file = path.normalize(path.join(APP_DIR, rel === '/' ? '/index.html' : rel));
    if (!file.startsWith(APP_DIR + path.sep)) return new Response('Forbidden', { status: 403 });
    let exists = false;
    try {
      exists = fs.statSync(file).isFile();
    } catch {
      /* missing */
    }
    if (!exists) {
      // In-app routes (/login, /workspace/…) are the single-page app's index.html.
      if (path.extname(rel)) return new Response('Not found', { status: 404 });
      file = path.join(APP_DIR, 'index.html');
    }
    const res = await net.fetch(pathToFileURL(file).toString());
    if (!file.endsWith('.html')) return res;
    const headers = new Headers(res.headers);
    headers.set('Content-Security-Policy', csp);
    return new Response(res.body, { status: res.status, headers });
  });
}

// ─── Servers: answer CORS like Android's native HTTP does ─────────────────────
//
// The app talks to self-hosted servers (fetch with Authorization and x-client-platform
// headers, socket.io over WebSocket). Servers only list their own web origins for CORS, so
// for this app's session the main process answers CORS itself: preflights succeed, responses
// carry Access-Control-Allow-Origin for the app, and Cross-Origin-Resource-Policy (helmet's
// same-origin default) is dropped so avatars and uploads display. This session only ever
// hosts the app's own page (navigation is locked below), so nothing else gains this access.

function answerCors(ses) {
  const filter = { urls: ['http://*/*', 'https://*/*'] };
  // request id → { origin, headers } from the request, needed to answer its response.
  // After a cross-origin redirect (e.g. GitHub release downloads) Chromium sends Origin: null.
  const requests = new Map();
  const header = (headers, name) => headers[Object.keys(headers).find((k) => k.toLowerCase() === name)];

  ses.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const origin = header(details.requestHeaders, 'origin');
    if (origin === PAGE_ORIGIN || origin === 'null') {
      requests.set(details.id, { origin, headers: header(details.requestHeaders, 'access-control-request-headers') });
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  ses.webRequest.onHeadersReceived(filter, (details, callback) => {
    const request = requests.get(details.id);
    requests.delete(details.id);
    if (!request) {
      // Not a CORS request from the app (images, navigations): only let uploads display.
      const headers = { ...details.responseHeaders };
      for (const name of Object.keys(headers)) if (name.toLowerCase() === 'cross-origin-resource-policy') delete headers[name];
      callback({ responseHeaders: headers });
      return;
    }
    const headers = {};
    for (const [name, value] of Object.entries(details.responseHeaders || {})) {
      const lower = name.toLowerCase();
      if (lower.startsWith('access-control-') || lower === 'cross-origin-resource-policy') continue;
      headers[name] = value;
    }
    headers['Access-Control-Allow-Origin'] = [request.origin];
    headers['Access-Control-Allow-Credentials'] = ['true'];
    headers['Access-Control-Expose-Headers'] = [Object.keys(headers).join(', ')];
    if (details.method === 'OPTIONS') {
      headers['Access-Control-Allow-Methods'] = ['GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS'];
      headers['Access-Control-Allow-Headers'] = [request.headers || 'Authorization, Content-Type, Accept, x-client-platform'];
      headers['Access-Control-Max-Age'] = ['600'];
      callback({ responseHeaders: headers, statusLine: 'HTTP/1.1 204 No Content' });
      return;
    }
    callback({ responseHeaders: headers });
  });

  ses.webRequest.onCompleted(filter, (details) => requests.delete(details.id));
  ses.webRequest.onErrorOccurred(filter, (details) => requests.delete(details.id));
}

function lockDownPermissions(ses) {
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = originOf((details && details.requestingUrl) || webContents.getURL());
    callback(GRANTABLE.has(permission) && origin === PAGE_ORIGIN);
  });
  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
    GRANTABLE.has(permission) && originOf(requestingOrigin) === PAGE_ORIGIN);
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  const state = loadWindowState();
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    ...state.bounds,
    // Narrow windows get the phone layout, wide ones the sidebar layout.
    minWidth: 380,
    minHeight: 560,
    title: 'Oruinwan',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0c0c0c', // the web client's background
    icon: process.platform === 'linux' ? path.join(__dirname, '..', 'assets', 'icon.png') : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
      additionalArguments: [`--oruinwan-version=${app.getVersion()}`],
    },
  });
  mainWindow = win;

  win.once('ready-to-show', () => {
    if (state.maximized) win.maximize();
    win.show();
    if (IS_DEV) win.webContents.openDevTools({ mode: 'detach' });
  });

  let saveTimer = null;
  const queueSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(win), 400);
  };
  win.on('resize', queueSave);
  win.on('move', queueSave);
  win.on('close', () => saveWindowState(win));
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  // The title carries the unread count (see oruinwan:badge); the page's <title> must not reset it.
  win.on('page-title-updated', (event) => event.preventDefault());

  // Only the app itself may load in the window; every other link opens in the browser.
  win.webContents.on('will-navigate', (event) => {
    if (originOf(event.url) === PAGE_ORIGIN) return;
    event.preventDefault();
    openExternalSafely(event.url);
  });
  win.webContents.on('will-redirect', (event) => {
    if (event.isMainFrame && originOf(event.url) !== PAGE_ORIGIN) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());

  win.loadURL(START_URL).catch((err) => console.error('[window] failed to load', START_URL, err.message));
  return win;
}

// ─── IPC (see preload.js) ─────────────────────────────────────────────────────

function fromAppPage(event) {
  return originOf(event.senderFrame && event.senderFrame.url) === PAGE_ORIGIN;
}

ipcMain.on('oruinwan:open-external', (event, url) => {
  if (fromAppPage(event) && typeof url === 'string' && url.length < 4096) openExternalSafely(url);
});

// Native notifications from the web client (client/src/desktop/bridge.js → preload.js).
// Kept referenced until closed: Electron drops click handlers of collected notifications.
const shownNotifications = new Set();
const clip = (value, max) => (value === undefined || value === null ? '' : String(value).slice(0, max));

ipcMain.on('oruinwan:notify', (event, payload) => {
  if (!fromAppPage(event) || !Notification.isSupported()) return;
  const p = payload && typeof payload === 'object' ? payload : {};
  const where = p.channelName ? ` in #${clip(p.channelName, 100)}` : '';
  const title = clip(p.title, 200)
    || (p.type === 'task' ? 'Task reminder' : p.senderName ? `${clip(p.senderName, 100)}${where}` : 'Oruinwan');
  const body = clip(p.body, 500) || clip(p.preview, 500) || clip(p.taskTitle, 200);
  const target = { workspaceId: clip(p.workspaceId, 64), channelId: clip(p.channelId, 64), dmSessionId: clip(p.dmSessionId, 64) };
  const notification = new Notification({ title, body });
  shownNotifications.add(notification);
  const forget = () => shownNotifications.delete(notification);
  notification.on('click', () => {
    forget();
    showWindow();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('oruinwan:notification-clicked', target);
  });
  notification.on('close', forget);
  notification.show();
});

ipcMain.on('oruinwan:badge', (event, count) => {
  if (!fromAppPage(event)) return;
  const n = Number.isFinite(count) ? Math.max(0, Math.min(9999, Math.floor(count))) : 0;
  try {
    app.setBadgeCount(n); // dock (macOS) and Unity launchers (Linux); a no-op elsewhere
  } catch {
    /* unsupported desktop */
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setTitle(n ? `Oruinwan (${n})` : 'Oruinwan');
  }
});

// ─── Menu ─────────────────────────────────────────────────────────────────────

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Oruinwan on GitHub', click: () => openExternalSafely(REPO_URL) },
        { label: 'All releases', click: () => openExternalSafely(`${REPO_URL}/releases`) },
        { label: 'Report a problem', click: () => openExternalSafely(`${REPO_URL}/issues/new`) },
      ],
    },
  ]));
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

if (process.platform === 'win32') app.setAppUserModelId('com.oruinwan.desktop');

app.whenReady().then(() => {
  registerAppScheme();
  answerCors(session.defaultSession);
  lockDownPermissions(session.defaultSession);
  buildMenu();
  createWindow();

  app.on('activate', () => showWindow()); // macOS: dock icon click with no window open
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Belt and braces: no window, frame or webview may ever be created by page content.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});
