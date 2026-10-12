'use strict';

/**
 * Oruinwan desktop — preload bridge.
 *
 * The app (mobile/src/native/index.js) detects the desktop through `window.oruinwanDesktop`.
 * Only these calls cross into the main process; the page never gets ipcRenderer or Node.
 */

const { contextBridge, ipcRenderer } = require('electron');

const versionArg = process.argv.find((a) => a.startsWith('--oruinwan-version='));

contextBridge.exposeInMainWorld('oruinwanDesktop', {
  /** 'darwin' | 'win32' | 'linux' */
  platform: process.platform,
  /** 'arm64' | 'x64' | … */
  arch: process.arch,
  /** The installed app's version, e.g. "1.1.0". */
  version: versionArg ? versionArg.split('=')[1] : '',
  /** Unread count on the dock / launcher icon and in the window title. */
  setBadgeCount: (count) => ipcRenderer.send('oruinwan:badge', Number(count) || 0),
  /** Opens an http(s) or mailto link in the default browser or mail app. */
  openExternal: (url) => ipcRenderer.send('oruinwan:open-external', String(url)),
});
