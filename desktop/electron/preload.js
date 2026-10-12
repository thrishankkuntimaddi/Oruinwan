'use strict';

/**
 * Oruinwan desktop — preload bridge.
 *
 * Two small APIs; the page never gets ipcRenderer or Node:
 *  - window.electronAPI: what the web client's desktop integration expects
 *    (client/src/desktop/bridge.js): native notifications, unread badge, notification clicks.
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
});
