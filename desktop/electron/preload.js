'use strict';

/**
 * Chttrix Desktop — Secure Preload Bridge
 *
 * Exposes a minimal, typed API from the main process to the renderer
 * (Chttrix web client) via contextBridge.
 *
 * Security rules:
 *  - nodeIntegration = false  → renderer cannot access Node.js APIs
 *  - contextIsolation = true  → preload runs in isolated context
 *  - Only explicitly white-listed IPC channels are exposed
 *  - No direct ipcRenderer access is ever given to the renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // ── Identity ───────────────────────────────────────────────────────────────
  /** true when running inside Electron — web client can gate desktop features */
  isDesktop: true,

  /** 'darwin' | 'win32' | 'linux' */
  platform: process.platform,

  // ── App Info ───────────────────────────────────────────────────────────────
  /**
   * Returns the Electron app version string (e.g. "1.0.0").
   * @returns {Promise<string>}
   */
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // ── Native Notifications ───────────────────────────────────────────────────
  /**
   * Trigger a native desktop notification.
   * @param {{
   *   type: 'message'|'task'|'mention'|'system',
   *   senderName?: string,
   *   preview?: string,
   *   taskTitle?: string,
   *   dueDate?: string,
   *   channelName?: string,
   *   channelId?: string,
   *   dmSessionId?: string,
   *   title?: string,
   *   body?: string,
   * }} payload
   */
  notify: (payload) => ipcRenderer.send('notify', payload),

  // ── Badge / Unread Count ───────────────────────────────────────────────────
  /**
   * Update the dock badge (macOS) and tray tooltip with an unread count.
   * @param {number} count
   */
  setUnreadCount: (count) => ipcRenderer.send('set-unread-count', { count }),

  // ── Notification Preferences ───────────────────────────────────────────────
  /**
   * Toggle desktop notifications on/off (also rebuilds the tray menu).
   */
  toggleNotifications: () => ipcRenderer.send('toggle-notifications'),

  /**
   * Query current notification state.
   * @returns {Promise<{ enabled: boolean, doNotDisturb: boolean }>}
   */
  getNotificationState: () => ipcRenderer.invoke('get-notification-state'),

  // ── Settings (persistent key-value via electron-store) ─────────────────────
  /**
   * Read all persisted settings.
   * @returns {Promise<Record<string, any>>}
   */
  getSettings: () => ipcRenderer.invoke('get-settings'),

  /**
   * Persist a setting.
   * @param {string} key
   * @param {any} value
   */
  saveSetting: (key, value) => ipcRenderer.send('save-setting', { key, value }),

  // ── Window Control ─────────────────────────────────────────────────────────
  /**
   * Bring the app window to the front.
   */
  showWindow: () => ipcRenderer.send('show-window'),

  // ── Event Listeners (Main → Renderer) ─────────────────────────────────────
  /**
   * Called when the user clicks a native notification.
   * Payload contains { type, channelId?, dmSessionId? } for deep-link routing.
   * @param {function({ type: string, channelId?: string, dmSessionId?: string }): void} callback
   * @returns {function} unsubscribe — call to remove the listener
   */
  onNotificationClicked: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('notification-clicked', handler);
    return () => ipcRenderer.removeListener('notification-clicked', handler);
  },

  /**
   * Called when desktop notifications are toggled from the tray menu,
   * so the web client can sync its own settings UI.
   * @param {function({ enabled: boolean }): void} callback
   * @returns {function} unsubscribe
   */
  onNotificationsToggled: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('notifications-toggled', handler);
    return () => ipcRenderer.removeListener('notifications-toggled', handler);
  },
});
