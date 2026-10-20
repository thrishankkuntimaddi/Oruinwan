// What this phone's push notifications look like right now, and a way to turn them on.
import { useCallback, useEffect, useState } from 'react';
import { api, useSession } from '../../data/session.js';
import { pushAvailable, pushPermission, pushPlatform } from '../../native/push.js';
import { prefs } from '../../native/storage.js';

/**
 * state: 'loading' | 'on' | 'prompt' (never asked) | 'denied' (turned off for the app in system
 * settings) | 'no-server' (this server can't send them) | 'unavailable' (browser, signed out, or a build
 * without push).
 */
export function usePushState() {
  const mode = useSession((s) => s.mode);
  const [state, setState] = useState('loading');

  const refresh = useCallback(async () => {
    if (mode !== 'live' || !pushAvailable) return setState('unavailable');
    try {
      const status = await api().pushStatus();
      if (!status?.[pushPlatform]) return setState('no-server');
    } catch {
      return setState('unavailable');
    }
    const permission = await pushPermission();
    setState(permission === 'granted' ? 'on' : permission);
  }, [mode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const turnOn = useCallback(async () => {
    const result = await useSession.getState().syncPush({ ask: true });
    await refresh();
    return result;
  }, [refresh]);

  return { state, turnOn, refresh };
}

const DISMISS_KEY = 'push.promptDismissedAt';
const REMIND_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

/** The Home card asks again two weeks after "Not now". */
export const promptDismissed = () => Date.now() - (prefs.get(DISMISS_KEY) || 0) < REMIND_AFTER_MS;
export const dismissPrompt = () => prefs.set(DISMISS_KEY, Date.now());
