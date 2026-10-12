import { desktopDownload, evaluate, normalizeManifest, pickNewest } from './manifest.js';

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

  it('keeps only https desktop downloads', () => {
    const m = normalizeManifest({
      version: '1.1.0',
      pageUrl: 'https://github.com/o/r/releases/tag/v1.1.0',
      downloads: { 'mac-arm64': 'https://x/m.dmg', 'win-x64': 'http://x/w.exe', 'linux-deb': 'javascript:alert(1)' },
    });
    expect(m.downloads).toEqual({ 'mac-arm64': 'https://x/m.dmg' });
  });

  it('picks the installer for this computer', () => {
    const m = normalizeManifest({
      version: '1.1.0',
      pageUrl: 'https://github.com/o/r/releases/tag/v1.1.0',
      downloads: { 'mac-arm64': 'https://x/arm.dmg', 'mac-x64': 'https://x/intel.dmg', 'win-x64': 'https://x/setup.exe' },
    });
    expect(desktopDownload(m, { platform: 'darwin', arch: 'arm64' })).toBe('https://x/arm.dmg');
    expect(desktopDownload(m, { platform: 'darwin', arch: 'x64' })).toBe('https://x/intel.dmg');
    expect(desktopDownload(m, { platform: 'win32', arch: 'x64' })).toBe('https://x/setup.exe');
    expect(desktopDownload(m, { platform: 'linux', arch: 'x64' })).toBe('https://github.com/o/r/releases/tag/v1.1.0');
    expect(desktopDownload(normalizeManifest({ version: '1.1.0' }), { platform: 'win32', arch: 'x64' })).toBeNull();
  });
});
