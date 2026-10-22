'use strict';

/**
 * Oruinwan desktop — preload bridge.
 *
 * Two small APIs; the page never gets ipcRenderer or Node:
 *  - window.electronAPI: what the web client's desktop integration expects
 *    (client/src/desktop/bridge.js): native notifications, unread badge, notification clicks,
 *    notification quick replies (client/src/desktop/quickReply.js).
 *  - window.oruinwanDesktop: platform facts and links, used to detect the desktop app
 *    (client/src/appMode/env.js) and by the in-app update check.
 */

const { contextBridge, ipcRenderer } = require('electron');

const versionArg = process.argv.find((a) => a.startsWith('--oruinwan-version='));
const version = versionArg ? versionArg.split('=')[1] : '';

const setBadgeCount = (count) => ipcRenderer.send('oruinwan:badge', Number(count) || 0);
const openExternal = (url) => ipcRenderer.send('oruinwan:open-external', String(url));

contextBridge.exposeInMainWorld('oruinwanDesktop', {
  /** 'darwin' | 'win32' | 'linux' */
  platform: process.platform,
  /** 'arm64' | 'x64' | … */
  arch: process.arch,
  /** The installed app's version, e.g. "1.2.0". */
  version,
  /** Unread count on the dock / launcher icon and in the window title. */
  setBadgeCount,
  /** Opens an http(s) or mailto link in the default browser or mail app. */
  openExternal,
  /**
   * Continue with Google in the default browser. Resolves with { code, codeVerifier, redirectUri }
   * for the server to finish, or { error, code } ('CANCELLED' when the person backed out).
   */
  googleSignIn: (clientId) => ipcRenderer.invoke('oruinwan:google-sign-in', String(clientId || '')),
  /**
   * Quick updates (electron/ota.js): signed UI bundles installed without a reinstall. The main
   * process checks the SHA-256 and Ed25519 signature itself.
   */
  updates: {
    /** { shellVersion, uiVersion, source: 'bundled'|'downloaded', canApplyBundles, staged } */
    info: () => ipcRenderer.invoke('oruinwan:update:info'),
    /** bundle: { url, version, sha256, signature, minNativeVersion } → { ok, version } | { error, code } */
    download: (bundle) => ipcRenderer.invoke('oruinwan:update:download', {
      url: String((bundle && bundle.url) || ''),
      version: String((bundle && bundle.version) || ''),
      sha256: String((bundle && bundle.sha256) || ''),
      signature: String((bundle && bundle.signature) || ''),
      minNativeVersion: bundle && bundle.minNativeVersion ? String(bundle.minNativeVersion) : null,
    }),
    /** Restarts the app into the downloaded update. */
    apply: () => ipcRenderer.invoke('oruinwan:update:apply'),
    /** Back to the version that came with the app (restarts). */
    reset: () => ipcRenderer.invoke('oruinwan:update:reset'),
    /** The page started: keeps a just-installed update (the boot watchdog rolls back otherwise). */
    confirmStarted: () => ipcRenderer.send('oruinwan:update:confirm'),
    /** Called with { state, percent } while downloading. Returns an unsubscribe function. */
    onProgress: (callback) => {
      const handler = (_event, p) => callback(p);
      ipcRenderer.on('oruinwan:update:progress', handler);
      return () => ipcRenderer.removeListener('oruinwan:update:progress', handler);
    },
  },
});

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  getAppVersion: () => Promise.resolve(version),
  /** { type, title?, body?, senderName?, preview?, channelName?, taskTitle?, workspaceId?, channelId?, dmSessionId? } */
  notify: (payload) => ipcRenderer.send('oruinwan:notify', payload),
  setUnreadCount: setBadgeCount,
  /** Called with { workspaceId, channelId, dmSessionId } when a notification is clicked. */
  onNotificationClicked: (callback) => {
    const handler = (_event, target) => callback(target);
    ipcRenderer.on('oruinwan:notification-clicked', handler);
    return () => ipcRenderer.removeListener('oruinwan:notification-clicked', handler);
  },
  /** True where native notifications have an inline Reply field (macOS, Windows). */
  supportsQuickReply: process.platform === 'darwin' || process.platform === 'win32',
  /**
   * Called with { workspaceId, channelId | dmSessionId, text } when the person replies from a
   * notification. Ids and length are validated in the main process; the page encrypts and sends.
   */
  onQuickReply: (callback) => {
    const handler = (_event, reply) => callback(reply);
    ipcRenderer.on('oruinwan:quick-reply', handler);
    return () => ipcRenderer.removeListener('oruinwan:quick-reply', handler);
  },
  /**
   * Incoming calls: { kind: 'call', huddleId, title, body, video } asks for attention when the
   * app isn't in front (tray, minimised, behind other apps); { kind: 'stop' } ends it.
   */
  attention: (payload) => {
    const p = payload && typeof payload === 'object' ? payload : {};
    ipcRenderer.send('oruinwan:attention', p.kind === 'call'
      ? { kind: 'call', huddleId: String(p.huddleId || ''), title: String(p.title || ''), body: String(p.body || ''), video: Boolean(p.video) }
      : { kind: 'stop' });
  },
  /** Called with { huddleId, action: 'accept' | 'decline' | 'open' } from the call notification. */
  onCallAction: (callback) => {
    const handler = (_event, detail) => callback(detail);
    ipcRenderer.on('oruinwan:call-action', handler);
    return () => ipcRenderer.removeListener('oruinwan:call-action', handler);
  },
  /** The page could not send a quick reply: open that conversation so it can be retried. */
  quickReplyFailed: (target) => ipcRenderer.send('oruinwan:quick-reply-failed', {
    workspaceId: String((target && target.workspaceId) || ''),
    channelId: String((target && target.channelId) || ''),
    dmSessionId: String((target && target.dmSessionId) || ''),
  }),
});
