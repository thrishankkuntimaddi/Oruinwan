'use strict';

/**
 * Oruinwan Desktop — Native Notifications
 *
 * Uses Electron's built-in Notification API.
 * Supports: messages, mentions, task reminders, system alerts.
 * All notifications click to focus the app and optionally deep-link.
 *
 * State:
 *  - enabled       user preference ("notificationsEnabled")
 *  - doNotDisturb  temporary mute ("doNotDisturb")
 *  A notification is only shown when enabled && !doNotDisturb.
 */

const { Notification } = require('electron');
const path = require('path');

const ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.png');

let notificationsEnabled = true;
let doNotDisturb = false;
let soundEnabled = true;

// Electron Notification objects are garbage-collected once nothing references
// them, which silently drops their click handlers. Keep every live notification
// here until it is clicked, closed or fails.
const activeNotifications = new Set();

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
  title = 'Oruinwan',
  body  = '',
  type  = 'system',
  silent = !soundEnabled,
  onClick,
} = {}) {
  if (!notificationsEnabled || doNotDisturb) return;
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title,
    body,
    icon: ICON_PATH,
    silent,
    urgency: type === 'mention' ? 'critical' : 'normal', // Linux urgency
  });

  activeNotifications.add(notification);
  const release = () => activeNotifications.delete(notification);

  notification.on('click', () => {
    release();
    if (typeof onClick === 'function') onClick({ type });
  });
  notification.on('close', release);
  notification.on('failed', release);

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
  const due = dueDate ? new Date(dueDate) : null;
  const body = due && !Number.isNaN(due.getTime())
    ? `Due: ${due.toLocaleDateString()}`
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

function setDoNotDisturb(value) {
  doNotDisturb = !!value;
}

function isDoNotDisturb() {
  return doNotDisturb;
}

function setSoundEnabled(value) {
  soundEnabled = !!value;
}

module.exports = {
  showNotification,
  notifyMessage,
  notifyTaskReminder,
  notifyMention,
  setEnabled,
  isEnabled,
  setDoNotDisturb,
  isDoNotDisturb,
  setSoundEnabled,
};
