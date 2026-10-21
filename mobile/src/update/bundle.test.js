import { bundleMessage, normalizeBundles, parsePublicKey, planUpdate, updateReducer } from './bundle.js';
import { normalizeManifest } from './manifest.js';

const sha = 'a'.repeat(64);
const sig = `${'A'.repeat(86)}==`;
const manifest = (extra = {}) =>
  normalizeManifest({
    version: '2.2.0',
    bundles: {
      phone: { url: 'https://x/phone.zip', sha256: sha, size: 10, signature: sig, minNativeVersion: '2.1.0' },
      desktop: { url: 'https://x/desktop.zip', sha256: sha, signature: null },
      evil: { url: 'https://x/e.zip', sha256: sha },
    },
    ...extra,
  });

describe('UI bundles', () => {
  it('signs a message bound to target, version and hash', () => {
    expect(bundleMessage('phone', 'v2.1.0', 'ABC')).toBe('oruinwan-ui-bundle\nphone\n2.1.0\nabc');
  });

  it('reads the public key file', () => {
    expect(parsePublicKey('# comment\n\nd13eY7/alhIMPftiKwFTX33IBY1b97ToZXPmK24knzg=\n')).toBe(
      'd13eY7/alhIMPftiKwFTX33IBY1b97ToZXPmK24knzg=',
    );
    expect(parsePublicKey('# only comments')).toBe('');
    expect(parsePublicKey('short')).toBe('');
  });

  it('keeps only known, https, hashed bundles', () => {
    const b = normalizeBundles({
      phone: { url: 'http://x/p.zip', sha256: sha },
      desktop: { url: 'https://x/d.zip', sha256: sha, signature: 'bad' },
      evil: { url: 'https://x/e.zip', sha256: sha },
    });
    expect(Object.keys(b)).toEqual(['desktop']);
    expect(b.desktop.signature).toBeNull();
    expect(manifest().bundles.phone.minNativeVersion).toBe('2.1.0');
  });

  it('plans a bundle update when signed and the shell is new enough', () => {
    const plan = planUpdate({ manifest: manifest(), target: 'phone', uiVersion: '2.1.0', shellVersion: '2.1.0', canApplyBundles: true });
    expect(plan).toMatchObject({ status: 'available', mode: 'bundle' });
    expect(plan.bundle.url).toBe('https://x/phone.zip');
  });

  it('falls back to the installer', () => {
    const base = { manifest: manifest(), uiVersion: '2.1.0', shellVersion: '2.1.0', canApplyBundles: true };
    expect(planUpdate({ ...base, target: 'phone', shellVersion: '2.0.9' })).toMatchObject({ mode: 'installer', reason: 'native' });
    expect(planUpdate({ ...base, target: 'desktop' })).toMatchObject({ mode: 'installer', reason: 'unsigned' });
    expect(planUpdate({ ...base, target: 'phone', canApplyBundles: false })).toMatchObject({ mode: 'installer', reason: 'shell' });
    expect(planUpdate({ ...base, manifest: normalizeManifest({ version: '2.2.0' }), target: 'phone' })).toMatchObject({
      reason: 'no-bundle',
    });
  });

  it('is current when the running UI is up to date, required below minVersion', () => {
    const base = { target: 'phone', shellVersion: '2.1.0', canApplyBundles: true };
    expect(planUpdate({ ...base, manifest: manifest(), uiVersion: '2.2.0' }).status).toBe('current');
    expect(planUpdate({ ...base, manifest: manifest({ minVersion: '2.2.0' }), uiVersion: '2.1.0' }).status).toBe('required');
    // UI already downloaded, shell still too old: the installer.
    expect(planUpdate({ ...base, manifest: manifest({ minVersion: '2.2.0' }), uiVersion: '2.2.0' })).toMatchObject({
      status: 'required',
      mode: 'installer',
    });
    expect(planUpdate({ ...base, manifest: null }).status).toBe('unknown');
  });

  it('runs the update state machine', () => {
    let s = updateReducer(undefined, { type: 'check' });
    expect(s.status).toBe('checking');
    s = updateReducer(s, { type: 'checked', plan: { status: 'available', mode: 'bundle' }, at: 1 });
    expect(s.status).toBe('available');
    expect(updateReducer(s, { type: 'apply' }).status).toBe('available'); // nothing downloaded yet
    s = updateReducer(s, { type: 'download' });
    s = updateReducer(s, { type: 'progress', percent: 150 });
    expect(s.percent).toBe(100);
    // A background check doesn't interrupt a download.
    expect(updateReducer(s, { type: 'checked', plan: { status: 'available' } }).status).toBe('downloading');
    expect(updateReducer(s, { type: 'check' }).status).toBe('downloading');
    const failed = updateReducer(s, { type: 'failed', error: 'bad signature' });
    expect(failed).toMatchObject({ status: 'failed', error: 'bad signature' });
    expect(updateReducer(failed, { type: 'download' }).status).toBe('downloading');
    s = updateReducer(s, { type: 'downloaded' });
    expect(s.status).toBe('ready');
    s = updateReducer(s, { type: 'apply' });
    expect(s.status).toBe('applying');
    expect(updateReducer({ status: 'checking' }, { type: 'checked', plan: { status: 'unknown' } }).status).toBe('error');
    expect(updateReducer({ status: 'checking' }, { type: 'checked', plan: { status: 'current' } }).status).toBe('current');
  });
});
