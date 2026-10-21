// @vitest-environment jsdom
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createUpdater, detectKind, actionLabel, hasUpdate, updateTitle } from '../appMode/updates/store';
import { normalizeManifest, notesExcerpt, desktopDownload } from '../appMode/updates/manifest';

const sha = 'b'.repeat(64);
const sig = `${'A'.repeat(86)}==`;
const latest = (extra = {}) => ({
  version: '2.2.0',
  notes: '## What changed\n- Faster chat\n- Fixes',
  pageUrl: 'https://github.com/o/r/releases/tag/v2.2.0',
  downloads: { 'mac-arm64': 'https://x/arm.dmg', 'win-x64': 'https://x/setup.exe' },
  bundles: { desktop: { url: 'https://x/Oruinwan-UI-desktop.zip', sha256: sha, size: 5, signature: sig, minNativeVersion: '2.1.0' } },
  ...extra,
});
const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

function fakeDesktop({ shellVersion = '2.1.0', canApplyBundles = true, staged = null, downloadResult = { ok: true, version: '2.2.0' } } = {}) {
  const calls = [];
  let progress = null;
  return {
    calls,
    platform: 'darwin',
    arch: 'arm64',
    version: shellVersion,
    openExternal: (url) => calls.push(['open', url]),
    updates: {
      info: () => Promise.resolve({ shellVersion, uiVersion: shellVersion, source: 'bundled', canApplyBundles, staged }),
      download: (b) => {
        calls.push(['download', b]);
        progress?.({ state: 'downloading', percent: 50 });
        return Promise.resolve(downloadResult);
      },
      apply: () => {
        calls.push(['apply']);
        return Promise.resolve({ ok: true });
      },
      reset: () => Promise.resolve({ ok: true }),
      confirmStarted: () => calls.push(['confirm']),
      onProgress: (cb) => {
        progress = cb;
        return () => {
          progress = null;
        };
      },
    },
  };
}

const make = (overrides) =>
  createUpdater({
    kind: 'desktop',
    fetch: () => respond(latest()),
    desktop: fakeDesktop(),
    reload: vi.fn(),
    openUrl: vi.fn(),
    uiVersion: '2.1.0',
    buildId: 'b1',
    now: () => 1000,
    ...overrides,
  });

describe('updates: desktop', () => {
  test('a signed bundle installs and restarts in one click', async () => {
    const desktop = fakeDesktop();
    const u = make({ desktop });
    await u.check();
    const s = u.getState();
    expect(s).toMatchObject({ status: 'available', shellVersion: '2.1.0' });
    expect(s.plan.mode).toBe('bundle');
    expect(updateTitle(s)).toBe('Oruinwan 2.2.0 is available');
    expect(actionLabel(s)).toBe('Update and restart');
    expect(await u.install()).toMatchObject({ ok: true, via: 'bundle' });
    expect(desktop.calls.map((c) => c[0])).toEqual(['download', 'apply']);
    expect(desktop.calls[0][1]).toMatchObject({ url: 'https://x/Oruinwan-UI-desktop.zip', version: '2.2.0', sha256: sha, signature: sig });
    expect(u.getState().status).toBe('applying');
  });

  test('a refused bundle shows the error and can be retried', async () => {
    const desktop = fakeDesktop({ downloadResult: { error: "This update isn't signed by Oruinwan, so it was not installed.", code: 'SIGNATURE' } });
    const u = make({ desktop });
    await u.check();
    expect((await u.install()).ok).toBe(false);
    expect(u.getState()).toMatchObject({ status: 'failed', error: expect.stringMatching(/signed/) });
    expect(actionLabel(u.getState())).toBe('Try again');
    expect(desktop.calls.map((c) => c[0])).toEqual(['download']);
  });

  test('already downloaded: ready to restart', async () => {
    const desktop = fakeDesktop({ staged: '2.2.0' });
    const u = make({ desktop });
    await u.check();
    expect(u.getState().status).toBe('ready');
    await u.install();
    expect(desktop.calls.map((c) => c[0])).toEqual(['apply']);
  });

  test('older app or native change → the installer for this computer', async () => {
    const openUrl = vi.fn();
    const old = fakeDesktop({ shellVersion: '2.0.1' });
    const u = make({ desktop: old, openUrl });
    await u.check();
    expect(u.getState().plan).toMatchObject({ mode: 'installer', reason: 'native' });
    expect(actionLabel(u.getState())).toBe('Download installer');
    await u.install();
    expect(openUrl).toHaveBeenCalledWith('https://x/arm.dmg');

    // A shell without the quick-update bridge at all.
    const bare = { ...fakeDesktop(), updates: undefined };
    const u2 = make({ desktop: bare });
    await u2.check();
    expect(u2.getState().plan).toMatchObject({ mode: 'installer', reason: 'shell' });
  });

  test('up to date, offline', async () => {
    const u = make({ fetch: () => respond(latest({ version: '2.1.0' })) });
    await u.check();
    expect(u.getState().status).toBe('current');
    expect(hasUpdate(u.getState())).toBe(false);
    const off = make({ fetch: () => Promise.reject(new Error('offline')) });
    await off.check();
    expect(off.getState()).toMatchObject({ status: 'error', error: expect.stringMatching(/GitHub/) });
  });

  test('start confirms the running UI (boot watchdog)', () => {
    vi.useFakeTimers();
    const desktop = fakeDesktop();
    const u = make({ desktop });
    const stop = u.start();
    expect(desktop.calls).toContainEqual(['confirm']);
    stop();
    vi.useRealTimers();
  });

  test('dismiss hides the notice for that version', async () => {
    const u = make();
    await u.check();
    u.dismiss();
    expect(u.getState().dismissed).toBe('2.2.0');
  });
});

describe('updates: browser', () => {
  test('a newer deployed build offers Reload', async () => {
    const reload = vi.fn();
    const u = make({ kind: 'web', desktop: null, reload, fetch: (url) => (url.startsWith('/version.json') ? respond({ version: '2.2.0', build: 'b2' }) : null) });
    await u.check();
    expect(u.getState().status).toBe('available');
    expect(actionLabel(u.getState())).toBe('Reload');
    await u.install();
    expect(reload).toHaveBeenCalled();
  });

  test('the same build is current', async () => {
    const u = make({ kind: 'web', desktop: null, fetch: () => respond({ version: '2.2.0', build: 'b1' }) });
    await u.check();
    expect(u.getState().status).toBe('current');
  });

  test('platform detection', () => {
    expect(detectKind({ win: { oruinwanDesktop: {} } })).toBe('desktop');
    expect(detectKind({ win: {}, isSite: true })).toBe('none');
    expect(detectKind({ win: {} })).toBe('web');
    expect(detectKind({ win: { Capacitor: { getPlatform: () => 'ios' } }, isApp: true })).toBe('none');
    expect(detectKind({ win: { Capacitor: { getPlatform: () => 'android', isPluginAvailable: () => true } }, isApp: true })).toBe('android');
  });
});

describe('updates: manifest helpers', () => {
  test('normalizes bundles and notes', () => {
    const m = normalizeManifest(latest());
    expect(m.bundles.desktop.minNativeVersion).toBe('2.1.0');
    expect(notesExcerpt(m.notes).lines).toEqual(['What changed', '- Faster chat', '- Fixes']);
    expect(desktopDownload(m, { platform: 'linux' })).toBe(m.pageUrl);
  });

  test('the copied update logic matches the phone app', () => {
    const root = path.resolve(__dirname, '../../..');
    const pairs = [
      ['mobile/src/update/bundle.js', 'client/src/appMode/updates/bundle.js'],
      ['mobile/src/lib/version.js', 'client/src/appMode/updates/version.js'],
    ];
    for (const [a, b] of pairs) {
      if (!existsSync(path.join(root, a))) continue;
      const strip = (t) => t.split('\n').filter((l) => !l.startsWith('//') && !l.startsWith('import ')).join('\n').trim();
      expect(strip(readFileSync(path.join(root, b), 'utf8'))).toBe(strip(readFileSync(path.join(root, a), 'utf8')));
    }
  });
});
