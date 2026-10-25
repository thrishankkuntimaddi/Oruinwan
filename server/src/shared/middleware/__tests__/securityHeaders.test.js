'use strict';

const express = require('express');
const { securityHeaders } = require('../securityHeaders');

let server;
let base;
beforeAll((done) => {
  const a = express();
  a.use(securityHeaders());
  a.get('/', (req, res) => res.send('<!doctype html>'));
  server = a.listen(0, '127.0.0.1', () => {
    base = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});
afterAll((done) => {
  server.close(done);
});

const get = async () => {
  const res = await fetch(`${base}/`);
  return { headers: Object.fromEntries(res.headers.entries()) };
};

const policy = (res) => Object.fromEntries(
  res.headers['content-security-policy'].split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]),
);

test('the web app may call its API on another address and use live updates', async () => {
  const csp = policy(await get());
  expect(csp['connect-src']).toEqual(expect.arrayContaining(["'self'", 'https:', 'wss:']));
});

test('Google sign-in and decrypted images are allowed; inline scripts are not', async () => {
  const csp = policy(await get());
  // WebAssembly may compile (the phone interface's QR scanner); eval and inline scripts stay off.
  expect(csp['script-src']).toEqual(["'self'", "'wasm-unsafe-eval'", 'https://accounts.google.com']);
  expect(csp['img-src']).toEqual(expect.arrayContaining(['blob:', 'data:']));
  expect(csp['object-src']).toEqual(["'none'"]);
});

test("Google's sign-in pop-up can report back to the page", async () => {
  const res = await get();
  expect(res.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
});
