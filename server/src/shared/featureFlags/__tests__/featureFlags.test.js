'use strict';

const express = require('express');
const http = require('http');
const { FLAG_NAMES, getFlags, isEnabled, requireFlag } = require('../index');
const flagsRouter = require('../routes');

function request(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      http.get({ port, path }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        });
      }).on('error', (err) => { server.close(); reject(err); });
    });
  });
}

describe('feature flags', () => {
  const original = process.env.FEATURES_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.FEATURES_ENABLED;
    else process.env.FEATURES_ENABLED = original;
  });

  test('every flag is off by default', () => {
    const flags = getFlags({});
    expect(Object.keys(flags).sort()).toEqual([...FLAG_NAMES].sort());
    expect(Object.values(flags).every((v) => v === false)).toBe(true);
  });

  test('FEATURES_ENABLED turns on listed flags, ignoring case, spaces and unknown names', () => {
    const flags = getFlags({ FEATURES_ENABLED: ' Billing , nope,sso ' });
    expect(flags.billing).toBe(true);
    expect(flags.sso).toBe(true);
    expect(flags.integrations).toBe(false);
    expect(flags).not.toHaveProperty('nope');
  });

  test('"all" enables every flag', () => {
    expect(Object.values(getFlags({ FEATURES_ENABLED: 'all' })).every(Boolean)).toBe(true);
  });

  test('unknown flag names throw so typos fail loudly', () => {
    expect(() => isEnabled('biling', {})).toThrow(/Unknown feature flag/);
    expect(() => requireFlag('biling')).toThrow(/Unknown feature flag/);
  });

  test('requireFlag returns 404 FEATURE_DISABLED while off and passes through when on', async () => {
    const app = express();
    app.get('/x', requireFlag('billing'), (req, res) => res.json({ ok: true }));

    delete process.env.FEATURES_ENABLED;
    const off = await request(app, '/x');
    expect(off.status).toBe(404);
    expect(off.body.code).toBe('FEATURE_DISABLED');

    process.env.FEATURES_ENABLED = 'billing';
    const on = await request(app, '/x');
    expect(on.status).toBe(200);
    expect(on.body).toEqual({ ok: true });
  });

  test('GET /api/flags returns the resolved map', async () => {
    const app = express();
    app.use('/api/flags', flagsRouter);
    process.env.FEATURES_ENABLED = 'community';
    const res = await request(app, '/api/flags');
    expect(res.status).toBe(200);
    expect(res.body.flags.community).toBe(true);
    expect(res.body.flags.billing).toBe(false);
  });
});
