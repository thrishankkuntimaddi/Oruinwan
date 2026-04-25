'use strict';

/**
 * Chttrix Desktop — Native Notifications
 *
 * Uses Electron's built-in Notification API.
 * Supports: messages, mentions, task reminders, system alerts.
 * All notifications click to focus the app and optionally deep-link.
 */

const { Notification, BrowserWindow } = require('electron');
const path = require('path');

const ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.png');

let notificationsEnabled = true;

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Show a native OS notification.
 *
 * @param {object}    options
 * @param {string}    options.title
 * @param {string}    options.body
 * @param {'message'|'task'|'mention'|'system'} [options.type]
 * @param {boolean}   [options.silent]  - true to suppress sound
 * @param {Function}  [options.onClick] - called with { type } on notification click
 */
function showNotification({
  title = 'Chttrix',
  body  = '',
  type  = 'system',
  silent = false,
  onClick,
} = {}) {
  if (!notificationsEnabled) return;
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title,
    body,
    icon: ICON_PATH,
    silent,
    urgency: type === 'mention' ? 'critical' : 'normal', // Linux urgency
  });

  notification.on('click', () => {
    // Bring app window to front
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      const win = wins[0];
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
    if (typeof onClick === 'function') onClick({ type });
  });

  notification.show();
}

// ─── Typed helpers ────────────────────────────────────────────────────────────

/**
 * New direct message notification.
 */
function notifyMessage({ senderName, preview, onClick } = {}) {
  showNotification({
    title: `💬 ${senderName || 'New message'}`,
    body:  preview || 'You have a new message',
    type:  'message',
    onClick,
  });
}

/**
 * Task due / reminder notification.
 */
function notifyTaskReminder({ taskTitle, dueDate, onClick } = {}) {
  const body = dueDate
    ? `Due: ${new Date(dueDate).toLocaleDateString()}`
    : 'A task requires your attention';
  showNotification({
    title: `📋 ${taskTitle || 'Task Reminder'}`,
    body,
    type:  'task',
    onClick,
  });
}

/**
 * @mention notification — uses critical urgency on Linux.
 */
function notifyMention({ senderName, channelName, onClick } = {}) {
  showNotification({
    title: `🔔 ${senderName || 'Someone'} mentioned you`,
    body:  channelName ? `in #${channelName}` : 'You were mentioned',
    type:  'mention',
    onClick,
  });
}

// ─── State ────────────────────────────────────────────────────────────────────

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
