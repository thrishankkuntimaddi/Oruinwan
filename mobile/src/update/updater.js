// Checks for a newer release and installs it.
//  - Quick update (Android, both the GitHub and Play builds): the release's signed UI bundle is
//    downloaded, its Ed25519 signature checked against the key compiled into this app, and the
//    app restarts into it. No reinstall (src/update/bundle.js, OtaBundlePlugin.java).
//  - Full update: when the release changes the native app (minNativeVersion), or has no signed
//    bundle. Android (GitHub build) downloads, verifies and installs the APK; Google Play builds
//    open Play; the desktop opens its installer.
// Sources, newest wins: Firebase Remote Config "android_release", then latest.json published with
// each GitHub release. Automatic checks run at start and at most every 6 hours.
// The web app is redeployed on every change and iPhones update through the App Store or
// TestFlight, so neither checks.
import { create } from 'zustand';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { UPDATE_MANIFEST_URL, RELEASES_PAGE } from '../config/env.js';
import { refreshRemoteConfig, remoteSnapshot } from '../config/remote.js';
import { desktop, isAndroid, isDesktop, isIOS, isNative, isPlayStore, isWeb, nativeAppInfo, openExternal } from '../native/index.js';
import { prefs } from '../native/storage.js';
import { toast } from '../lib/bus.js';
import { desktopDownload, normalizeManifest, pickNewest } from './manifest.js';
import { bundleMessage, planUpdate } from './bundle.js';
import { verifyEd25519 } from './ed25519.js';

// Native side: android/app/src/main/java/com/oruinwan/app/AppUpdaterPlugin.java
const AppUpdater = registerPlugin('AppUpdater');
// Native side: android/app/src/main/java/com/oruinwan/app/OtaBundlePlugin.java
const OtaBundle = registerPlugin('OtaBundle');

const AUTO_INTERVAL = 6 * 60 * 60_000;
const PLAY_PAGE = 'https://play.google.com/store/apps/details?id=com.oruinwan.app';
/** The public half of the release signing key (platform/update-public-key.txt), '' if none. */
export const UPDATE_PUBLIC_KEY = typeof __UPDATE_PUBLIC_KEY__ === 'string' ? __UPDATE_PUBLIC_KEY__ : '';
/** This app can install signed UI bundles. */
export const canApplyBundles = () => Boolean(isNative && isAndroid && UPDATE_PUBLIC_KEY && Capacitor.isPluginAvailable('OtaBundle'));

export const useUpdate = create(() => ({
  status: 'idle', // idle | checking | current | available | required | error | unknown
  manifest: null,
  plan: null, // { mode: 'bundle' | 'installer', bundle, reason }
  currentVersion: __APP_VERSION__, // the UI that is running
  shellVersion: null, // the installed app
  uiSource: 'bundled', // 'bundled' (inside the app) | 'downloaded' (a quick update)
  checkedAt: prefs.get('update.checkedAt'),
  error: null,
  download: null, // { state: 'downloading'|'verifying'|'unpacking'|'restarting'|'installing'|'permission'|'failed', percent, message }
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

async function shellInfo() {
  const { version } = await nativeAppInfo();
  if (!canApplyBundles()) return { shellVersion: version, uiSource: 'bundled' };
  try {
    const info = await OtaBundle.info();
    return { shellVersion: info.shellVersion || version, uiSource: info.source === 'downloaded' ? 'downloaded' : 'bundled' };
  } catch {
    return { shellVersion: version, uiSource: 'bundled' };
  }
}

/** "Oruinwan 2.x is available", once per version, for checks that find something new. */
function announce(state) {
  const version = state.manifest?.version;
  if (!version || state.status !== 'available' || prefs.get('update.announced') === version) return;
  prefs.set('update.announced', version);
  toast(`Oruinwan ${version} is available. Open Settings → Updates to install it.`, 'neutral');
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
  const { shellVersion, uiSource } = await shellInfo();
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
  const base = { currentVersion: __APP_VERSION__, shellVersion, uiSource, checkedAt };
  if (!manifest && remoteAnswered) {
    // Remote Config answered and advertises no release, so nothing newer exists.
    useUpdate.setState({ ...base, status: 'current', manifest: null, plan: null, error: null });
    return useUpdate.getState();
  }
  if (!manifest) {
    useUpdate.setState({ ...base, status: 'unknown', error: 'No release information is reachable right now.' });
    return useUpdate.getState();
  }
  const plan = planUpdate({
    manifest,
    target: 'phone',
    uiVersion: __APP_VERSION__,
    shellVersion,
    canApplyBundles: canApplyBundles(),
  });
  // Play installs full updates itself; only quick updates are offered in the app there.
  const status = isPlayStore && plan.mode === 'installer' && plan.status === 'available' ? 'current' : plan.status;
  useUpdate.setState({
    ...base,
    status,
    manifest,
    plan,
    error: null,
    skipped: prefs.get('update.skipped'),
    download: state.download?.state === 'failed' ? state.download : null,
  });
  if (auto) announce(useUpdate.getState());
  return useUpdate.getState();
}

export function skipVersion(version) {
  prefs.set('update.skipped', version);
  useUpdate.setState({ skipped: version });
}

let progressSub = null;
const setDownload = (download) => useUpdate.setState({ download });

/** Quick update: verify the signature, download and unpack the UI, then restart into it. */
async function installBundle(manifest, bundle) {
  setDownload({ state: 'verifying', percent: 0, message: null });
  const signed =
    UPDATE_PUBLIC_KEY &&
    bundle.signature &&
    (await verifyEd25519(UPDATE_PUBLIC_KEY, bundleMessage('phone', manifest.version, bundle.sha256), bundle.signature));
  if (!signed) {
    setDownload({ state: 'failed', percent: 0, message: "This update isn't signed by Oruinwan, so it was not installed." });
    return { ok: false, reason: 'signature' };
  }
  try {
    progressSub?.remove?.();
    progressSub = await OtaBundle.addListener('progress', (p) =>
      setDownload({ state: p.state === 'unpacking' ? 'unpacking' : 'downloading', percent: p.percent ?? 0, message: null }),
    );
    setDownload({ state: 'downloading', percent: 0, message: null });
    const { path } = await OtaBundle.download({ url: bundle.url, sha256: bundle.sha256, version: manifest.version });
    setDownload({ state: 'restarting', percent: 100, message: null });
    // The page reloads into the new UI, which confirms it started (confirmRunningBundle).
    await OtaBundle.apply({ path, version: manifest.version });
    return { ok: true, via: 'bundle' };
  } catch (err) {
    const message =
      err?.code === 'CHECKSUM'
        ? 'The download was damaged or changed, so it was not installed. Try again.'
        : err?.message || 'The update could not be downloaded.';
    setDownload({ state: 'failed', percent: 0, message });
    return { ok: false, reason: message };
  } finally {
    progressSub?.remove?.();
    progressSub = null;
  }
}

/**
 * One click: a quick update installs and restarts the app; a full update downloads the APK
 * (Android), opens Google Play, or opens this computer's installer.
 */
export async function installUpdate() {
  const { manifest, plan } = useUpdate.getState();
  if (!manifest) return { ok: false };
  if (plan?.mode === 'bundle' && plan.bundle && canApplyBundles()) return installBundle(manifest, plan.bundle);
  if (isDesktop) {
    await openExternal(desktopDownload(manifest, desktop) || RELEASES_PAGE);
    return { ok: true, via: 'browser' };
  }
  if (isPlayStore) {
    await openExternal(PLAY_PAGE);
    return { ok: true, via: 'store' };
  }
  if (!isNative || !isAndroid || !manifest.apkUrl) {
    await openExternal(manifest.pageUrl || manifest.apkUrl || RELEASES_PAGE);
    return { ok: true, via: 'browser' };
  }
  try {
    const { granted } = await AppUpdater.canInstallPackages();
    if (!granted) {
      setDownload({
        state: 'permission',
        percent: 0,
        message: 'Allow Oruinwan to install updates, then come back and tap Update again.',
      });
      await AppUpdater.openInstallPermissionSettings();
      return { ok: false, reason: 'permission' };
    }
    progressSub?.remove?.();
    progressSub = await AppUpdater.addListener('progress', (p) => {
      setDownload({ state: p.state, percent: p.percent ?? 0, message: null });
    });
    setDownload({ state: 'downloading', percent: 0, message: null });
    await AppUpdater.downloadAndInstall({
      url: manifest.apkUrl,
      version: manifest.version,
      sha256: manifest.sha256 || '',
    });
    setDownload({ state: 'installing', percent: 100, message: null });
    return { ok: true, via: 'installer' };
  } catch (err) {
    const message =
      err?.code === 'CHECKSUM'
        ? 'The download was damaged or changed, so it was not installed. Try again.'
        : err?.message || 'The update could not be downloaded.';
    setDownload({ state: 'failed', percent: 0, message });
    return { ok: false, reason: message };
  } finally {
    progressSub?.remove?.();
    progressSub = null;
  }
}

/**
 * Tells the app the running UI started fine. A quick update that never gets here is rolled
 * back to the previous UI (OtaBundleStore.java). Called once the app has booted.
 */
export async function confirmRunningBundle() {
  if (!canApplyBundles()) return false;
  try {
    const { confirmed } = await OtaBundle.confirm();
    return Boolean(confirmed);
  } catch {
    return false;
  }
}

/** Go back to the UI that came with the installed app. The page reloads. */
export async function revertToBuiltInUi() {
  if (!canApplyBundles()) return false;
  await OtaBundle.reset();
  return true;
}
