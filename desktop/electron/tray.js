'use strict';

/**
 * Oruinwan Desktop — System Tray
 *
 * Menu:
 *  - Open Oruinwan (recreates the window if it was destroyed)
 *  - Do Not Disturb / Enable-Disable Notifications
 *  - Check for updates
 *  - About + Quit
 *
 * All state changes are delegated to handlers supplied by main.js so the tray,
 * the renderer IPC (save-setting / toggle-notifications) and the in-memory
 * notification state always go through the same code path.
 */

const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const notifications = require('./notifications');

let tray = null;
let handlers = {
  openWindow: () => {},
  toggleWindow: () => {},
  setNotificationsEnabled: () => {},
  setDoNotDisturb: () => {},
  checkForUpdates: () => {},
  quit: () => app.quit(),
};

// ─── Context Menu Builder ─────────────────────────────────────────────────────
function buildContextMenu() {
  const notifEnabled = notifications.isEnabled();
  const dndEnabled   = notifications.isDoNotDisturb();
  const version      = app.getVersion();

  return Menu.buildFromTemplate([
    { label: 'Open Oruinwan', click: () => handlers.openWindow() },
    { type: 'separator' },
    {
      label: 'Do Not Disturb',
      type: 'checkbox',
      checked: dndEnabled,
      click: () => handlers.setDoNotDisturb(!dndEnabled),
    },
    {
      label: notifEnabled ? 'Disable Notifications' : 'Enable Notifications',
      click: () => handlers.setNotificationsEnabled(!notifEnabled),
    },
    { type: 'separator' },
    { label: 'Check for Updates…', click: () => handlers.checkForUpdates() },
    { label: `About Oruinwan v${version}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Quit Oruinwan',
      accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
      click: () => handlers.quit(),
    },
  ]);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Rebuild and apply the tray context menu.
 * Call this whenever notification/DnD state changes.
 */
function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(buildContextMenu());
}

/**
 * Initialise the system tray. Call once after app.whenReady().
 * @param {Partial<typeof handlers>} opts
 */
function createTray(opts = {}) {
  handlers = { ...handlers, ...opts };
  if (tray) return tray;

  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');

  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    console.warn('[Tray] Missing tray icon at', iconPath, '— run `npm run icons`');
  } else if (process.platform === 'darwin') {
    // Coloured icon: do NOT mark as template (a template image would render
    // the filled square as a solid silhouette and hide the "C").
    icon = icon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);
  tray.setToolTip('Oruinwan — Company Workspace OS');
  tray.setContextMenu(buildContextMenu());

  // Single click: show/hide window (Windows/Linux; macOS opens the menu)
  tray.on('click', () => handlers.toggleWindow());
  // Double-click: always show window (Windows primarily)
  tray.on('double-click', () => handlers.openWindow());

  return tray;
}

/**
 * Update the tray tooltip and macOS dock badge with the unread count.
 * @param {number} count non-negative integer (validated by caller)
 */
function setUnreadCount(count) {
  if (process.platform === 'darwin' || process.platform === 'linux') {
    app.setBadgeCount(count);
  }
  if (!tray) return;
  const label = count > 0 ? `${count} unread message${count === 1 ? '' : 's'}` : 'No new messages';
  tray.setToolTip(`Oruinwan — ${label}`);
}

module.exports = { createTray, setUnreadCount, refreshTrayMenu };
