'use strict';

/**
 * Over-the-air UI updates for the desktop app (docs/UPDATES.md).
 *
 * Each release publishes the web client built for the desktop app as a zip, listed in
 * latest.json with its SHA-256 and an Ed25519 signature. The page asks the main process to
 * install it; the main process checks the size, SHA-256 and signature itself (with the public
 * key shipped in the app), unpacks it under userData/ui-bundles and, on "Update and restart",
 * starts from it. The app:// scheme then serves that folder instead of the bundled app/.
 *
 * Boot watchdog: a new bundle is "pending" until the page confirms it started. If it fails to
 * load, crashes, or doesn't confirm within the watchdog time, the app goes back to the last good
 * UI (or the bundled one) and never applies that version again. Installing a new full version
 * of the app (a newer shell) forgets downloaded bundles, since the installer carries newer UI.
 *
 * No Electron imports here, so it is testable with node --test.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { extractZip } = require('./unzip');

const STATE_FILE = 'ui-bundle.json';
const BUNDLES_DIR = 'ui-bundles';
const MAX_BUNDLE_BYTES = 150 * 1024 * 1024;
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function parseVersion(v) {
  const m = String(v == null ? '' : v).trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Negative when a < b, 0 when equal, positive when a > b. Unparseable versions sort first. */
function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return (pa ? 1 : 0) - (pb ? 1 : 0);
  for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** Same rule as mobile/src/update/bundle.js#parsePublicKey. */
function parsePublicKey(text) {
  const line = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'));
  return line && /^[A-Za-z0-9+/]{43}=$/.test(line) ? line : '';
}

/** Same message as mobile/src/update/bundle.js#bundleMessage. */
function bundleMessage(target, version, sha256) {
  return `oruinwan-ui-bundle\n${target}\n${String(version).replace(/^v/i, '')}\n${String(sha256).toLowerCase()}`;
}

/** The public key the app trusts: the env override, then the copy bundled next to this file, then the repo's. */
function loadPublicKey(dir = __dirname, env = process.env) {
  if (env.ORUINWAN_UPDATE_PUBLIC_KEY) return parsePublicKey(env.ORUINWAN_UPDATE_PUBLIC_KEY);
  for (const file of [path.join(dir, 'update-public-key.txt'), path.join(dir, '..', '..', 'platform', 'update-public-key.txt')]) {
    try {
      const key = parsePublicKey(fs.readFileSync(file, 'utf8'));
      if (key) return key;
    } catch {
      /* next */
    }
  }
  return '';
}

function verifySignature(publicKeyB64, message, signatureB64) {
  try {
    const raw = Buffer.from(publicKeyB64, 'base64');
    const sig = Buffer.from(String(signatureB64 || ''), 'base64');
    if (raw.length !== 32 || sig.length !== 64) return false;
    const key = crypto.createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, raw]), format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(message), key, sig);
  } catch {
    return false;
  }
}

/**
 * Checks a downloaded bundle. Throws an Error with a user-facing message and a `code`
 * ('SIZE' | 'CHECKSUM' | 'SIGNATURE' | 'NO_KEY') when it must not be installed.
 */
function verifyBundle(bytes, { target, version, sha256, signature, publicKey }) {
  const fail = (code, message) => Object.assign(new Error(message), { code });
  if (!publicKey) throw fail('NO_KEY', "This app has no update key, so it can't install quick updates.");
  if (!bytes || bytes.length === 0 || bytes.length > MAX_BUNDLE_BYTES) throw fail('SIZE', 'The update has an unexpected size.');
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (!/^[a-f0-9]{64}$/i.test(String(sha256)) || actual !== String(sha256).toLowerCase()) {
    throw fail('CHECKSUM', 'The download was damaged or changed, so it was not installed.');
  }
  if (!verifySignature(publicKey, bundleMessage(target, version, actual), signature)) {
    throw fail('SIGNATURE', "This update isn't signed by Oruinwan, so it was not installed.");
  }
  return actual;
}

// ─── State ────────────────────────────────────────────────────────────────────

function createStore(userData) {
  const file = path.join(userData, STATE_FILE);
  const bundlesDir = path.join(userData, BUNDLES_DIR);
  const read = () => {
    try {
      const s = JSON.parse(fs.readFileSync(file, 'utf8'));
      return s && typeof s === 'object' ? s : {};
    } catch {
      return {};
    }
  };
  const write = (s) => {
    try {
      fs.mkdirSync(userData, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(s, null, 2));
    } catch (err) {
      console.warn('[updates] could not save state:', err.message);
    }
  };
  /** Only folders inside ui-bundles/ with an index.html count. */
  const valid = (entry) => {
    if (!entry || typeof entry.dir !== 'string') return false;
    const dir = path.resolve(entry.dir);
    return dir.startsWith(path.resolve(bundlesDir) + path.sep) && fs.existsSync(path.join(dir, 'index.html'));
  };
  const remove = (dir) => {
    if (!dir) return;
    const resolved = path.resolve(dir);
    if (!resolved.startsWith(path.resolve(bundlesDir) + path.sep)) return;
    fs.rmSync(resolved, { recursive: true, force: true });
  };
  /** Deletes every bundle folder except the ones in `keep`. */
  const prune = (keep) => {
    const keepSet = new Set(keep.filter(Boolean).map((d) => path.resolve(d)));
    let names = [];
    try {
      names = fs.readdirSync(bundlesDir);
    } catch {
      return;
    }
    for (const name of names) {
      const dir = path.resolve(bundlesDir, name);
      if (!keepSet.has(dir)) fs.rmSync(dir, { recursive: true, force: true });
    }
  };
  return { file, bundlesDir, read, write, valid, remove, prune };
}

/**
 * Which UI to load at start: { dir, version, source: 'bundled'|'downloaded', pending }.
 * Runs the boot guard: a pending bundle gets two starts to confirm, then is rolled back.
 */
function chooseAppDir({ userData, bundledDir, shellVersion }) {
  const store = createStore(userData);
  let s = store.read();
  const bundled = { dir: bundledDir, version: shellVersion, source: 'bundled', pending: false };
  if (s.shell !== shellVersion) {
    // A different installed app: its own UI is the right one.
    store.prune([]);
    store.write({ shell: shellVersion, bad: [] });
    return bundled;
  }
  s.bad = Array.isArray(s.bad) ? s.bad : [];
  if (s.pending) {
    if (!store.valid(s.pending) || (s.pending.boots || 0) >= 2) {
      s = rollbackState(store, s);
    } else {
      s.pending.boots = (s.pending.boots || 0) + 1;
      store.write(s);
      return { dir: path.resolve(s.pending.dir), version: s.pending.version, source: 'downloaded', pending: true };
    }
  }
  if (s.active && store.valid(s.active) && compareVersions(s.active.version, shellVersion) > 0) {
    return { dir: path.resolve(s.active.dir), version: s.active.version, source: 'downloaded', pending: false };
  }
  return bundled;
}

function rollbackState(store, s) {
  const next = { ...s, bad: [...new Set([...(s.bad || []), s.pending && s.pending.version].filter(Boolean))] };
  if (s.pending) store.remove(s.pending.dir);
  delete next.pending;
  store.write(next);
  return next;
}

/** The pending bundle failed: forget it. Returns the UI to load now (as chooseAppDir would). */
function rollback({ userData, bundledDir, shellVersion }) {
  const store = createStore(userData);
  const s = store.read();
  if (s.pending) rollbackState(store, s);
  return chooseAppDir({ userData, bundledDir, shellVersion });
}

/** The running bundle started: it becomes the last good one, older bundles are deleted. */
function confirm({ userData }) {
  const store = createStore(userData);
  const s = store.read();
  if (!s.pending) return false;
  s.active = { version: s.pending.version, dir: s.pending.dir };
  delete s.pending;
  store.write(s);
  store.prune([s.active.dir, s.staged && s.staged.dir]);
  return true;
}

/** Back to the UI that came with the app. */
function reset({ userData, shellVersion }) {
  const store = createStore(userData);
  store.prune([]);
  store.write({ shell: shellVersion, bad: store.read().bad || [] });
}

/**
 * Verifies and unpacks a downloaded bundle and stages it for the next start.
 * `bundle` is the manifest entry: { version, sha256, signature, minNativeVersion }.
 */
function stageBundle({ userData, shellVersion, bytes, bundle, publicKey, target = 'desktop' }) {
  const fail = (code, message) => Object.assign(new Error(message), { code });
  const version = String(bundle.version || '').replace(/^v/i, '');
  if (!parseVersion(version)) throw fail('INVALID', 'The update has no valid version.');
  if (bundle.minNativeVersion && compareVersions(shellVersion, bundle.minNativeVersion) < 0) {
    throw fail('NATIVE', 'This update needs a newer version of the app. Download the full installer.');
  }
  const store = createStore(userData);
  const s = store.read();
  if ((s.bad || []).includes(version)) {
    throw fail('BAD_VERSION', "This update didn't start on this computer before, so it won't be installed again.");
  }
  verifyBundle(bytes, { target, version, sha256: bundle.sha256, signature: bundle.signature, publicKey });
  const dir = path.join(store.bundlesDir, `${version}-${crypto.randomBytes(4).toString('hex')}`);
  try {
    extractZip(bytes, dir);
    if (!fs.existsSync(path.join(dir, 'index.html'))) throw fail('INVALID', 'The update is incomplete.');
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw err.code ? err : fail('INVALID', `The update could not be unpacked: ${err.message}`);
  }
  if (s.staged && s.staged.dir !== dir) store.remove(s.staged.dir);
  store.write({ ...s, shell: shellVersion, staged: { version, dir } });
  return { version, dir };
}

/** Makes the staged bundle pending, so the next start loads it. False when nothing is staged. */
function applyStaged({ userData }) {
  const store = createStore(userData);
  const s = store.read();
  if (!s.staged || !store.valid(s.staged)) return false;
  if (s.pending && s.pending.dir !== s.staged.dir) store.remove(s.pending.dir);
  s.pending = { version: s.staged.version, dir: s.staged.dir, boots: 0 };
  delete s.staged;
  store.write(s);
  return true;
}

function stagedVersion({ userData }) {
  const store = createStore(userData);
  const s = store.read();
  return s.staged && store.valid(s.staged) ? s.staged.version : null;
}

module.exports = {
  applyStaged,
  bundleMessage,
  chooseAppDir,
  compareVersions,
  confirm,
  loadPublicKey,
  parsePublicKey,
  reset,
  rollback,
  stageBundle,
  stagedVersion,
  verifyBundle,
  verifySignature,
  MAX_BUNDLE_BYTES,
};
