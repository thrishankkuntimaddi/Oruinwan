// latest.json from the newest GitHub release (written by mobile/scripts/write-manifest.mjs;
// same rules as mobile/src/update/manifest.js).
import { compareVersions, parseVersion } from './version.js';
import { normalizeBundles } from './bundle.js';

export const REPO_URL = 'https://github.com/thrishankkuntimaddi/Oruinwan';
export const RELEASES_URL = `${REPO_URL}/releases/latest`;
export const MANIFEST_URL = `${REPO_URL}/releases/latest/download/latest.json`;

const httpsUrl = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null);

export function normalizeManifest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const version = String(raw.version || '').replace(/^v/i, '');
  if (!parseVersion(version)) return null;
  const downloads = {};
  if (raw.downloads && typeof raw.downloads === 'object') {
    for (const [key, url] of Object.entries(raw.downloads)) if (httpsUrl(url)) downloads[key] = url;
  }
  return {
    version,
    apkUrl: httpsUrl(raw.apkUrl),
    sha256: typeof raw.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(raw.sha256) ? raw.sha256.toLowerCase() : null,
    minVersion: parseVersion(raw.minVersion) ? String(raw.minVersion).replace(/^v/i, '') : null,
    notes: typeof raw.notes === 'string' ? raw.notes.trim() : '',
    publishedAt: raw.publishedAt || null,
    pageUrl: httpsUrl(raw.pageUrl),
    downloads,
    bundles: normalizeBundles(raw.bundles),
  };
}

/** True when `candidate` is a newer version than `current`. */
export const isNewer = (candidate, current) => compareVersions(candidate, current) > 0;

/** The installer for this computer, or the release page. */
export function desktopDownload(manifest, { platform, arch } = {}) {
  const d = (manifest && manifest.downloads) || {};
  const key = platform === 'darwin' ? (arch === 'arm64' ? 'mac-arm64' : 'mac-x64') : platform === 'win32' ? 'win-x64' : null;
  const url = (key && d[key]) || manifest?.pageUrl;
  return typeof url === 'string' && url.startsWith('https://') ? url : RELEASES_URL;
}

/** The first lines of the release notes, for a short "What's new". */
export function notesExcerpt(notes, maxLines = 6) {
  const lines = String(notes || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .filter(Boolean);
  const out = lines.slice(0, maxLines);
  return { lines: out, more: lines.length > out.length };
}
