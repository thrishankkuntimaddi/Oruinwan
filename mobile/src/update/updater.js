// Checks for a newer build and installs it (Android) or opens its download (desktop).
// Sources, newest wins: Firebase Remote Config "android_release", then latest.json
// published with each GitHub release. Automatic checks run at most every 6 hours.
// The web app is redeployed on every change and iPhones update through the App Store or
// TestFlight, so neither checks.
import { create } from 'zustand';
import { registerPlugin } from '@capacitor/core';
import { UPDATE_MANIFEST_URL, RELEASES_PAGE } from '../config/env.js';
import { refreshRemoteConfig, remoteSnapshot } from '../config/remote.js';
import { desktop, isAndroid, isDesktop, isIOS, isNative, isWeb, nativeAppInfo, openExternal } from '../native/index.js';
import { prefs } from '../native/storage.js';
import { desktopDownload, evaluate, normalizeManifest, pickNewest } from './manifest.js';

// Native side: android/app/src/main/java/com/oruinwan/app/AppUpdaterPlugin.java
const AppUpdater = registerPlugin('AppUpdater');

const AUTO_INTERVAL = 6 * 60 * 60_000;

export const useUpdate = create(() => ({
  status: 'idle', // idle | checking | current | available | required | error | unknown
  manifest: null,
  currentVersion: __APP_VERSION__,
  checkedAt: prefs.get('update.checkedAt'),
  error: null,
  download: null, // { state: 'downloading'|'verifying'|'installing'|'failed', percent, message }
  skipped: prefs.get('update.skipped'),
}));

async function fetchManifestUrl() {
  try {
    const res = await fetch(`${UPDATE_MANIFEST_URL}${UPDATE_MANIFEST_URL.includes('?') ? '&' : '?'}t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return normalizeManifest(await res.json());
  } catch {
    return null;
  }
}

export async function checkForUpdate({ auto = false } = {}) {
  const state = useUpdate.getState();
  if (isWeb || isIOS) {
    useUpdate.setState({ status: 'current', manifest: null, error: null });
    return useUpdate.getState();
  }
  if (state.status === 'checking') return state;
  if (auto && state.checkedAt && Date.now() - state.checkedAt < AUTO_INTERVAL && state.status !== 'idle') {
    return state;
  }
  useUpdate.setState({ status: 'checking', error: null });
  const { version } = await nativeAppInfo();
  let remoteAnswered = false;
  const [remote, published] = await Promise.all([
    refreshRemoteConfig({ force: !auto }).then((r) => {
      remoteAnswered = r.ok && (r.reason !== 'throttled' || Boolean(remoteSnapshot().fetchedAt));
      return r.ok ? normalizeManifest(r.release ?? remoteSnapshot().release) : null;
    }),
    fetchManifestUrl(),
  ]);
  const manifest = pickNewest(remote, published);
  const checkedAt = Date.now();
  prefs.set('update.checkedAt', checkedAt);
  if (!manifest && remoteAnswered) {
    // Remote Config answered and advertises no release, so nothing newer exists.
    useUpdate.setState({ status: 'current', manifest: null, currentVersion: version, checkedAt, error: null });
    return useUpdate.getState();
  }
  if (!manifest) {
    useUpdate.setState({
      status: 'unknown',
      currentVersion: version,
      checkedAt,
      error: 'No release information is reachable right now.',
    });
    return useUpdate.getState();
  }
  const result = evaluate(manifest, version, prefs.get('update.skipped'));
  useUpdate.setState({ ...result, status: result.status, currentVersion: version, checkedAt, error: null });
  return useUpdate.getState();
}

export function skipVersion(version) {
  prefs.set('update.skipped', version);
  useUpdate.setState({ skipped: version });
}

let progressSub = null;

/**
 * Android: downloads the APK, verifies its SHA-256, and hands it to Android's installer.
 * Desktop: opens the installer for this computer in the browser.
 */
export async function installUpdate() {
  const { manifest } = useUpdate.getState();
  if (!manifest) return { ok: false };
  if (isDesktop) {
    await openExternal(desktopDownload(manifest, desktop) || RELEASES_PAGE);
    return { ok: true, via: 'browser' };
  }
  if (!isNative || !isAndroid || !manifest.apkUrl) {
    await openExternal(manifest.pageUrl || manifest.apkUrl || RELEASES_PAGE);
    return { ok: true, via: 'browser' };
  }
  try {
    const { granted } = await AppUpdater.canInstallPackages();
    if (!granted) {
      useUpdate.setState({
        download: {
          state: 'permission',
          percent: 0,
          message: 'Allow Oruinwan to install updates, then come back and tap Update again.',
        },
      });
      await AppUpdater.openInstallPermissionSettings();
      return { ok: false, reason: 'permission' };
    }
    progressSub?.remove?.();
    progressSub = await AppUpdater.addListener('progress', (p) => {
      useUpdate.setState({ download: { state: p.state, percent: p.percent ?? 0, message: null } });
    });
    useUpdate.setState({ download: { state: 'downloading', percent: 0, message: null } });
    await AppUpdater.downloadAndInstall({
      url: manifest.apkUrl,
      version: manifest.version,
      sha256: manifest.sha256 || '',
    });
    useUpdate.setState({ download: { state: 'installing', percent: 100, message: null } });
    return { ok: true, via: 'installer' };
  } catch (err) {
    const message =
      err?.code === 'CHECKSUM'
        ? 'The download was damaged or changed, so it was not installed. Try again.'
        : err?.message || 'The update could not be downloaded.';
    useUpdate.setState({ download: { state: 'failed', percent: 0, message } });
    return { ok: false, reason: message };
  } finally {
    progressSub?.remove?.();
    progressSub = null;
  }
}
