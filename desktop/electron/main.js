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
 *  5. Tray icon (unread dot, Do Not Disturb, launch at login); closing hides to the tray so the
 *     page — and its socket — keeps syncing; notification quick reply (macOS, Windows)
 *  6. Quick updates: signed UI bundles installed without a reinstall, with a boot watchdog (ota.js)
 */

const {
  app, BrowserWindow, Menu, Notification, Tray, desktopCapturer, dialog, ipcMain, nativeImage, net, powerMonitor, protocol, screen, session, shell,
  systemPreferences,
} = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { googleSignIn } = require('./googleSignIn');
const trayState = require('./trayState');
const ota = require('./ota');
const { shareOptions } = require('./screenShare');
const permissions = require('./permissions');
const links = require('./links');

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
// The root, not /index.html: the web client has no /index.html route, so that address
// painted an empty window.
const START_URL = IS_DEV ? DEV_URL : `${APP_ORIGIN}/`;
const PAGE_ORIGIN = originOf(START_URL);
const BUNDLED_APP_DIR = path.join(__dirname, '..', 'app');
// The UI being served: the bundled app/ or a downloaded quick update (chosen at start, ota.js).
let appUi = { dir: BUNDLED_APP_DIR, version: '', source: 'bundled', pending: false };
// A downloaded UI must confirm it started within this time, or the app goes back (ota.js).
const BOOT_WATCHDOG_MS = 45_000;
const REPO_URL = 'https://github.com/thrishankkuntimaddi/Oruinwan';

const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);
const GRANTABLE = new Set(['notifications', 'clipboard-read', 'clipboard-sanitized-write', 'media', 'display-capture', 'fullscreen']);
// The small always-on-top call window the page opens with window.open('', CALL_WINDOW_NAME)
// (client/src/features/huddles/call/floatingWindow.js).
const CALL_WINDOW_NAME = 'oruinwan-call';

// Must run before the app is ready. `standard` + `secure` give the bundle a real origin, so
// localStorage, IndexedDB and WebCrypto (the encryption keys) work as they do on https.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// Automated tests of the unpackaged app (desktop/test-e2e): their own profile, and a fake
// camera/microphone instead of the operating system's devices and prompts. Ignored in
// installed builds.
const TEST_MODE = !app.isPackaged && process.env.ORUINWAN_TEST_MODE === '1';
if (!app.isPackaged && process.env.ORUINWAN_USER_DATA) app.setPath('userData', process.env.ORUINWAN_USER_DATA);
// (Not --use-fake-ui-for-media-stream: it would answer screen sharing itself, skipping the app's handler.)
if (TEST_MODE) app.commandLine.appendSwitch('use-fake-device-for-media-stream');

let mainWindow = null;
let tray = null;
let unreadCount = 0;
// Set by every real quit (tray Quit, Cmd+Q, the app menu, OS shutdown): only then may the
// window close instead of hiding.
let isQuitting = false;
const IS_MAC = process.platform === 'darwin';
const TRAY_DIR = path.join(__dirname, '..', 'assets', 'tray');

// Email buttons on a computer with the app: the web's /open/<page> hands oruinwan://open/<page>
// to the app, which shows that page (macOS: open-url; Windows/Linux: a second instance's args).
let pendingAppPath = null;
let pageLoaded = false;
function openAppLink(url) {
  const appPath = links.pathFromAppLink(url);
  if (!appPath) return;
  if (mainWindow && !mainWindow.isDestroyed() && pageLoaded) {
    showWindow();
    mainWindow.webContents.executeJavaScript(links.navigateScript(appPath)).catch(() => {});
  } else {
    pendingAppPath = appPath;
    showWindow();
  }
}
app.on('open-url', (event, url) => {
  event.preventDefault();
  openAppLink(url);
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    showWindow();
    openAppLink(links.appLinkInArgs(argv));
  });
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

// ─── Desktop settings (Do Not Disturb) ────────────────────────────────────────

const settingsFile = () => path.join(app.getPath('userData'), 'desktop-settings.json');
let settings = { doNotDisturb: false };

function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    settings = { doNotDisturb: saved.doNotDisturb === true };
  } catch {
    /* first run */
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(settings));
  } catch (err) {
    console.warn('[settings] could not save:', err.message);
  }
}

// ─── app:// — the bundled app ─────────────────────────────────────────────────

/** CSP for the bundle. Inline scripts in index.html (the theme bootstrap) are allowed by hash. */
function contentSecurityPolicy(appDir) {
  const hashes = [];
  try {
    const html = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
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

const cspByDir = new Map();
function cspFor(appDir) {
  if (!cspByDir.has(appDir)) cspByDir.set(appDir, contentSecurityPolicy(appDir));
  return cspByDir.get(appDir);
}

function registerAppScheme() {
  protocol.handle(SCHEME, async (request) => {
    const APP_DIR = appUi.dir;
    const csp = cspFor(APP_DIR);
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
    if (!GRANTABLE.has(permission) || origin !== PAGE_ORIGIN) return callback(false);
    if (permission !== 'media') return callback(true);
    // Microphone/camera: the operating system has its own switch on top of Chromium's.
    ensureMediaAccess(permissions.mediaKinds(details)).then(callback, () => callback(false));
  });
  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
    GRANTABLE.has(permission) && originOf(requestingOrigin) === PAGE_ORIGIN);
  allowScreenShare(ses);
}

/** The operating system's answer for one kind ('microphone' | 'camera' | 'screen'), or 'unknown'. */
function mediaStatus(kind) {
  if (TEST_MODE) return 'granted';
  if (!IS_MAC && process.platform !== 'win32') return 'unknown';
  try {
    return systemPreferences.getMediaAccessStatus(kind);
  } catch {
    return 'unknown';
  }
}

/**
 * Makes sure the OS lets the app use each kind: asks macOS the first time (its own prompt),
 * and explains how to turn it back on when it was refused. Resolves true when all may be used.
 */
async function ensureMediaAccess(kinds) {
  for (const kind of kinds) {
    const action = permissions.accessAction(mediaStatus(kind), process.platform);
    if (action === 'ask') {
      const ok = await systemPreferences.askForMediaAccess(kind).catch(() => false);
      if (!ok) {
        explainBlocked(kind);
        return false;
      }
    } else if (action === 'blocked') {
      explainBlocked(kind);
      return false;
    }
  }
  return true;
}

// One explanation per kind at a time: a call retrying getUserMedia must not stack dialogs.
const explaining = new Set();
async function explainBlocked(kind) {
  if (explaining.has(kind)) return;
  explaining.add(kind);
  try {
    const { message, detail } = permissions.blockedMessage(kind, process.platform);
    const url = permissions.settingsUrl(kind, process.platform);
    const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
    const { response } = await dialog.showMessageBox(parent, {
      type: 'warning',
      message,
      detail,
      buttons: url ? [IS_MAC ? 'Open System Settings' : 'Open Settings', 'Not now'] : ['OK'],
      defaultId: 0,
      cancelId: url ? 1 : 0,
      noLink: true,
    });
    // A fixed settings address, not page input: open it directly.
    if (url && response === 0) shell.openExternal(url).catch(() => {});
  } catch (err) {
    console.warn('[permissions] could not explain:', err.message);
  } finally {
    explaining.delete(kind);
  }
}

/**
 * Screen sharing in calls (getDisplayMedia). The system picker where the OS has one (macOS 15+);
 * otherwise a short list of screens and windows to choose from.
 */
function allowScreenShare(ses) {
  if (typeof ses.setDisplayMediaRequestHandler !== 'function') return;
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const origin = originOf((request.frame && request.frame.url) || request.securityOrigin || '');
      if (origin !== PAGE_ORIGIN) return callback({});
      // Tests count the request and cancel it: listing real screens would show system prompts.
      if (TEST_MODE) {
        global.__oruinwanScreenShareRequests = (global.__oruinwanScreenShareRequests || 0) + 1;
        return callback({});
      }
      // macOS: screen recording refused earlier only comes back from System Settings.
      // ('not-determined' is fine: listing the screens shows the system prompt.)
      if (IS_MAC && permissions.accessAction(mediaStatus('screen'), 'darwin') === 'blocked') {
        explainBlocked('screen');
        return callback({});
      }
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } });
      const choice = await pickScreenSource(sources);
      callback(choice ? { video: choice } : {});
    } catch (err) {
      console.warn('[screen share] failed:', err.message);
      callback({});
    }
  // macOS 15+: the system's own picker (no screen-recording permission needed); the handler
  // above is the fallback. Tests use the handler so no system UI appears.
  }, { useSystemPicker: !TEST_MODE });
}

/** Ask which screen or window to share. Resolves with the source, or null when cancelled. */
async function pickScreenSource(sources) {
  const options = shareOptions(sources);
  if (options.length === 0) return null;
  if (options.length === 1) return options[0].source;
  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
  const { response } = await dialog.showMessageBox(parent, {
    type: 'question',
    title: 'Share your screen',
    message: 'What do you want to share?',
    buttons: [...options.map((o) => o.label), 'Cancel'],
    cancelId: options.length,
    defaultId: 0,
    noLink: true,
  });
  return response < options.length ? options[response].source : null;
}

/**
 * During a call, the page pops the call out into its small always-on-top window when the app
 * is minimised, hidden or behind another app, and closes it again when the app is back
 * (window.__oruinwanCallAway, client/src/features/huddles/components/HuddleDock.jsx).
 * The `true` makes it count as a user action, which opening a window needs.
 */
function tellPageAway(win, away) {
  if (!win || win.isDestroyed()) return;
  win.webContents
    .executeJavaScript(`window.__oruinwanCallAway && window.__oruinwanCallAway(${away ? 'true' : 'false'})`, true)
    .catch(() => {});
}

function watchCallWindow(win) {
  let awayTimer = null;
  let callWindow = null;
  const away = () => {
    clearTimeout(awayTimer);
    // A short wait, so clicking into the call window itself does not flicker.
    awayTimer = setTimeout(() => {
      if (win.isDestroyed() || win.isFocused()) return;
      const focused = BrowserWindow.getFocusedWindow();
      if (focused && callWindow && focused === callWindow) return;
      tellPageAway(win, true);
    }, 250);
  };
  const back = () => {
    clearTimeout(awayTimer);
    if (!win.isMinimized() && win.isVisible()) tellPageAway(win, false);
  };
  win.on('minimize', away);
  win.on('hide', away);
  win.on('blur', away);
  win.on('restore', back);
  win.on('show', back);
  win.on('focus', back);

  win.webContents.on('did-create-window', (child, { frameName }) => {
    if (frameName !== CALL_WINDOW_NAME) return;
    callWindow = child;
    child.setAlwaysOnTop(true, 'floating');
    if (typeof child.setVisibleOnAllWorkspaces === 'function') child.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    child.setMenuBarVisibility(false);
    // Closing the call window (or "Open the call" in it) brings the app back.
    child.on('closed', () => {
      if (callWindow === child) callWindow = null;
      if (win.isDestroyed()) return;
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
    });
  });
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
    backgroundColor: '#f8f5f0', // the web client's (light) background
    icon: process.platform === 'linux' ? path.join(__dirname, '..', 'assets', 'icon.png') : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
      // Hidden in the tray, the page keeps its socket and timers running at full speed, so
      // messages, notifications and the unread count stay live.
      backgroundThrottling: false,
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
  // Seen: stop flashing for a ringing call (the page's incoming-call screen is in front now).
  win.on('focus', () => {
    if (ringing) win.flashFrame(false);
  });
  win.on('close', (event) => {
    saveWindowState(win);
    if (trayState.closeAction({ platform: process.platform, isQuitting, hasTray: Boolean(tray) }) === 'hide') {
      event.preventDefault();
      // macOS: leave full screen first, or hiding leaves an empty full-screen space behind.
      if (IS_MAC && win.isFullScreen()) {
        win.once('leave-full-screen', () => win.hide());
        win.setFullScreen(false);
      } else {
        win.hide();
      }
    }
  });
  win.on('session-end', () => { // Windows log off / shut down
    isQuitting = true;
  });
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
  win.webContents.setWindowOpenHandler(({ url, frameName }) => {
    // The page's own call window: a small window in this same page (it renders the call into it).
    if (frameName === CALL_WINDOW_NAME && (url === 'about:blank' || url === '')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 340,
          height: 236,
          minWidth: 260,
          minHeight: 180,
          title: 'Oruinwan call',
          // Not a child window: macOS hides children when the app window is minimised.
          alwaysOnTop: true,
          skipTaskbar: true,
          minimizable: false,
          maximizable: false,
          fullscreenable: false,
          autoHideMenuBar: true,
          backgroundColor: '#f8f5f0',
        },
      };
    }
    // The app's own pages ("Open meeting page", task links) open here, without a reload,
    // so a running call and the unlocked encryption keys stay as they are.
    const inApp = links.inAppPath(url, PAGE_ORIGIN);
    if (inApp) {
      win.webContents.executeJavaScript(links.navigateScript(inApp)).catch(() => {});
      return { action: 'deny' };
    }
    openExternalSafely(url);
    return { action: 'deny' };
  });
  watchCallWindow(win);
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());

  pageLoaded = false;
  win.webContents.on('did-finish-load', () => {
    pageLoaded = true;
    if (pendingAppPath) {
      const appPath = pendingAppPath;
      pendingAppPath = null;
      win.webContents.executeJavaScript(links.navigateScript(appPath)).catch(() => {});
    }
  });
  win.loadURL(START_URL).catch((err) => console.error('[window] failed to load', START_URL, err.message));
  if (appUi.pending) watchBoot(win);
  return win;
}

// ─── Quick updates (signed UI bundles, ota.js) ────────────────────────────────

const UPDATE_PUBLIC_KEY = ota.loadPublicKey();
const canApplyBundles = () => !IS_DEV && Boolean(UPDATE_PUBLIC_KEY);
let bootTimer = null;
let updateBusy = false;

/** A downloaded UI that fails to load, crashes or never confirms is rolled back. */
function watchBoot(win) {
  const fail = (why) => {
    if (!appUi.pending) return;
    console.warn(`[updates] UI ${appUi.version} did not start (${why}); going back`);
    clearTimeout(bootTimer);
    appUi = ota.rollback({ userData: app.getPath('userData'), bundledDir: BUNDLED_APP_DIR, shellVersion: app.getVersion() });
    cspByDir.clear();
    if (!win.isDestroyed()) win.loadURL(START_URL).catch(() => {});
  };
  clearTimeout(bootTimer);
  bootTimer = setTimeout(() => fail('no confirmation'), BOOT_WATCHDOG_MS);
  win.webContents.once('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
    if (isMainFrame) fail(`load failed (${code})`);
  });
  win.webContents.once('render-process-gone', () => fail('renderer crashed'));
}

ipcMain.on('oruinwan:update:confirm', (event) => {
  if (!fromAppPage(event) || !appUi.pending) return;
  clearTimeout(bootTimer);
  ota.confirm({ userData: app.getPath('userData') });
  appUi = { ...appUi, pending: false };
});

ipcMain.handle('oruinwan:update:info', (event) => {
  if (!fromAppPage(event)) return null;
  return {
    shellVersion: app.getVersion(),
    uiVersion: appUi.source === 'downloaded' ? appUi.version : app.getVersion(),
    source: appUi.source,
    canApplyBundles: canApplyBundles(),
    staged: ota.stagedVersion({ userData: app.getPath('userData') }),
  };
});

/** Downloads, verifies (size, SHA-256, Ed25519 signature) and unpacks a bundle for the next start. */
ipcMain.handle('oruinwan:update:download', async (event, bundle) => {
  if (!fromAppPage(event)) return { error: 'Not allowed', code: 'FAILED' };
  if (!canApplyBundles()) return { error: "This app can't install quick updates.", code: 'NO_KEY' };
  const b = bundle && typeof bundle === 'object' ? bundle : {};
  const url = typeof b.url === 'string' ? b.url : '';
  if (!url.startsWith('https://')) return { error: 'The update address is not valid.', code: 'BAD_URL' };
  if (updateBusy) return { error: 'An update is already downloading.', code: 'BUSY' };
  updateBusy = true;
  const progress = (state, percent) => {
    if (!event.sender.isDestroyed()) event.sender.send('oruinwan:update:progress', { state, percent });
  };
  try {
    progress('downloading', 0);
    const res = await net.fetch(url, { cache: 'no-store' });
    if (!res.ok) return { error: `The update server answered ${res.status}.`, code: 'DOWNLOAD' };
    const total = Number(res.headers.get('content-length')) || 0;
    if (total > ota.MAX_BUNDLE_BYTES) return { error: 'The update has an unexpected size.', code: 'SIZE' };
    const chunks = [];
    let received = 0;
    let last = -1;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > ota.MAX_BUNDLE_BYTES) {
        reader.cancel().catch(() => {});
        return { error: 'The update has an unexpected size.', code: 'SIZE' };
      }
      chunks.push(Buffer.from(value));
      const percent = total ? Math.floor((received * 100) / total) : 0;
      if (percent !== last) {
        last = percent;
        progress('downloading', percent);
      }
    }
    progress('verifying', 100);
    const staged = ota.stageBundle({
      userData: app.getPath('userData'),
      shellVersion: app.getVersion(),
      bytes: Buffer.concat(chunks),
      bundle: { version: b.version, sha256: b.sha256, signature: b.signature, minNativeVersion: b.minNativeVersion },
      publicKey: UPDATE_PUBLIC_KEY,
    });
    progress('ready', 100);
    return { ok: true, version: staged.version };
  } catch (err) {
    return { error: err.code ? err.message : 'The update could not be downloaded. Check your connection and try again.', code: err.code || 'DOWNLOAD' };
  } finally {
    updateBusy = false;
  }
});

/** Restarts into the staged bundle. */
ipcMain.handle('oruinwan:update:apply', (event) => {
  if (!fromAppPage(event)) return { error: 'Not allowed', code: 'FAILED' };
  if (!ota.applyStaged({ userData: app.getPath('userData') })) return { error: 'No update is ready.', code: 'NOT_READY' };
  setTimeout(() => {
    isQuitting = true;
    app.relaunch();
    app.exit(0);
  }, 150);
  return { ok: true };
});

/** Back to the UI that came with the installed app, then restart. */
ipcMain.handle('oruinwan:update:reset', (event) => {
  if (!fromAppPage(event)) return { error: 'Not allowed', code: 'FAILED' };
  ota.reset({ userData: app.getPath('userData'), shellVersion: app.getVersion() });
  setTimeout(() => {
    isQuitting = true;
    app.relaunch();
    app.exit(0);
  }, 150);
  return { ok: true };
});

// ─── IPC (see preload.js) ─────────────────────────────────────────────────────

function fromAppPage(event) {
  return originOf(event.senderFrame && event.senderFrame.url) === PAGE_ORIGIN;
}

ipcMain.on('oruinwan:open-external', (event, url) => {
  if (fromAppPage(event) && typeof url === 'string' && url.length < 4096) openExternalSafely(url);
});

// "Continue with Google": the person's own browser, back to a local address (googleSignIn.js).
// Errors cross IPC as plain { error, code } so the page can tell a cancel from a failure.
ipcMain.handle('oruinwan:google-sign-in', async (event, clientId) => {
  if (!fromAppPage(event)) return { error: 'Not allowed', code: 'FAILED' };
  if (typeof clientId !== 'string' || !/^[\w.-]{10,200}\.apps\.googleusercontent\.com$/.test(clientId)) {
    return { error: 'Google sign-in is not set up on this server', code: 'NOT_CONFIGURED' };
  }
  try {
    return await googleSignIn({ clientId, openExternal: openExternalSafely, focusApp: showWindow });
  } catch (err) {
    return { error: err.message, code: err.code || 'FAILED' };
  }
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
  const options = trayState.notificationOptions({
    platform: process.platform, title, body, target, doNotDisturb: settings.doNotDisturb,
  });
  if (!options) return; // Do Not Disturb
  const notification = new Notification(options);
  shownNotifications.add(notification);
  const forget = () => shownNotifications.delete(notification);
  notification.on('click', () => {
    forget();
    showWindow();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('oruinwan:notification-clicked', target);
  });
  // Inline reply (macOS, Windows): the page encrypts and sends it (client/src/desktop/quickReply.js).
  notification.on('reply', (details, legacyReply) => {
    forget();
    const reply = trayState.quickReplyPayload(target, trayState.replyText(details, legacyReply));
    if (!reply) return;
    if (!mainWindow || mainWindow.isDestroyed()) {
      // No page to encrypt with: open the conversation instead.
      showWindow();
      return;
    }
    mainWindow.webContents.send('oruinwan:quick-reply', reply);
  });
  notification.on('close', forget);
  notification.show();
});

// The page reports a quick reply it could not send (keys locked, offline): open the
// conversation so the person can retry there.
ipcMain.on('oruinwan:quick-reply-failed', (event, target) => {
  if (!fromAppPage(event)) return;
  const conversation = trayState.conversationTarget(target);
  showWindow();
  if (conversation && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('oruinwan:notification-clicked', conversation);
  }
});

// The dock (macOS) and window/taskbar (Windows, Linux) icon follows the app's theme while it
// runs. The installed icon (Finder, Start menu) is the light one (assets/icon.png).
let appearance = 'light';
function applyAppIcon() {
  const file = path.join(__dirname, '..', 'assets', appearance === 'dark' ? 'icon-dark.png' : 'icon.png');
  const image = nativeImage.createFromPath(file);
  if (image.isEmpty()) return;
  if (process.platform === 'darwin') app.dock?.setIcon(image);
  else if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setIcon(image);
}
ipcMain.on('oruinwan:appearance', (event, theme) => {
  if (!fromAppPage(event)) return;
  const next = theme === 'dark' ? 'dark' : 'light';
  if (next === appearance) return;
  appearance = next;
  applyAppIcon();
});

ipcMain.on('oruinwan:badge', (event, count) => {
  if (!fromAppPage(event)) return;
  const n = trayState.clampUnread(count);
  unreadCount = n;
  updateTray();
  try {
    app.setBadgeCount(n); // dock (macOS) and Unity launchers (Linux); a no-op elsewhere
  } catch {
    /* unsupported desktop */
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setTitle(n ? `Oruinwan (${n})` : 'Oruinwan');
  }
});

// ─── Incoming calls ───────────────────────────────────────────────────────────
//
// The page shows the incoming-call screen and plays the ringtone. When the app is not in
// front, it asks for attention here: the window shows (without taking focus) if it was in
// the tray, the dock bounces / the taskbar flashes, and a notification offers Accept and
// Decline (buttons on macOS; a click opens the app elsewhere). The answer goes back to the
// page as oruinwan:call-action, which accepts or declines like its own buttons.

let ringing = null; // { huddleId, notification, bounceId }
const SAFE_CALL_ID = /^[A-Za-z0-9_:.-]{1,128}$/;

function sendCallAction(huddleId, action) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('oruinwan:call-action', { huddleId, action });
}

function stopRinging() {
  if (!ringing) return;
  const { notification, bounceId } = ringing;
  ringing = null;
  try { notification && notification.close(); } catch { /* already gone */ }
  if (IS_MAC && bounceId !== undefined) app.dock.cancelBounce(bounceId);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.flashFrame(false);
}

function startRinging(p) {
  stopRinging();
  const huddleId = SAFE_CALL_ID.test(String(p.huddleId || '')) ? String(p.huddleId) : '';
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const inFront = win && win.isVisible() && !win.isMinimized() && win.isFocused();
  ringing = { huddleId, notification: null, bounceId: undefined };
  if (inFront) return; // the page's own incoming-call screen is enough
  if (win && !win.isVisible()) win.showInactive(); // back from the tray, without stealing focus
  if (win) win.flashFrame(true);
  if (IS_MAC) ringing.bounceId = app.dock.bounce('critical');
  if (settings.doNotDisturb || !Notification.isSupported()) return;
  const title = clip(p.title, 200) || 'Incoming call';
  const body = clip(p.body, 300) || (p.video ? 'Video call' : 'Voice call');
  const notification = new Notification({
    title,
    body,
    silent: true, // the page rings
    urgency: 'critical',
    timeoutType: 'never',
    ...(IS_MAC ? { actions: [{ type: 'button', text: 'Accept' }, { type: 'button', text: 'Decline' }] } : {}),
  });
  ringing.notification = notification;
  shownNotifications.add(notification);
  const done = () => shownNotifications.delete(notification);
  notification.on('click', () => {
    done();
    showWindow();
    sendCallAction(huddleId, 'open');
  });
  notification.on('action', (_event, index) => {
    done();
    if (index === 0) {
      showWindow();
      sendCallAction(huddleId, 'accept');
    } else {
      sendCallAction(huddleId, 'decline');
    }
    stopRinging();
  });
  notification.on('close', done);
  notification.show();
}

// { kind: 'call', huddleId, title, body, video } starts; { kind: 'stop' } ends (answered, declined, ended).
ipcMain.on('oruinwan:attention', (event, payload) => {
  if (!fromAppPage(event)) return;
  const p = payload && typeof payload === 'object' ? payload : {};
  if (p.kind === 'call') startRinging(p);
  else if (p.kind === 'stop') stopRinging();
});

// ─── Tray ─────────────────────────────────────────────────────────────────────

function trayImage() {
  const image = nativeImage.createFromPath(path.join(TRAY_DIR, trayState.trayIconFile(process.platform, unreadCount)));
  if (IS_MAC) image.setTemplateImage(true);
  return image;
}

function launchAtLogin() {
  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
}

function trayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Open Oruinwan', click: () => showWindow() },
    { type: 'separator' },
    {
      label: 'Do Not Disturb',
      type: 'checkbox',
      checked: settings.doNotDisturb,
      click: (item) => {
        settings.doNotDisturb = item.checked;
        saveSettings();
        updateTray();
      },
    },
    // setLoginItemSettings is macOS/Windows only; Linux desktops use their own autostart settings.
    ...(trayState.supportsLaunchAtLogin(process.platform) ? [{
      label: 'Launch at Login',
      type: 'checkbox',
      checked: launchAtLogin(),
      click: (item) => {
        try {
          app.setLoginItemSettings({ openAtLogin: item.checked });
        } catch (err) {
          console.warn('[tray] could not change launch at login:', err.message);
        }
        updateTray();
      },
    }] : []),
    { type: 'separator' },
    { label: 'Quit Oruinwan', click: () => { isQuitting = true; app.quit(); } },
  ]);
}

function updateTray() {
  if (!tray || tray.isDestroyed()) return;
  tray.setImage(trayImage());
  tray.setToolTip(trayState.trayTooltip(unreadCount));
  // macOS opens the menu on right-click only (left-click opens the window, below).
  if (!IS_MAC) tray.setContextMenu(trayMenu());
}

function createTray() {
  try {
    tray = new Tray(trayImage());
  } catch (err) {
    // Some Linux desktops have no tray; closing the window then quits (trayState.closeAction).
    console.warn('[tray] unavailable:', err.message);
    tray = null;
    return;
  }
  tray.on('click', () => showWindow());
  if (IS_MAC) tray.on('right-click', () => tray.popUpContextMenu(trayMenu()));
  updateTray();
}

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

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  loadSettings();
  if (canApplyBundles()) {
    try {
      appUi = ota.chooseAppDir({ userData: app.getPath('userData'), bundledDir: BUNDLED_APP_DIR, shellVersion: app.getVersion() });
      if (appUi.source === 'downloaded') console.log(`[updates] running UI ${appUi.version}${appUi.pending ? ' (first start)' : ''}`);
    } catch (err) {
      console.warn('[updates] could not choose the UI, using the bundled one:', err.message);
      appUi = { dir: BUNDLED_APP_DIR, version: app.getVersion(), source: 'bundled', pending: false };
    }
  }
  registerAppScheme();
  // Installed builds answer oruinwan:// links (development and test runs leave them alone).
  if (app.isPackaged && !TEST_MODE) {
    try {
      app.setAsDefaultProtocolClient(links.APP_LINK_SCHEME);
    } catch (err) {
      console.warn('[links] could not register oruinwan:// links:', err.message);
    }
  }
  // Started by a link (Windows, Linux): open its page once the window has loaded.
  openAppLink(links.appLinkInArgs(process.argv));
  answerCors(session.defaultSession);
  lockDownPermissions(session.defaultSession);
  buildMenu();
  createWindow();
  createTray();

  app.on('activate', () => showWindow()); // macOS: dock icon click shows the hidden window
  // Logging out / shutting down must not be held up by hide-to-tray (macOS, Linux).
  powerMonitor.on('shutdown', () => {
    isQuitting = true;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Belt and braces: no window, frame or webview may ever be created by page content.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});
