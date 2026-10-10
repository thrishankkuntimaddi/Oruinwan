// Two kinds of storage:
//  - prefs: small per-device UI settings, synchronous (localStorage).
//  - secure: session tokens and keys. On Android these live in the app-private
//    SharedPreferences via @capacitor/preferences; on the web, localStorage.
import { Preferences } from '@capacitor/preferences';
import { isNative } from './index.js';

const PREFIX = 'oru.';

export const prefs = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (value === undefined || value === null) localStorage.removeItem(PREFIX + key);
      else localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage full or blocked: the setting just won't persist */
    }
  },
  raw(key) {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  setRaw(key, value) {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {
      /* ignore */
    }
  },
};

export const secure = {
  async get(key) {
    if (isNative) {
      const { value } = await Preferences.get({ key: PREFIX + key });
      return value;
    }
    return prefs.raw(`s.${key}`);
  },
  async set(key, value) {
    if (isNative) {
      if (value == null) await Preferences.remove({ key: PREFIX + key });
      else await Preferences.set({ key: PREFIX + key, value });
      return;
    }
    if (value == null) localStorage.removeItem(`${PREFIX}s.${key}`);
    else prefs.setRaw(`s.${key}`, value);
  },
};

/** Removes everything this app stored on the device. */
export async function wipeDevice() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  if (isNative) {
    const { keys } = await Preferences.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX)).map((key) => Preferences.remove({ key })));
  }
  for (const name of ['oru-cache', 'oru-keys']) {
    try {
      indexedDB.deleteDatabase(name);
    } catch {
      /* ignore */
    }
  }
}
