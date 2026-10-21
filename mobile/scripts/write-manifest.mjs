// Writes the update manifest the apps read (see src/update/manifest.js): the APK for Android,
// `downloads` with the desktop installers published in the same release, and `bundles`: the
// signed UI zips the apps install without a reinstall (src/update/bundle.js, docs/UPDATES.md).
// Usage: node scripts/write-manifest.mjs <apk> <out.json> [--notes notes.md] [--min 1.0.0] [--url https://…]
//                                         [--version x.y.z] [--android-only]
//                                         [--bundle phone=Oruinwan-UI-phone.zip] [--bundle desktop=…zip]
// Bundles are signed with ORUINWAN_UPDATE_SIGNING_KEY (Ed25519 private key: PKCS8 PEM, or the
// base64 32-byte seed). Without it they are listed unsigned, and apps refuse them and offer the
// full download instead. minNativeVersion per bundle comes from platform/native-shells.json.
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { BUNDLE_TARGETS, bundleMessage, parsePublicKey } from '../src/update/bundle.js';

const [apk, out, ...rest] = process.argv.slice(2);
if (!apk || !out) {
  console.error(
    'usage: write-manifest.mjs <apk> <out.json> [--notes file] [--min version] [--url apkUrl] [--android-only] [--bundle target=zip]',
  );
  process.exit(1);
}
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const all = (name) => rest.flatMap((v, i) => (rest[i - 1] === `--${name}` ? [v] : []));
const version = opt('version') || JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const repo = process.env.GITHUB_REPOSITORY || 'thrishankkuntimaddi/Oruniwan';
const tag = process.env.RELEASE_TAG || `v${version}`;
const asset = (name) => `https://github.com/${repo}/releases/download/${tag}/${name}`;
// Stable names (see .github/workflows/apps.yml), so releases/latest/download/<name> links never change.
const downloads = rest.includes('--android-only')
  ? undefined
  : {
      'mac-arm64': asset('Oruinwan-Mac-AppleSilicon.dmg'),
      'mac-x64': asset('Oruinwan-Mac-Intel.dmg'),
      'win-x64': asset('Oruinwan-Windows-Setup.exe'),
      'linux-appimage': asset('Oruinwan-Linux.AppImage'),
      'linux-deb': asset('Oruinwan-Linux.deb'),
    };

/** The signing key from the environment, or null. Accepts PKCS8 PEM or a base64 32-byte seed. */
function signingKey() {
  const raw = (process.env.ORUINWAN_UPDATE_SIGNING_KEY || '').trim();
  if (!raw) return null;
  if (raw.includes('BEGIN')) return createPrivateKey(raw);
  const seed = Buffer.from(raw.replace(/[^A-Za-z0-9+/=]/g, ''), 'base64');
  if (seed.length !== 32) throw new Error('ORUINWAN_UPDATE_SIGNING_KEY is neither a PEM key nor a 32-byte base64 seed');
  // PKCS8 DER for an Ed25519 seed: a fixed 16-byte prefix, then the seed.
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  return createPrivateKey({ key: Buffer.concat([prefix, seed]), format: 'der', type: 'pkcs8' });
}

const repoRoot = new URL('../../', import.meta.url);
const readOptional = (rel) => {
  try {
    return readFileSync(new URL(rel, repoRoot), 'utf8');
  } catch {
    return '';
  }
};

let bundles;
const bundleArgs = all('bundle');
if (bundleArgs.length) {
  const expectedPublic = parsePublicKey(process.env.ORUINWAN_UPDATE_PUBLIC_KEY || readOptional('platform/update-public-key.txt'));
  let nativeShells = {};
  try {
    nativeShells = JSON.parse(readOptional('platform/native-shells.json') || '{}');
  } catch {
    nativeShells = {};
  }
  const key = signingKey();
  if (key) {
    const pub = createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
    if (pub !== expectedPublic) {
      console.error(
        `ORUINWAN_UPDATE_SIGNING_KEY's public key (${pub}) is not the one the apps trust (platform/update-public-key.txt: ${expectedPublic || 'none'}).`,
      );
      process.exit(1);
    }
  } else {
    console.warn(
      'ORUINWAN_UPDATE_SIGNING_KEY is not set: UI bundles are published unsigned, and apps offer the full download instead.',
    );
  }
  bundles = {};
  for (const arg of bundleArgs) {
    const [target, file] = arg.split('=');
    if (!BUNDLE_TARGETS.includes(target) || !file) {
      console.error(`--bundle expects <${BUNDLE_TARGETS.join('|')}>=<zip>, got ${arg}`);
      process.exit(1);
    }
    const bytes = readFileSync(file);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    bundles[target] = {
      url: asset(basename(file)),
      sha256,
      size: bytes.length,
      signature: key ? sign(null, Buffer.from(bundleMessage(target, version, sha256)), key).toString('base64') : null,
      minNativeVersion: nativeShells[target] || null,
    };
  }
}

const apkBytes = readFileSync(apk);
const manifest = {
  version,
  apkUrl: opt('url') || asset('Oruinwan-Android.apk'),
  pageUrl: `https://github.com/${repo}/releases/tag/${tag}`,
  sha256: createHash('sha256').update(apkBytes).digest('hex'),
  size: apkBytes.length,
  notes: opt('notes') ? readFileSync(opt('notes'), 'utf8').trim() : '',
  minVersion: opt('min') || null,
  publishedAt: new Date().toISOString(),
  downloads,
  bundles,
};
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
const summary = bundles
  ? ` bundles=${Object.entries(bundles)
      .map(([t, b]) => `${t}${b.signature ? '(signed)' : '(unsigned)'}`)
      .join(',')}`
  : '';
console.log(`${out}: ${version} sha256=${manifest.sha256}${summary}`);
