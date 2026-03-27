'use strict';

/**
 * Native Notification wrapper for Chttrix Desktop.
 * Uses Electron's built-in Notification API to surface
 * message alerts, task reminders, and system events.
 */

const { Notification, app } = require('electron');
const path = require('path');

// Resolve the icon relative to this file
const ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.png');

/**
 * Whether desktop notifications are currently enabled.
 * Can be toggled via the tray menu.
 */
let notificationsEnabled = true;

/**
 * Show a native OS notification.
 *
 * @param {object} options
 * @param {string} options.title   - Notification title
 * @param {string} options.body    - Notification body text
 * @param {string} [options.type]  - 'message' | 'task' | 'mention' | 'system'
 * @param {Function} [options.onClick] - Callback when the notification is clicked
 */
function showNotification({ title = 'Chttrix', body = '', type = 'system', onClick } = {}) {
  if (!notificationsEnabled) return;
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title,
    body,
    icon: ICON_PATH,
    silent: false,
  });

  notification.on('click', () => {
    // Bring the app to front on click
    const { BrowserWindow } = require('electron');
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      const win = wins[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    }
    if (typeof onClick === 'function') onClick({ type });
  });

  notification.show();
}

/**
 * Show a new-message notification.
 */
function notifyMessage({ senderName, preview, onClick } = {}) {
  showNotification({
    title: `💬 New message from ${senderName || 'someone'}`,
    body: preview || 'You have a new message',
    type: 'message',
    onClick,
  });
}

/**
 * Show a task-reminder notification.
 */
function notifyTaskReminder({ taskTitle, dueDate, onClick } = {}) {
  const body = dueDate
    ? `Due: ${new Date(dueDate).toLocaleDateString()}`
    : 'A task requires your attention';
  showNotification({
    title: `📋 Task Reminder: ${taskTitle || 'Untitled Task'}`,
    body,
    type: 'task',
    onClick,
  });
}

/**
 * Show a mention notification.
 */
function notifyMention({ senderName, channelName, onClick } = {}) {
  showNotification({
    title: `🔔 ${senderName || 'Someone'} mentioned you`,
    body: channelName ? `in #${channelName}` : 'You were mentioned',
    type: 'mention',
    onClick,
  });
}

function setEnabled(enabled) {
  notificationsEnabled = !!enabled;
}

function isEnabled() {
  return notificationsEnabled;
}

module.exports = {
  showNotification,
  notifyMessage,
  notifyTaskReminder,
  notifyMention,
  setEnabled,
  isEnabled,
};
