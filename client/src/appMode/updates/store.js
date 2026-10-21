// Update checks for the web client, wherever it runs:
//  - desktop app: latest.json from the newest GitHub release. A signed UI bundle installs without a
//    reinstall ("Update and restart": the main process verifies it, desktop/electron/ota.js); a
//    release that changes the app itself (minNativeVersion) or an older app opens the installer.
//  - Android app in app mode (older tablet builds): the APK through the AppUpdater plugin.
//  - browser: /version.json from the server; a newer deployed build offers "Reload".
// Automatic checks: a few seconds after start, then every 6 hours (browser: every 30 minutes and
// when the tab comes back, at most every 10 minutes). Raised once per version as a toast and as a
// card in Notifications.
import { useSyncExternalStore } from 'react';
import { planUpdate, updateReducer } from './bundle.js';
import { MANIFEST_URL, RELEASES_URL, desktopDownload, normalizeManifest } from './manifest.js';

export const APP_INTERVAL = 6 * 60 * 60 * 1000;
export const WEB_INTERVAL = 30 * 60 * 1000;
export const WEB_FOCUS_MIN = 10 * 60 * 1000;
const DISMISSED_KEY = 'oruinwan.update.dismissed';

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage blocked */
    }
  },
};

/** 'desktop' | 'android' | 'web' | 'none' */
export function detectKind({ win = typeof window !== 'undefined' ? window : undefined, isApp = false, isSite = false } = {}) {
  if (!win) return 'none';
  if (win.oruinwanDesktop) return 'desktop';
  if (isSite) return 'none';
  if (isApp) {
    const cap = win.Capacitor;
    if (cap?.getPlatform?.() === 'android' && cap.isPluginAvailable?.('AppUpdater')) return 'android';
    return 'none'; // iPads update through the App Store, Play builds through Play
  }
  return 'web';
}

/**
 * The updater, with its outside world passed in (tests pass fakes):
 *   kind, fetch, desktop (window.oruinwanDesktop), capacitor (window.Capacitor), reload,
 *   openUrl, uiVersion (this build), buildId (this build), now
 */
export function createUpdater(env) {
  let state = {
    status: 'idle',
    kind: env.kind,
    plan: null,
    manifest: null,
    percent: 0,
    error: null,
    checkedAt: null,
    uiVersion: env.uiVersion || '',
    shellVersion: env.desktop?.version || null,
    source: 'bundled',
    dismissed: storage.get(DISMISSED_KEY),
  };
  const listeners = new Set();
  const set = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  const dispatch = (event, extra = {}) => set({ ...updateReducer(state, event), ...extra });

  async function fetchJson(url) {
    const res = await env.fetch(`${url}${url.includes('?') ? '&' : '?'}t=${env.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function checkDesktop() {
    const info = (await env.desktop.updates?.info?.().catch(() => null)) || null;
    const manifest = normalizeManifest(await fetchJson(MANIFEST_URL));
    const shellVersion = info?.shellVersion || env.desktop.version || state.uiVersion;
    const plan = planUpdate({
      manifest,
      target: 'desktop',
      uiVersion: state.uiVersion || shellVersion,
      shellVersion,
      canApplyBundles: Boolean(info?.canApplyBundles),
    });
    return { manifest, plan, extra: { shellVersion, source: info?.source || 'bundled', staged: info?.staged || null } };
  }

  async function checkAndroid() {
    const manifest = normalizeManifest(await fetchJson(MANIFEST_URL));
    const plan = planUpdate({ manifest, target: 'phone', uiVersion: state.uiVersion, shellVersion: state.uiVersion, canApplyBundles: false });
    return { manifest, plan, extra: {} };
  }

  async function checkWeb() {
    const data = await fetchJson('/version.json');
    const build = data && typeof data.build === 'string' ? data.build : null;
    const changed = Boolean(build && env.buildId && build !== env.buildId);
    const manifest = changed ? { version: data.version || '', notes: '' } : null;
    return {
      manifest,
      plan: changed ? { status: 'available', mode: 'reload', bundle: null, reason: null } : { status: 'current', mode: null },
      extra: {},
    };
  }

  let inflight = null;
  /** Checks now (also runs automatically, see start). */
  async function check() {
    if (state.kind === 'none') return state;
    if (inflight) return inflight;
    dispatch({ type: 'check' });
    inflight = (async () => {
      try {
        const run = state.kind === 'desktop' ? checkDesktop : state.kind === 'android' ? checkAndroid : checkWeb;
        const { manifest, plan, extra } = await run();
        dispatch({ type: 'checked', plan, manifest, at: env.now() }, extra);
        // Already downloaded in this session or an earlier one: ready to restart.
        if (plan.mode === 'bundle' && extra.staged && extra.staged === manifest?.version && state.status === 'available') {
          set({ status: 'ready', percent: 100 });
        }
      } catch (err) {
        dispatch({ type: 'check-failed', error: state.kind === 'web' ? 'Could not reach the server.' : 'Could not reach GitHub to check for updates.' });
        if (env.debug) env.debug(err);
      } finally {
        inflight = null;
      }
      return state;
    })();
    return inflight;
  }

  async function downloadBundle() {
    const { plan, manifest } = state;
    dispatch({ type: 'download' });
    const off = env.desktop.updates.onProgress?.((p) => {
      if (p?.state === 'downloading') dispatch({ type: 'progress', percent: p.percent });
    });
    try {
      const res = await env.desktop.updates.download({ ...plan.bundle, version: manifest.version });
      if (!res || res.error) {
        dispatch({ type: 'failed', error: res?.error || 'The update could not be downloaded.' });
        return false;
      }
      dispatch({ type: 'downloaded' });
      return true;
    } finally {
      if (typeof off === 'function') off();
    }
  }

  /** The one button: install and restart, open the installer, or reload the page. */
  async function install() {
    const { plan, manifest, kind } = state;
    if (!plan || !manifest) return { ok: false };
    if (plan.mode === 'reload') {
      env.reload();
      return { ok: true, via: 'reload' };
    }
    if (kind === 'desktop' && plan.mode === 'bundle' && env.desktop?.updates) {
      if (state.status !== 'ready' && !(await downloadBundle())) return { ok: false };
      dispatch({ type: 'apply' });
      const res = await env.desktop.updates.apply();
      if (res?.error) {
        dispatch({ type: 'failed', error: res.error });
        return { ok: false };
      }
      return { ok: true, via: 'bundle' };
    }
    if (kind === 'desktop') {
      env.openUrl(desktopDownload(manifest, env.desktop));
      return { ok: true, via: 'installer' };
    }
    if (kind === 'android') return installApk(manifest);
    env.openUrl(manifest.pageUrl || RELEASES_URL);
    return { ok: true, via: 'browser' };
  }

  async function installApk(manifest) {
    const updater = env.capacitor?.Plugins?.AppUpdater;
    if (!updater || !manifest.apkUrl) {
      env.openUrl(manifest.pageUrl || RELEASES_URL);
      return { ok: true, via: 'browser' };
    }
    try {
      const { granted } = await updater.canInstallPackages();
      if (!granted) {
        set({ error: 'Allow Oruinwan to install updates, then tap Update again.' });
        await updater.openInstallPermissionSettings();
        return { ok: false };
      }
      dispatch({ type: 'download' });
      await updater.downloadAndInstall({ url: manifest.apkUrl, version: manifest.version, sha256: manifest.sha256 || '' });
      dispatch({ type: 'downloaded' });
      return { ok: true, via: 'installer' };
    } catch (err) {
      dispatch({
        type: 'failed',
        error: err?.code === 'CHECKSUM' ? 'The download was damaged, so it was not installed. Try again.' : 'The update could not be downloaded. Try again.',
      });
      return { ok: false };
    }
  }

  /** Desktop: back to the UI that came with the app (restarts). */
  async function revertToBuiltIn() {
    await env.desktop?.updates?.reset?.();
  }

  /** "Later": no more automatic notice for this version. */
  function dismiss() {
    if (!state.manifest) return;
    const key = state.manifest.version || state.plan?.mode || 'update';
    storage.set(DISMISSED_KEY, key);
    set({ dismissed: key });
  }

  /** The running UI started: a just-installed desktop update is kept (ota.js boot watchdog). */
  function confirmStarted() {
    env.desktop?.updates?.confirmStarted?.();
  }

  let timers = [];
  function start() {
    if (state.kind === 'none' || timers.length) return stop;
    confirmStarted();
    env.desktop?.updates?.info?.().then((info) => info && set({ shellVersion: info.shellVersion, source: info.source })).catch(() => {});
    const web = state.kind === 'web';
    timers.push(setTimeout(check, web ? 60_000 : 4000));
    timers.push(setInterval(check, web ? WEB_INTERVAL : APP_INTERVAL));
    if (web && typeof document !== 'undefined') {
      const onVisible = () => {
        if (document.visibilityState === 'visible' && (!state.checkedAt || env.now() - state.checkedAt > WEB_FOCUS_MIN)) check();
      };
      document.addEventListener('visibilitychange', onVisible);
      timers.push({ off: () => document.removeEventListener('visibilitychange', onVisible) });
    }
    return stop;
  }
  function stop() {
    for (const t of timers) {
      if (t && t.off) t.off();
      else {
        clearTimeout(t);
        clearInterval(t);
      }
    }
    timers = [];
  }

  return {
    getState: () => state,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    check,
    install,
    dismiss,
    revertToBuiltIn,
    confirmStarted,
    start,
    stop,
  };
}

/** Has a newer version that should be shown (not dismissed). */
export function hasUpdate(s) {
  return ['available', 'downloading', 'ready', 'applying', 'failed'].includes(s.status) && Boolean(s.manifest);
}

/** Short title: "Oruinwan 2.2.0 is available" / "A new version of Oruinwan is available". */
export function updateTitle(s) {
  if (s.plan?.mode === 'reload' || !s.manifest?.version) return 'A new version of Oruinwan is available';
  return `Oruinwan ${s.manifest.version} is available`;
}

/** Label for the one button. */
export function actionLabel(s) {
  if (s.plan?.mode === 'reload') return 'Reload';
  if (s.status === 'failed') return 'Try again';
  if (s.plan?.mode === 'bundle') return s.status === 'ready' ? 'Restart to update' : 'Update and restart';
  if (s.kind === 'desktop') return 'Download installer';
  return 'Update';
}

let singleton = null;
/** The app's updater (created on first use). */
export function getUpdater() {
  if (singleton) return singleton;
  const env = import.meta.env || {};
  const isApp = env.MODE === 'app';
  const isSite = env.MODE === 'site';
  const win = typeof window !== 'undefined' ? window : undefined;
  singleton = createUpdater({
    kind: env.DEV && !win?.oruinwanDesktop ? 'none' : detectKind({ win, isApp, isSite }),
    fetch: (...args) => win.fetch(...args),
    desktop: win?.oruinwanDesktop || null,
    capacitor: win?.Capacitor || null,
    reload: () => win.location.reload(),
    openUrl: (url) => (win?.oruinwanDesktop ? win.oruinwanDesktop.openExternal(url) : win.open(url, '_blank', 'noopener')),
    uiVersion: env.VITE_ORUINWAN_APP_VERSION || '',
    buildId: env.VITE_ORUINWAN_BUILD_ID || '',
    now: () => Date.now(),
  });
  return singleton;
}

/** React: the update state. */
export function useUpdateState() {
  const updater = getUpdater();
  return useSyncExternalStore(updater.subscribe, updater.getState, updater.getState);
}
