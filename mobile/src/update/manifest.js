// Pure helpers for the update manifest, kept separate so they are easy to test.
//
// Manifest shape (latest.json on a release, or Remote Config "android_release"):
//   { "version": "1.1.0", "apkUrl": "https://…/Oruinwan-Android.apk", "sha256": "<hex>",
//     "notes": "What changed", "minVersion": "1.0.0", "publishedAt": "2026-10-10T…Z" }
import { compareVersions, parseVersion } from '../lib/version.js';

export function normalizeManifest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const version = String(raw.version || '').replace(/^v/i, '');
  if (!parseVersion(version)) return null;
  const apkUrl = typeof raw.apkUrl === 'string' && /^https?:\/\//.test(raw.apkUrl) ? raw.apkUrl : null;
  const sha256 = typeof raw.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(raw.sha256) ? raw.sha256.toLowerCase() : null;
  const minVersion = parseVersion(raw.minVersion) ? String(raw.minVersion).replace(/^v/i, '') : null;
  return {
    version,
    apkUrl,
    sha256,
    minVersion,
    notes: typeof raw.notes === 'string' ? raw.notes.trim() : '',
    publishedAt: raw.publishedAt || null,
    pageUrl: typeof raw.pageUrl === 'string' ? raw.pageUrl : null,
  };
}

/**
 * Decide what the app should do.
 *  - 'required'  current is below minVersion: the app blocks until updated
 *  - 'available' a newer version exists
 *  - 'current'   nothing to do
 */
export function evaluate(manifest, currentVersion, skippedVersion = null) {
  if (!manifest) return { status: 'unknown' };
  if (manifest.minVersion && compareVersions(currentVersion, manifest.minVersion) < 0) {
    return { status: 'required', manifest };
  }
  if (compareVersions(manifest.version, currentVersion) > 0) {
    return { status: 'available', manifest, skipped: skippedVersion === manifest.version };
  }
  return { status: 'current', manifest };
}

/** Prefer whichever source advertises the higher version. */
export function pickNewest(...manifests) {
  return manifests
    .filter(Boolean)
    .reduce((best, m) => (!best || compareVersions(m.version, best.version) > 0 ? m : best), null);
}
