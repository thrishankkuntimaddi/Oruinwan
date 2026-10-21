// @vitest-environment node
// Runs scripts/write-manifest.mjs the way the release workflow does and checks that the apps
// accept what it writes: signed bundles verify with the matching public key.
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleMessage, planUpdate } from './bundle.js';
import { verifyEd25519 } from './ed25519.js';
import { normalizeManifest } from './manifest.js';

const script = fileURLToPath(new URL('../../scripts/write-manifest.mjs', import.meta.url));
let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'oruinwan-manifest-'));
  writeFileSync(join(dir, 'app.apk'), 'apk');
  writeFileSync(join(dir, 'Oruinwan-UI-phone.zip'), 'phone zip');
  writeFileSync(join(dir, 'Oruinwan-UI-desktop.zip'), 'desktop zip');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(env) {
  const out = join(dir, 'latest.json');
  execFileSync(
    process.execPath,
    [script, join(dir, 'app.apk'), out, '--version', '9.1.0', '--bundle', `phone=${join(dir, 'Oruinwan-UI-phone.zip')}`, '--bundle', `desktop=${join(dir, 'Oruinwan-UI-desktop.zip')}`],
    { env: { PATH: process.env.PATH, RELEASE_TAG: 'v9.1.0', ...env }, stdio: 'pipe' },
  );
  return JSON.parse(readFileSync(out, 'utf8'));
}

describe('write-manifest.mjs', () => {
  it('signs bundles with the release key', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const pub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
    const raw = run({
      ORUINWAN_UPDATE_SIGNING_KEY: privateKey.export({ format: 'pem', type: 'pkcs8' }),
      ORUINWAN_UPDATE_PUBLIC_KEY: pub,
    });
    expect(raw.bundles.phone.url).toBe('https://github.com/thrishankkuntimaddi/Oruniwan/releases/download/v9.1.0/Oruinwan-UI-phone.zip');
    const m = normalizeManifest(raw);
    for (const target of ['phone', 'desktop']) {
      const b = m.bundles[target];
      expect(b.signature).toBeTruthy();
      expect(await verifyEd25519(pub, bundleMessage(target, '9.1.0', b.sha256), b.signature)).toBe(true);
      // Not valid for the other app.
      expect(await verifyEd25519(pub, bundleMessage(target === 'phone' ? 'desktop' : 'phone', '9.1.0', b.sha256), b.signature)).toBe(false);
    }
    expect(planUpdate({ manifest: m, target: 'phone', uiVersion: '9.0.0', shellVersion: '9.0.0', canApplyBundles: true }).mode).toBe('bundle');
  });

  it('accepts a base64 seed', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('base64');
    const pub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
    expect(run({ ORUINWAN_UPDATE_SIGNING_KEY: seed, ORUINWAN_UPDATE_PUBLIC_KEY: pub }).bundles.desktop.signature).toBeTruthy();
  });

  it('publishes unsigned bundles without a key, which apps refuse', () => {
    const m = normalizeManifest(run({}));
    expect(m.bundles.phone.signature).toBeNull();
    expect(planUpdate({ manifest: m, target: 'phone', uiVersion: '9.0.0', shellVersion: '9.0.0', canApplyBundles: true })).toMatchObject({
      mode: 'installer',
      reason: 'unsigned',
    });
  });

  it('refuses a key the apps do not trust', () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    const other = generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
    expect(() => run({ ORUINWAN_UPDATE_SIGNING_KEY: privateKey.export({ format: 'pem', type: 'pkcs8' }), ORUINWAN_UPDATE_PUBLIC_KEY: other })).toThrow();
  });
});
