'use strict';

// A company signs in from one office IP: the per-IP limit must not lock out colleagues,
// while repeated attempts on one account are still cut off.
const express = require('express');
const cookieParser = require('cookie-parser');
const { createAuthLimiters } = require('../authRateLimits');

let server;
let base;

beforeAll(async () => {
  const { authLimiter, credentialLimiter, refreshLimiter } = createAuthLimiters({ NODE_ENV: 'production' });
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authLimiter, credentialLimiter, refreshLimiter);
  app.post('/api/auth/login', (req, res) => res.status(400).json({ message: 'Invalid credentials' }));
  app.post('/api/auth/refresh', (req, res) => res.json({ ok: true }));
  app.get('/api/auth/providers', (req, res) => res.json({}));
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((r) => server.close(r)));

const login = (email) => fetch(`${base}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'x' }),
});

test('fifty colleagues behind one IP can all sign in within a minute', async () => {
  for (let i = 0; i < 50; i++) {
    const providers = await fetch(`${base}/api/auth/providers`);
    expect(providers.status).toBe(200);
    const refresh = await fetch(`${base}/api/auth/refresh`, { method: 'POST', headers: { Cookie: `jwt=session-${i}` } });
    expect(refresh.status).toBe(200);
    const res = await login(`person${i}@northwind.test`);
    expect(res.status).toBe(400); // reached the handler, not 429
  }
});

test('one account is cut off after 10 attempts from the same IP', async () => {
  for (let i = 0; i < 10; i++) expect((await login('target@northwind.test')).status).toBe(400);
  const blocked = await login('target@northwind.test');
  expect(blocked.status).toBe(429);
  expect((await blocked.json()).message).toMatch(/too many attempts/i);
  // Other people are not affected.
  expect((await login('someone.else@northwind.test')).status).toBe(400);
});
