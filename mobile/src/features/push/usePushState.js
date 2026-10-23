// What this phone's notifications look like right now, and a way to turn them on.
//
// Two things are asked for separately on Android:
//  - push (Firebase), in builds that have it: messages and calls while the app is closed;
//  - the notifications permission itself (Android 13+), which calls need even without push
//    (the "In call" notification and the ringing call notification).
// Android 14+ also asks people to allow calls to open full screen over the lock screen.
import { useCallback, useEffect, useState } from 'react';
import { api, useSession } from '../../data/session.js';
import { pushAvailable, pushPermission, pushPlatform } from '../../native/push.js';
import { prefs } from '../../native/storage.js';
import {
  fullScreenCallsAllowed,
  hasCallSession,
  notificationPermission,
  openFullScreenCallSettings,
  requestNotificationPermission,
} from '../../native/callSession.js';

/**
 * state: 'loading' | 'on' | 'prompt' (never asked) | 'denied' (turned off for the app in system
 * settings) | 'no-server' (this server can't send them) | 'unavailable' (browser, signed out, or a build
 * without push or notifications).
 * fullScreen: false when Android 14+ won't let calls open full screen (offer the setting).
 */
export function usePushState() {
  const mode = useSession((s) => s.mode);
  const [state, setState] = useState('loading');
  const [fullScreen, setFullScreen] = useState(true);

  const refresh = useCallback(async () => {
    if (mode !== 'live') return setState('unavailable');
    if (!pushAvailable) {
      // No Firebase in this build: still ask for notifications, which calls need.
      if (!hasCallSession()) return setState('unavailable');
      const permission = await notificationPermission();
      setState(permission === 'granted' ? 'on' : permission);
      if (permission === 'granted') setFullScreen(await fullScreenCallsAllowed());
      return undefined;
    }
    try {
      const status = await api().pushStatus();
      if (!status?.[pushPlatform]) return setState('no-server');
    } catch {
      return setState('unavailable');
    }
    const permission = await pushPermission();
    setState(permission === 'granted' ? 'on' : permission);
    if (permission === 'granted' && hasCallSession()) setFullScreen(await fullScreenCallsAllowed());
    return undefined;
  }, [mode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const turnOn = useCallback(async () => {
    let result;
    if (pushAvailable) {
      result = await useSession.getState().syncPush({ ask: true });
    } else {
      const permission = await requestNotificationPermission();
      result = permission === 'granted' ? 'on' : permission;
    }
    await refresh();
    return result;
  }, [refresh]);

  const allowFullScreen = useCallback(async () => {
    await openFullScreenCallSettings();
  }, []);

  return { state, turnOn, refresh, fullScreen, allowFullScreen };
}

const DISMISS_KEY = 'push.promptDismissedAt';
const REMIND_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

/** The Home card asks again two weeks after "Not now". */
export const promptDismissed = () => Date.now() - (prefs.get(DISMISS_KEY) || 0) < REMIND_AFTER_MS;
export const dismissPrompt = () => prefs.set(DISMISS_KEY, Date.now());

const FULLSCREEN_KEY = 'push.fullScreenDismissedAt';
export const fullScreenDismissed = () => Date.now() - (prefs.get(FULLSCREEN_KEY) || 0) < REMIND_AFTER_MS;
export const dismissFullScreen = () => prefs.set(FULLSCREEN_KEY, Date.now());
