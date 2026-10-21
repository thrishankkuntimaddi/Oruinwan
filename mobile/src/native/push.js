// Push notifications on phones and tablets. Android delivers through Firebase (only in builds that
// include google-services.json, see vite.config.js), iPhone and iPad through Apple. Every call is
// safe anywhere: in a browser, or in a build without push, they report 'unavailable' and do nothing.
//
// Quick reply: message notifications carry two actions, "Reply" (with a text field) and "Mark as
// read" (the 'oru.message' action type, registered through @capacitor/local-notifications).
// Replies are end-to-end encrypted, which needs the keys inside the app, so "Reply" opens the
// app on the conversation with the typed text in the composer (see features/push/quickReply.js).
//  - iPhone/iPad: the actions show on pushes whose aps.category is 'oru.message' (server side).
//  - Android: Firebase shows background pushes itself, without actions; while the app is running
//    a message push is re-posted as a local notification that has them.
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isAndroid, isIOS, isNative } from './index.js';
import { prefs } from './storage.js';

export const pushAvailable = isNative && (isIOS || (isAndroid && __ANDROID_PUSH__));
export const pushPlatform = isIOS ? 'ios' : 'android';

let listening = false;
let tokenWaiters = [];
let tapHandler = null;
let pendingTap = null;
let receivedHandler = null;

export const MESSAGE_ACTIONS = 'oru.message';

/** A notification action: null for a plain tap, else { id: 'reply' | 'read', input }. */
export function actionOf(actionId, inputValue) {
  if (!actionId || actionId === 'tap' || actionId === 'dismiss') return null;
  return { id: actionId, input: typeof inputValue === 'string' ? inputValue : '' };
}

function deliver(data, action) {
  if (tapHandler) tapHandler(data, action);
  else pendingTap = { data, action };
}

let actionsRegistered = false;
async function registerActions() {
  if (actionsRegistered) return;
  actionsRegistered = true;
  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: MESSAGE_ACTIONS,
          actions: [
            { id: 'reply', title: 'Reply', input: true, inputButtonTitle: 'Send', inputPlaceholder: 'Reply…', foreground: true },
            { id: 'read', title: 'Mark as read', foreground: false },
          ],
        },
      ],
    });
    LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, inputValue, notification }) => {
      deliver(notification?.extra || {}, actionOf(actionId, inputValue));
    });
  } catch {
    actionsRegistered = false; // plugin missing in this build: plain notifications still work
  }
}

function listen() {
  if (listening) return;
  listening = true;
  PushNotifications.addListener('registration', ({ value }) => {
    prefs.set('push.token', value);
    tokenWaiters.forEach((w) => w.resolve(value));
    tokenWaiters = [];
  });
  PushNotifications.addListener('registrationError', (err) => {
    tokenWaiters.forEach((w) => w.reject(new Error(err?.error || 'Push registration failed')));
    tokenWaiters = [];
  });
  // Tapping a notification (or one of its actions) opens the app; the handler routes it.
  PushNotifications.addListener('pushNotificationActionPerformed', ({ actionId, inputValue, notification }) => {
    deliver(notification?.data || {}, actionOf(actionId, inputValue));
  });
  // A push while the app runs (Android: re-posted with the reply actions, see onPushReceived).
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    receivedHandler?.(notification);
  });
  registerActions();
}

/** Called for pushes that arrive while the app runs. */
export function onPushReceived(handler) {
  if (pushAvailable) listen();
  receivedHandler = handler;
  return () => {
    if (receivedHandler === handler) receivedHandler = null;
  };
}

/** A stable notification id for a conversation, so new messages replace its notification. */
export function notificationIdFor(key) {
  let h = 0;
  for (const ch of String(key || '')) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h) % 2_000_000_000 || 1;
}

/**
 * Android: replaces a message push the plugin displayed with one that has Reply and Mark as
 * read. `show` false only removes it (the conversation is already open on screen).
 */
export async function repostWithActions(notification, { show = true } = {}) {
  if (!pushAvailable || !isAndroid) return;
  const data = notification?.data || {};
  const conv = data.conversationId || data.channelId || data.dmSessionId;
  if (!conv) return;
  try {
    const { notifications } = await PushNotifications.getDeliveredNotifications();
    const mine = (notifications || []).filter((n) => n.tag === String(conv) || n.id === notification.id);
    if (mine.length) await PushNotifications.removeDeliveredNotifications({ notifications: mine });
    if (!show) return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationIdFor(conv),
          title: notification.title || data.title || 'Oruinwan',
          body: notification.body || data.body || '',
          channelId: 'messages',
          group: String(conv),
          actionTypeId: MESSAGE_ACTIONS,
          extra: data,
        },
      ],
    });
  } catch {
    /* the plugin's own notification stays */
  }
}

/** 'granted' | 'denied' | 'prompt' | 'unavailable' */
export async function pushPermission() {
  if (!pushAvailable) return 'unavailable';
  try {
    const { receive } = await PushNotifications.checkPermissions();
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'unavailable';
  }
}

/**
 * Turns push on for this device and returns its token, or null. With `ask`, shows the system
 * permission prompt if it hasn't been answered; without, only continues if already allowed.
 */
export async function enablePush({ ask = false } = {}) {
  if (!pushAvailable) return null;
  listen();
  let state = await pushPermission();
  if (state === 'prompt' && ask) {
    const { receive } = await PushNotifications.requestPermissions();
    state = receive === 'granted' ? 'granted' : 'denied';
  }
  if (state !== 'granted') return null;
  if (isAndroid) {
    await PushNotifications.createChannel({
      id: 'messages',
      name: 'Messages',
      description: 'Direct messages, mentions and replies',
      importance: 4,
      visibility: 0,
    }).catch(() => {});
  }
  const token = new Promise((resolve, reject) => {
    tokenWaiters.push({ resolve, reject });
    setTimeout(() => reject(new Error('No push token from the system')), 15000);
  });
  await PushNotifications.register();
  return token.catch(() => null);
}

/** The token this device registered last (to remove it from the server on sign-out). */
export const lastPushToken = () => prefs.get('push.token') || null;

export async function disablePush() {
  if (!pushAvailable) return;
  prefs.set('push.token', null);
  await PushNotifications.unregister().catch(() => {});
}

/**
 * Where a tapped notification should go: handler(data, action), action null for a plain tap or
 * { id: 'reply' | 'read', input }. A tap that launched the app is replayed once set.
 */
export function onPushTap(handler) {
  if (pushAvailable) listen();
  tapHandler = handler;
  if (pendingTap && handler) {
    const { data, action } = pendingTap;
    pendingTap = null;
    handler(data, action);
  }
  return () => {
    if (tapHandler === handler) tapHandler = null;
  };
}

export async function clearDeliveredPushes() {
  if (!pushAvailable) return;
  await PushNotifications.removeAllDeliveredNotifications().catch(() => {});
  await LocalNotifications.removeAllDeliveredNotifications().catch(() => {});
}
