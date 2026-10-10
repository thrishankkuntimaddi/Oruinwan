import { evaluate, normalizeManifest, pickNewest } from './manifest.js';

const sha = 'a'.repeat(64);

describe('update manifest', () => {
  it('rejects malformed manifests', () => {
    expect(normalizeManifest(null)).toBeNull();
    expect(normalizeManifest({ version: 'latest' })).toBeNull();
  });

  it('keeps only safe fields', () => {
    const m = normalizeManifest({ version: 'v1.1.0', apkUrl: 'javascript:alert(1)', sha256: 'nothex', minVersion: 'x' });
    expect(m).toMatchObject({ version: '1.1.0', apkUrl: null, sha256: null, minVersion: null });
  });

  it('offers newer versions and blocks below the minimum', () => {
    const m = normalizeManifest({ version: '1.2.0', apkUrl: 'https://x/a.apk', sha256: sha, minVersion: '1.1.0' });
    expect(evaluate(m, '1.1.5').status).toBe('available');
    expect(evaluate(m, '1.0.9').status).toBe('required');
    expect(evaluate(m, '1.2.0').status).toBe('current');
    expect(evaluate(null, '1.0.0').status).toBe('unknown');
  });

  it('remembers a skipped version', () => {
    const m = normalizeManifest({ version: '1.2.0' });
    expect(evaluate(m, '1.0.0', '1.2.0').skipped).toBe(true);
  });

  it('prefers the newest source', () => {
    const a = normalizeManifest({ version: '1.1.0' });
    const b = normalizeManifest({ version: '1.3.0' });
    expect(pickNewest(a, null, b).version).toBe('1.3.0');
    expect(pickNewest(null, null)).toBeNull();
  });
});
