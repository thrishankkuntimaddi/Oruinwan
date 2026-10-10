// Firebase Remote Config, loaded lazily after first paint so it never delays startup.
// Keys (all optional; the app has defaults for each):
//   features            JSON  {"ai":true,"huddles":false,...}         → feature flags
//   android_release     JSON  {"version":"1.1.0","apkUrl":"…","sha256":"…","notes":"…","minVersion":"1.0.0"}
//   default_server_url  string  pre-fills the sign-in screen
//   announcement        string  one-line banner on Home ("" hides it)
import { firebaseConfig } from './env.js';
import { useFlags } from './flags.js';
import { prefs } from '../native/storage.js';

const DEFAULTS = {
  features: '{}',
  android_release: '',
  default_server_url: '',
  announcement: '',
};

let loaded = null;
let lastFetch = 0;

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

async function load() {
  if (!firebaseConfig) return null;
  const [{ initializeApp, getApps }, rc] = await Promise.all([
    import('@firebase/app'),
    import('@firebase/remote-config'),
  ]);
  const app = getApps()[0] || initializeApp(firebaseConfig);
  const remoteConfig = rc.getRemoteConfig(app);
  remoteConfig.settings = {
    minimumFetchIntervalMillis: import.meta.env.DEV ? 60_000 : 15 * 60_000,
    fetchTimeoutMillis: 8000,
  };
  remoteConfig.defaultConfig = DEFAULTS;
  return { rc, remoteConfig };
}

/** Fetches and activates remote values. Safe to call often; it is throttled. */
let inflight = null;

export function refreshRemoteConfig(opts) {
  // Concurrent callers (boot + update check) share one request.
  inflight ||= doRefresh(opts).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doRefresh({ force = false } = {}) {
  if (!firebaseConfig) return { ok: false, reason: 'not-configured' };
  if (!force && Date.now() - lastFetch < 5 * 60_000) return { ok: true, reason: 'throttled' };
  try {
    loaded ||= load();
    const ctx = await loaded;
    await ctx.rc.fetchAndActivate(ctx.remoteConfig);
    lastFetch = Date.now();
    const all = ctx.rc.getAll(ctx.remoteConfig);
    const values = Object.fromEntries(Object.entries(all).map(([k, v]) => [k, v.asString()]));
    const features = parseJson(values.features);
    if (features) useFlags.getState().applyRemote(features);
    const snapshot = {
      release: parseJson(values.android_release),
      defaultServerUrl: (values.default_server_url || '').trim(),
      announcement: (values.announcement || '').trim(),
      fetchedAt: Date.now(),
    };
    prefs.set('remote.snapshot', snapshot);
    return { ok: true, ...snapshot };
  } catch (err) {
    console.warn('[remote-config] fetch failed', err?.message || err);
    return { ok: false, reason: 'fetch-failed' };
  }
}

export function remoteSnapshot() {
  return prefs.get('remote.snapshot') || { release: null, defaultServerUrl: '', announcement: '' };
}

// Anonymous usage analytics: only when configured AND the user has not opted out.
let analytics = null;
export async function logEvent(name, params) {
  if (!firebaseConfig?.measurementId || prefs.get('privacy.analytics', true) === false) return;
  try {
    if (!analytics) {
      const [{ initializeApp, getApps }, an] = await Promise.all([import('@firebase/app'), import('@firebase/analytics')]);
      if (!(await an.isSupported())) return;
      const app = getApps()[0] || initializeApp(firebaseConfig);
      analytics = { an, instance: an.getAnalytics(app) };
    }
    analytics.an.logEvent(analytics.instance, name, params);
  } catch {
    /* analytics must never break the app */
  }
}

export async function setAnalyticsEnabled(enabled) {
  prefs.set('privacy.analytics', enabled);
  if (analytics) analytics.an.setAnalyticsCollectionEnabled(analytics.instance, enabled);
}
