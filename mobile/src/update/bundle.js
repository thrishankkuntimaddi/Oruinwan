// Over-the-air UI bundles: pure helpers shared by the app (src/update/updater.js), the release
// script (scripts/write-manifest.mjs) and tests. No browser or Node APIs here.
//
// latest.json carries, next to the installers, one zip of built UI per app:
//   "bundles": {
//     "phone":   { "url": "https://…/Oruinwan-UI-phone.zip", "sha256": "<hex>", "size": 123,
//                  "signature": "<base64 Ed25519>", "minNativeVersion": "2.0.1" },
//     "desktop": { … the web client built for the desktop app … }
//   }
// The signature covers bundleMessage(target, version, sha256), so a bundle can't be replayed
// as another app's bundle or as a different version. Apps verify it with the public key compiled
// into them (platform/update-public-key.txt) and refuse unsigned bundles.
import { compareVersions, parseVersion } from '../lib/version.js';

export const BUNDLE_TARGETS = ['phone', 'desktop'];

/** The exact bytes (UTF-8) that are signed for a bundle. */
export function bundleMessage(target, version, sha256) {
  return `oruinwan-ui-bundle\n${target}\n${String(version).replace(/^v/i, '')}\n${String(sha256).toLowerCase()}`;
}

/** platform/update-public-key.txt (or an env value) → base64 key, or '' when none is set. */
export function parsePublicKey(text) {
  const line = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'));
  if (!line || !/^[A-Za-z0-9+/]{43}=$/.test(line)) return '';
  return line;
}

const httpsUrl = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null);

export function normalizeBundle(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = httpsUrl(raw.url);
  const sha256 = typeof raw.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(raw.sha256) ? raw.sha256.toLowerCase() : null;
  if (!url || !sha256) return null;
  const signature =
    typeof raw.signature === 'string' && /^[A-Za-z0-9+/]{86}==$/.test(raw.signature) ? raw.signature : null;
  return {
    url,
    sha256,
    size: Number.isFinite(raw.size) && raw.size > 0 ? raw.size : null,
    signature,
    minNativeVersion: parseVersion(raw.minNativeVersion) ? String(raw.minNativeVersion).replace(/^v/i, '') : null,
  };
}

export function normalizeBundles(raw) {
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const target of BUNDLE_TARGETS) {
      const b = normalizeBundle(raw[target]);
      if (b) out[target] = b;
    }
  }
  return out;
}

/**
 * What an app should do about a manifest.
 *   manifest      normalized (src/update/manifest.js), with .bundles
 *   target        'phone' | 'desktop'
 *   uiVersion     the UI that is running (bundled or downloaded)
 *   shellVersion  the installed native app
 *   canApplyBundles  this shell can load downloaded bundles and has a public key
 *
 * Returns { status: 'unknown'|'current'|'available'|'required', mode: 'bundle'|'installer'|null,
 *           bundle, reason }.
 *  - 'bundle': download the signed UI zip and restart; no reinstall.
 *  - 'installer': the release needs a newer native app (minNativeVersion), the bundle is
 *    unsigned, or this shell can't apply bundles: the full download/installer path.
 */
export function planUpdate({ manifest, target, uiVersion, shellVersion, canApplyBundles }) {
  if (!manifest) return { status: 'unknown', mode: null, bundle: null, reason: null };
  const newer = compareVersions(manifest.version, uiVersion) > 0;
  const belowMin = manifest.minVersion && compareVersions(shellVersion, manifest.minVersion) < 0;
  if (!newer && !belowMin) return { status: 'current', mode: null, bundle: null, reason: null };
  const bundle = manifest.bundles?.[target] || null;
  let reason = null;
  if (!canApplyBundles) reason = 'shell';
  else if (!bundle) reason = 'no-bundle';
  else if (!bundle.signature) reason = 'unsigned';
  else if (bundle.minNativeVersion && compareVersions(shellVersion, bundle.minNativeVersion) < 0) reason = 'native';
  else if (!newer) reason = 'native'; // the UI is current but the shell is below the minimum
  const status = belowMin ? 'required' : 'available';
  return reason
    ? { status, mode: 'installer', bundle: null, reason }
    : { status, mode: 'bundle', bundle, reason: null };
}

/** Short user-facing explanation for an installer-only update. */
export function installerReason(reason) {
  switch (reason) {
    case 'native':
      return 'This version changes the app itself, so it needs the full download.';
    case 'unsigned':
      return 'This release has no signed quick update, so it needs the full download.';
    case 'no-bundle':
      return 'This release has no quick update, so it needs the full download.';
    default:
      return null;
  }
}

/**
 * Update flow state machine, shared by the phone app and the web client.
 * States: idle → checking → current | available | error
 *         available → downloading → ready → applying
 *         downloading → failed → (retry) downloading
 */
export function updateReducer(state, event) {
  const s = state || { status: 'idle' };
  switch (event.type) {
    case 'check':
      return ['downloading', 'applying'].includes(s.status) ? s : { ...s, status: 'checking', error: null };
    case 'checked':
      if (['downloading', 'ready', 'applying'].includes(s.status) && event.plan?.status !== 'current') return s;
      return {
        ...s,
        status: event.plan?.status === 'current' ? 'current' : event.plan?.status === 'unknown' ? 'error' : 'available',
        plan: event.plan || null,
        manifest: event.manifest || null,
        checkedAt: event.at ?? s.checkedAt ?? null,
        error: event.plan?.status === 'unknown' ? event.error || 'No release information is reachable right now.' : null,
      };
    case 'check-failed':
      return ['downloading', 'ready', 'applying'].includes(s.status)
        ? s
        : { ...s, status: 'error', error: event.error || 'Could not check for updates.' };
    case 'download':
      return s.status === 'available' || s.status === 'failed' ? { ...s, status: 'downloading', percent: 0, error: null } : s;
    case 'progress':
      return s.status === 'downloading' ? { ...s, percent: Math.max(0, Math.min(100, event.percent || 0)) } : s;
    case 'downloaded':
      return s.status === 'downloading' ? { ...s, status: 'ready', percent: 100 } : s;
    case 'failed':
      return { ...s, status: 'failed', error: event.error || 'The update could not be installed.' };
    case 'apply':
      return s.status === 'ready' ? { ...s, status: 'applying' } : s;
    default:
      return s;
  }
}
