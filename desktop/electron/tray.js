'use strict';

/**
 * Chttrix Desktop — System Tray
 *
 * Creates a tray icon with a context menu:
 *  - Open Chttrix
 *  - Do Not Disturb toggle
 *  - Toggle Notifications
 *  - Separator + Quit
 *
 * Exports refreshTrayMenu() so main.js can rebuild the menu
 * when notification state changes via IPC.
 */

const { Tray, Menu, nativeImage, BrowserWindow, app } = require('electron');
const path = require('path');
const notifications = require('./notifications');
const store = require('./store');

let tray = null;

// ─── Focus helper ─────────────────────────────────────────────────────────────
function focusMainWindow() {
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) {
    const win = wins[0];
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
}

// ─── Context Menu Builder ─────────────────────────────────────────────────────
function buildContextMenu() {
  const notifEnabled  = notifications.isEnabled();
  const dndEnabled    = store.get('doNotDisturb');
  const version       = app.getVersion();

  return Menu.buildFromTemplate([
    {
      label: 'Open Chttrix',
      click: focusMainWindow,
    },
    { type: 'separator' },
    {
      label: dndEnabled ? '✅ Do Not Disturb' : '🌙 Do Not Disturb',
      type:  'checkbox',
      checked: dndEnabled,
      click: () => {
        const next = !dndEnabled;
        store.set('doNotDisturb', next);
        notifications.setEnabled(!next);
        store.set('notificationsEnabled', !next);
        refreshTrayMenu();
        // Notify renderer so its settings UI stays in sync
        const wins = BrowserWindow.getAllWindows();
        if (wins.length > 0) {
          wins[0].webContents.send('notifications-toggled', { enabled: !next });
        }
      },
    },
    {
      label: notifEnabled ? '🔕 Disable Notifications' : '🔔 Enable Notifications',
      click: () => {
        const next = !notifEnabled;
        notifications.setEnabled(next);
        store.set('notificationsEnabled', next);
        refreshTrayMenu();
        const wins = BrowserWindow.getAllWindows();
        if (wins.length > 0) {
          wins[0].webContents.send('notifications-toggled', { enabled: next });
        }
      },
    },
    { type: 'separator' },
    {
      label: `About Chttrix v${version}`,
      enabled: false,
    },
    {
      label: 'Quit Chttrix',
      accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
      click: () => app.quit(),
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
 * Initialise the system tray.
 * Should be called once after app.whenReady().
 */
function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');

  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error('empty');
  } catch {
    icon = nativeImage.createEmpty();
  }

  if (process.platform === 'darwin') {
    icon = icon.resize({ width: 16, height: 16 });
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip('Chttrix — Company Workspace OS');
  tray.setContextMenu(buildContextMenu());

  // Single click: show/hide window (all platforms)
  tray.on('click', () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      const win = wins[0];
      win.isVisible() ? win.hide() : win.show();
    }
  });

  // Double-click: always show window (Windows primarily)
  tray.on('double-click', focusMainWindow);

  return tray;
}

/**
 * Update the tray tooltip and macOS dock badge with the unread count.
 * @param {number} count
 */
function setUnreadCount(count) {
  if (!tray) return;
  const label = count > 0 ? `${count} unread message${count === 1 ? '' : 's'}` : 'No new messages';
  tray.setToolTip(`Chttrix — ${label}`);

  if (process.platform === 'darwin') {
    app.setBadgeCount(count);
  }

  // Rebuild menu to reflect updated state
  refreshTrayMenu();
}

module.exports = { createTray, setUnreadCount, refreshTrayMenu };
