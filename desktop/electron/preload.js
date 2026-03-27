'use strict';

/**
 * Chttrix Desktop — Secure Preload Bridge
 *
 * Exposes a minimal, explicit API surface from the main process
 * to the renderer (Chttrix web client) via contextBridge.
 *
 * Security rules:
 *  - nodeIntegration = false → renderer cannot use Node.js APIs
 *  - contextIsolation = true → preload context is isolated from renderer
 *  - Only white-listed IPC channels are exposed
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Health Check ────────────────────────────────────────────────────────────
  ping: () => 'pong',

  // ── Native Notifications ────────────────────────────────────────────────────
  /**
   * Trigger a native desktop notification from the web client.
   * @param {{ type: string, senderName?: string, preview?: string,
   *            taskTitle?: string, dueDate?: string, channelName?: string,
   *            title?: string, body?: string }} payload
   */
  notify: (payload) => ipcRenderer.send('notify', payload),

  /**
   * Update the app badge / tray tooltip unread count.
   * @param {number} count
   */
  setUnreadCount: (count) => ipcRenderer.send('set-unread-count', { count }),

  /**
   * Toggle desktop notifications on/off (also reflected in tray menu).
   */
  toggleNotifications: () => ipcRenderer.send('toggle-notifications'),

  /**
   * Query whether desktop notifications are currently enabled.
   * @returns {Promise<{ enabled: boolean }>}
   */
  getNotificationState: () => ipcRenderer.invoke('get-notification-state'),

  // ── Platform Information ─────────────────────────────────────────────────────
  /**
   * Returns the current platform string ('darwin' | 'win32' | 'linux').
   */
  platform: process.platform,

  /**
   * Returns true when running inside the Electron shell.
   * The web client can use this to conditionally enable desktop features.
   */
  isDesktop: true,
});
