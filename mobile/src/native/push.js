// Push notifications on the phone. Android delivers through Firebase (only in builds that include
// google-services.json, see vite.config.js), iPhone through Apple. Every call is safe anywhere:
// in a browser, or in a build without push, they report 'unavailable' and do nothing.
import { PushNotifications } from '@capacitor/push-notifications';
import { isAndroid, isIOS, isNative } from './index.js';
import { prefs } from './storage.js';

export const pushAvailable = isNative && (isIOS || (isAndroid && __ANDROID_PUSH__));
export const pushPlatform = isIOS ? 'ios' : 'android';

let listening = false;
let tokenWaiters = [];
let tapHandler = null;
let pendingTap = null;

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
  // Tapping a notification opens the app; the handler routes to the conversation.
  PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const data = notification?.data || {};
    if (tapHandler) tapHandler(data);
    else pendingTap = data;
  });
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

/** Where a tapped notification should go. A tap that launched the app is replayed once set. */
export function onPushTap(handler) {
  if (pushAvailable) listen();
  tapHandler = handler;
  if (pendingTap && handler) {
    const data = pendingTap;
    pendingTap = null;
    handler(data);
  }
  return () => {
    if (tapHandler === handler) tapHandler = null;
  };
}

export async function clearDeliveredPushes() {
  if (!pushAvailable) return;
  await PushNotifications.removeAllDeliveredNotifications().catch(() => {});
}
