'use strict';

/**
 * System Tray module for Chttrix Desktop.
 * Creates a tray icon with a context menu for quick actions:
 *  - Open / Show app
 *  - Toggle notifications
 *  - Quit
 */

const { Tray, Menu, nativeImage, BrowserWindow, app } = require('electron');
const path = require('path');
const notifications = require('./notifications');

let tray = null;

/**
 * Build and refresh the tray context menu.
 * Called on creation and whenever state changes.
 */
function buildContextMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Open Chttrix',
      click: () => {
        const wins = BrowserWindow.getAllWindows();
        if (wins.length > 0) {
          const win = wins[0];
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: notifications.isEnabled()
        ? '🔕 Disable Notifications'
        : '🔔 Enable Notifications',
      click: () => {
        notifications.setEnabled(!notifications.isEnabled());
        // Rebuild menu to reflect updated state
        tray.setContextMenu(buildContextMenu());
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Chttrix',
      click: () => {
        app.quit();
      },
    },
  ]);
}

/**
 * Initialise the system tray.
 * Should be called once after app.whenReady().
 */
function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');

  // Gracefully fall back to a blank image if the asset is missing
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {
    icon = nativeImage.createEmpty();
  }

  // On macOS, make it a template image (renders in both light and dark mode)
  if (process.platform === 'darwin') {
    icon = icon.resize({ width: 16, height: 16 });
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip('Chttrix — Company Workspace OS');
  tray.setContextMenu(buildContextMenu());

  // macOS: clicking the tray icon shows/hides the window
  tray.on('click', () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      const win = wins[0];
      win.isVisible() ? win.hide() : win.show();
    }
  });

  return tray;
}

/**
 * Update the tray badge / tooltip to reflect unread count.
 * @param {number} count
 */
function setUnreadCount(count) {
  if (!tray) return;
  const label = count > 0 ? `${count} unread` : 'No new messages';
  tray.setToolTip(`Chttrix — ${label}`);

  // macOS dock badge
  if (process.platform === 'darwin') {
    app.setBadgeCount(count);
  }
}

module.exports = { createTray, setUnreadCount };
