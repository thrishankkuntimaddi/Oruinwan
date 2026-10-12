// @vitest-environment jsdom
import { normalizeServer, serverLabel } from '../appMode/env';
import { desktopDownload, isNewer } from '../appMode/UpdateNotice';
import { installAppNetwork } from '../appMode/network';

describe('server address', () => {
  test('adds a scheme and drops trailing slashes and /api', () => {
    expect(normalizeServer('chat.example.com')).toBe('https://chat.example.com');
    expect(normalizeServer(' https://chat.example.com/ ')).toBe('https://chat.example.com');
    expect(normalizeServer('https://example.com/oruinwan/api/')).toBe('https://example.com/oruinwan');
    expect(normalizeServer('localhost:8080')).toBe('http://localhost:8080');
    expect(normalizeServer('192.168.1.20:8080')).toBe('http://192.168.1.20:8080');
    expect(normalizeServer('ftp://example.com')).toBeNull();
    expect(normalizeServer('')).toBeNull();
    expect(serverLabel('https://chat.example.com:8443')).toBe('chat.example.com:8443');
  });
});

describe('update check', () => {
  test('compares versions', () => {
    expect(isNewer('1.2.0', '1.1.9')).toBe(true);
    expect(isNewer('v1.10.0', '1.9.0')).toBe(true);
    expect(isNewer('1.2.0', '1.2.0')).toBe(false);
    expect(isNewer('1.1.0', '1.2.0')).toBe(false);
  });

  test('offers the installer for this computer', () => {
    const m = { pageUrl: 'https://github.com/o/r/releases/tag/v1.2.0', downloads: { 'mac-arm64': 'https://x/arm.dmg', 'win-x64': 'https://x/setup.exe' } };
    expect(desktopDownload(m, { platform: 'darwin', arch: 'arm64' })).toBe('https://x/arm.dmg');
    expect(desktopDownload(m, { platform: 'win32', arch: 'x64' })).toBe('https://x/setup.exe');
    expect(desktopDownload(m, { platform: 'linux', arch: 'x64' })).toBe(m.pageUrl);
  });
});

describe('app network', () => {
  const calls = [];
  beforeAll(() => {
    window.fetch = async (url, init = {}) => {
      calls.push({ url: String(url), init });
      const path = new URL(url).pathname;
      const body = path === '/api/auth/login' ? { accessToken: 'a1', refreshToken: 'r1' }
        : path === '/api/auth/refresh' ? { accessToken: 'a2', refreshToken: 'r2' }
          : { ok: true };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    installAppNetwork('https://chat.example.com', 'desktop');
  });
  const flush = () => new Promise((r) => setTimeout(r, 0));

  test('identifies the app and keeps the refresh token from sign-in', async () => {
    await window.fetch('https://chat.example.com/api/auth/login', { method: 'POST', body: '{"email":"a"}' });
    await flush();
    const sent = calls.at(-1).init;
    expect(new Headers(sent.headers).get('x-client-platform')).toBe('desktop');
    expect(JSON.parse(sent.body)).toEqual({ email: 'a' }); // sign-in never carries a token
    expect(localStorage.getItem('oruinwan.refreshToken')).toBe('r1');
  });

  test('sends the token to refresh and stores the rotated one', async () => {
    await window.fetch('https://chat.example.com/api/auth/refresh', { method: 'POST' });
    await flush();
    expect(JSON.parse(calls.at(-1).init.body)).toEqual({ refreshToken: 'r1' });
    expect(localStorage.getItem('oruinwan.refreshToken')).toBe('r2');
  });

  test('leaves other hosts alone and forgets the token on logout', async () => {
    await window.fetch('https://elsewhere.example/api/auth/refresh', { method: 'POST' });
    expect(calls.at(-1).init).toEqual({ method: 'POST' }); // untouched: no header, no token
    await window.fetch('https://chat.example.com/api/auth/logout', { method: 'POST', body: '{}' });
    await flush();
    expect(JSON.parse(calls.at(-1).init.body)).toEqual({ refreshToken: 'r2' });
    expect(localStorage.getItem('oruinwan.refreshToken')).toBeNull();
  });
});
