// Calls on the device: keep a huddle running in the background, speaker or earpiece, screen
// on during video, microphone and camera permissions, and the device's name for "In a call on
// Pixel 8". Native side: android/app/src/main/java/com/oruinwan/app/CallSessionPlugin.java.
// Everything is a safe no-op where the plugin isn't there (the web build, iOS, tests).
import { Capacitor, registerPlugin } from '@capacitor/core';

const CallSession = registerPlugin('CallSession');

/** The plugin is only in the Android app (registered in MainActivity). */
export const hasCallSession = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('CallSession');

async function quietly(fn, fallback = false) {
  if (!hasCallSession()) return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Shows the ongoing "In call · title" notification so the call survives the background. */
export const startCallSession = ({ title, muted = false, video = false, startedAt = Date.now() }) =>
  quietly(async () => {
    await CallSession.start({ title, muted, video, startedAt });
    return true;
  });

export const updateCallSession = ({ title, muted = false, video = false, startedAt = Date.now() }) =>
  quietly(async () => {
    await CallSession.update({ title, muted, video, startedAt });
    return true;
  });

export const stopCallSession = () =>
  quietly(async () => {
    await CallSession.stop();
    return true;
  });

/** true: loudspeaker; false: earpiece (or the connected headset). */
export const setSpeaker = (on) =>
  quietly(async () => {
    await CallSession.setSpeaker({ on: Boolean(on) });
    return true;
  });

export const keepScreenOn = (on) => quietly(() => CallSession.keepScreenOn({ on: Boolean(on) }));

/** "Google Pixel 8", or null where the plugin isn't there. */
export const nativeDeviceName = () => quietly(async () => (await CallSession.deviceName())?.name || null, null);

/**
 * The microphone's or camera's permission: 'granted' | 'prompt' | 'prompt-with-rationale' |
 * 'denied'. 'granted' where the plugin isn't there (the WebView or browser asks by itself).
 */
export const permissionState = (kind) =>
  quietly(async () => (await CallSession.checkPermissions())?.[kind] || 'prompt', 'granted');

export const requestPermission = (kind) =>
  quietly(async () => (await CallSession.requestPermissions({ permissions: [kind] }))?.[kind] || 'denied', 'granted');

export const openAppSettings = () => quietly(() => CallSession.openSettings());

// ---------------------------------------------------------------- notifications permission

/** 'granted' | 'prompt' | 'denied' for notifications ('granted' where the plugin isn't there). */
export const notificationPermission = () =>
  quietly(async () => (await CallSession.notificationPermission())?.state || 'prompt', 'granted');

export const requestNotificationPermission = () =>
  quietly(async () => (await CallSession.requestNotificationPermission())?.state || 'denied', 'granted');

/** Android 14+: whether an incoming call may open full screen over the lock screen. */
export const fullScreenCallsAllowed = () => quietly(async () => Boolean((await CallSession.fullScreenCallsAllowed())?.allowed), true);

export const openFullScreenCallSettings = () => quietly(() => CallSession.openFullScreenCallSettings());

// ---------------------------------------------------------------- incoming calls

/** The phone's ringtone and vibration while the incoming-call screen shows. */
export const startRinging = () => quietly(() => CallSession.startRinging());
export const stopRinging = () => quietly(() => CallSession.stopRinging());

/** Rings with the system's call notification (used when the app is in the background). */
export const showIncomingNotification = (call) => quietly(async () => Boolean((await CallSession.showIncoming({ call }))?.shown));

export const cancelIncomingNotification = (huddleId) => quietly(() => CallSession.cancelIncoming({ huddleId: String(huddleId || '') }));

/**
 * fn(action, call) for taps on an incoming call's notification: 'answer' | 'open' | 'decline' |
 * 'cancel'. A tap that started the app is delivered once the listener is added.
 */
export function onIncomingCallAction(fn) {
  if (!hasCallSession()) return () => {};
  let sub = null;
  let gone = false;
  CallSession.addListener('callAction', (e) => fn(e?.action, e?.call || {}))
    .then((s) => {
      if (gone) s.remove();
      else sub = s;
    })
    .catch(() => {});
  return () => {
    gone = true;
    sub?.remove();
  };
}

/** After a ring ends: the app stops showing over the lock screen. */
export const leaveLockScreen = () => quietly(() => CallSession.leaveLockScreen());

// ---------------------------------------------------------------- crash reports

/** The last native crash's details (text), or null. */
export const lastCrashReport = () => quietly(async () => (await CallSession.lastCrash())?.report || null, null);
export const clearCrashReport = () => quietly(() => CallSession.clearLastCrash());

/** fn('mute' | 'leave') for taps on the notification's buttons. Returns an unsubscribe. */
export function onCallAction(fn) {
  if (!hasCallSession()) return () => {};
  let sub = null;
  let gone = false;
  CallSession.addListener('action', (e) => fn(e?.action))
    .then((s) => {
      if (gone) s.remove();
      else sub = s;
    })
    .catch(() => {});
  return () => {
    gone = true;
    sub?.remove();
  };
}
