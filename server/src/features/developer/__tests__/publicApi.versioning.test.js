'use strict';

const express = require('express');
const http = require('http');

// The real v1 router is covered by publicApi.test.js; here a stand-in records hits.
const mockHits = [];
jest.mock('../publicApi.routes', () => {
  const r = require('express').Router();
  r.use((req, res, next) => { mockHits.push(req.path); next(); });
  r.get('/tasks', (req, res) => res.json({ tasks: [], path: req.path }));
  return r;
});

const versioned = require('../publicApi.versioning');

function call(path) {
  const app = express();
  app.use('/api/public', versioned);
  app.use((req, res) => res.status(418).json({ message: 'fell through' }));
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      http.get({ port: server.address().port, path }, (res) => {
        let text = '';
        res.on('data', (c) => { text += c; });
        res.on('end', () => { server.close(); resolve({ status: res.statusCode, headers: res.headers, body: text ? JSON.parse(text) : null }); });
      }).on('error', (e) => { server.close(); reject(e); });
    });
  });
}

beforeEach(() => { mockHits.length = 0; });

describe('public API versioning', () => {
  test('/v1 serves the API without deprecation headers', async () => {
    const r = await call('/api/public/v1/tasks?x=1');
    expect(r.status).toBe(200);
    expect(r.body.path).toBe('/tasks');
    expect(r.headers['api-version']).toBe('v1');
    expect(r.headers.deprecation).toBeUndefined();
    expect(mockHits).toEqual(['/tasks']);
  });

  test('legacy unversioned path is an alias with Deprecation + successor Link', async () => {
    const r = await call('/api/public/tasks');
    expect(r.status).toBe(200);
    expect(r.body.path).toBe('/tasks');
    expect(r.headers.deprecation).toBe(versioned.DEPRECATED_AT);
    expect(r.headers.link).toBe('</api/public/v1/tasks>; rel="successor-version"');
    expect(r.headers['api-version']).toBe('v1');
  });

  test('unknown v1 endpoint is a 404 and does not hit the legacy alias', async () => {
    const r = await call('/api/public/v1/nope');
    expect(r.status).toBe(404);
    expect(r.body.message).toMatch(/Unknown/);
    expect(mockHits).toEqual(['/nope']);
  });

  test('unsupported version is a 404', async () => {
    const r = await call('/api/public/v2/tasks');
    expect(r.status).toBe(404);
    expect(r.body.message).toMatch(/v1/);
    expect(mockHits).toEqual([]);
  });

  test('a path merely starting with v is still the legacy alias', async () => {
    const r = await call('/api/public/videos');
    expect(r.headers.deprecation).toBe(versioned.DEPRECATED_AT);
    expect(r.status).toBe(418);
  });
});
