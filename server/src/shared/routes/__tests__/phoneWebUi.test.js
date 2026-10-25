'use strict';

const { phoneRedirect } = require('../phoneWebUi');

const PIXEL = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

const page = (reqPath, { ua = PIXEL, query = {}, cookies = '', accept = 'text/html,application/xhtml+xml', method = 'GET' } = {}) =>
  phoneRedirect({ method, path: reqPath, query, headers: { 'user-agent': ua, accept }, cookies });

test('phones get the phone app, and the page they asked for travels along', () => {
  expect(page('/')).toBe('/m/');
  expect(page('/', { ua: IPHONE })).toBe('/m/');
  expect(page('/join-workspace', { query: { token: 'abc' } })).toBe(`/m/?open=${encodeURIComponent('/join-workspace?token=abc')}`);
  expect(page('/workspace/w1/channel/c1', { query: { message: 'm1' } })).toBe(`/m/?open=${encodeURIComponent('/workspace/w1/channel/c1?message=m1')}`);
  expect(page('/open/notifications')).toBe(`/m/?open=${encodeURIComponent('/open/notifications')}`);
});

test('computers and tablets keep the web app', () => {
  expect(page('/', { ua: MAC })).toBeNull();
  expect(page('/', { ua: ANDROID_TABLET })).toBeNull();
});

test('account pages that finish in the browser stay on the web', () => {
  for (const p of ['/verify-email', '/reset-password', '/accept-invite', '/oauth-success', '/forgot-password']) {
    expect(page(p, { query: { token: 't' } })).toBeNull();
  }
});

test('"Use the full website" is remembered; ?web=0 goes back to the phone app', () => {
  expect(page('/', { query: { web: '1' } })).toBeNull();
  expect(page('/', { cookies: 'a=b; oru_web=1' })).toBeNull();
  expect(page('/', { cookies: 'oru_web=1', query: { web: '0' } })).toBe('/m/');
});

test('files, the API and the phone app itself are never redirected', () => {
  for (const p of ['/api/health', '/socket.io/', '/assets/index.js', '/m/', '/m/assets/a.js', '/favicon.ico', '/.well-known/assetlinks.json']) {
    expect(page(p)).toBeNull();
  }
  expect(page('/', { accept: 'application/json' })).toBeNull();
  expect(page('/', { method: 'POST' })).toBeNull();
});
