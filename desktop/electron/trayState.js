'use strict';

/**
 * Pure helpers for the tray, window-close behaviour and notification quick reply.
 * No Electron imports, so `node --test electron/__tests__` covers them without a display.
 */

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/; // the same ids client/src/desktop/bridge.js accepts
const MAX_REPLY_LENGTH = 4000;
const MAX_UNREAD = 9999;

/** Unread count from the page → a whole number 0..9999. */
function clampUnread(count) {
  const n = Number(count);
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_UNREAD, Math.floor(n))) : 0;
}

function trayTooltip(unread) {
  const n = clampUnread(unread);
  return n ? `Oruinwan — ${n} unread` : 'Oruinwan';
}

/**
 * Tray image under desktop/assets/tray/ (made by scripts/make-tray-icons.mjs).
 * macOS: a monochrome template image (the menu bar tints it; @2x is picked up automatically).
 * Windows: 16px with an @2x sibling for high-DPI. Linux: 32px, which tray hosts scale down.
 */
function trayIconFile(platform, unread) {
  const dot = clampUnread(unread) > 0;
  if (platform === 'darwin') return dot ? 'trayUnreadTemplate.png' : 'trayTemplate.png';
  if (platform === 'linux') return dot ? 'tray-unread-32.png' : 'tray-32.png';
  return dot ? 'tray-unread.png' : 'tray.png';
}

/** What the tray menu shows: it is rebuilt only when this changes. */
function trayMenuKey({ doNotDisturb = false, launchAtLogin = false } = {}) {
  return `${doNotDisturb ? 1 : 0}${launchAtLogin ? 1 : 0}`;
}

/** setLoginItemSettings works on macOS and Windows only. */
function supportsLaunchAtLogin(platform) {
  return platform === 'darwin' || platform === 'win32';
}

/** Inline reply on native notifications (Electron `hasReply`) exists on macOS and Windows. */
function supportsQuickReply(platform) {
  return platform === 'darwin' || platform === 'win32';
}

/**
 * What closing the window does.
 *  - 'close' when the app is quitting (tray Quit, Cmd+Q, app menu Quit, OS shutdown)
 *  - 'hide'  otherwise on macOS (stays in the dock) and, when a tray icon exists to bring it
 *            back, on Windows/Linux. The page stays loaded, so the socket keeps syncing.
 *  - 'close' on Windows/Linux without a tray (nothing would bring a hidden window back).
 */
function closeAction({ platform, isQuitting, hasTray }) {
  if (isQuitting) return 'close';
  if (platform === 'darwin') return 'hide';
  return hasTray ? 'hide' : 'close';
}

/** The conversation a notification points at, or null when it has no valid conversation. */
function conversationTarget(target) {
  const t = target && typeof target === 'object' ? target : {};
  const workspaceId = typeof t.workspaceId === 'string' && SAFE_ID.test(t.workspaceId) ? t.workspaceId : null;
  if (!workspaceId) return null;
  if (typeof t.channelId === 'string' && SAFE_ID.test(t.channelId)) return { workspaceId, channelId: t.channelId };
  if (typeof t.dmSessionId === 'string' && SAFE_ID.test(t.dmSessionId)) return { workspaceId, dmSessionId: t.dmSessionId };
  return null;
}

/**
 * The IPC payload for 'oruinwan:quick-reply', or null when the reply must be dropped.
 * Text is trimmed and capped; blank replies are dropped.
 */
function quickReplyPayload(target, text) {
  const conversation = conversationTarget(target);
  if (!conversation || typeof text !== 'string') return null;
  const trimmed = text.trim().slice(0, MAX_REPLY_LENGTH);
  if (!trimmed) return null;
  return { ...conversation, text: trimmed };
}

/** Constructor options for a native notification. */
function notificationOptions({ platform, title, body, target, doNotDisturb }) {
  if (doNotDisturb) return null;
  const options = { title, body };
  const conversation = conversationTarget(target);
  if (conversation && supportsQuickReply(platform)) {
    options.hasReply = true;
    options.replyPlaceholder = 'Reply…';
  }
  return options;
}

/** The reply text from Electron's 'reply' event: (details { reply }, deprecated reply string). */
function replyText(details, legacy) {
  if (details && typeof details.reply === 'string') return details.reply;
  return typeof legacy === 'string' ? legacy : '';
}

module.exports = {
  trayMenuKey,
  SAFE_ID,
  MAX_REPLY_LENGTH,
  clampUnread,
  trayTooltip,
  trayIconFile,
  supportsLaunchAtLogin,
  supportsQuickReply,
  closeAction,
  conversationTarget,
  quickReplyPayload,
  notificationOptions,
  replyText,
};
