'use strict';

const express = require('express');
const http = require('http');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
  req.user = { sub: req.headers['x-user'] };
  next();
});
jest.mock('../../../shared/featureFlags', () => ({ requireFlag: () => (req, res, next) => next() }));
jest.mock('../../ai/ai.access', () => ({ requireAIAccess: () => (req, res, next) => next() }));
jest.mock('../integration.service', () => ({}));
jest.mock('../ai-provider.service', () => ({}));
jest.mock('../webhook.trigger', () => ({ sendTest: jest.fn(async () => ({ status: 200, ok: true })), fire: jest.fn() }));

const WS = '64b000000000000000000001';
const ALICE = '64b0000000000000000000a1';
const BOB = '64b0000000000000000000b1';
const CAROL = '64b0000000000000000000c1';
const HOOK = '64b0000000000000000000d1';

// Workspaces live in PostgreSQL; the repository is mocked.
jest.mock('../../../identity/workspaces.repo', () => ({
  ...jest.requireActual('../../../identity/workspaces.repo'),
  findById: jest.fn(async (id) => (String(id) !== '64b000000000000000000001' ? null : {
    _id: String(id),
    members: [
      { user: '64b0000000000000000000a1', role: 'owner', status: 'active' },
      { user: '64b0000000000000000000b1', role: 'member', status: 'active' },
    ],
  })),
}));


const Webhook = require('../webhook.model');
const trigger = require('../webhook.trigger');
const router = require('../integrations.routes');

let store;
beforeEach(() => {
  store = [{ _id: HOOK, workspaceId: WS, event: 'task.created', url: 'https://example.com/h', secret: 's3cret', isActive: true }];
  jest.spyOn(Webhook, 'find').mockImplementation(() => ({
    select: () => ({ sort: () => ({ lean: async () => store.map(({ secret, ...h }) => h) }) }),
  }));
  jest.spyOn(Webhook, 'findById').mockImplementation((id) => ({ lean: async () => store.find(h => h._id === String(id)) || null }));
  jest.spyOn(Webhook, 'create').mockImplementation(async (doc) => {
    const obj = { _id: 'new', ...doc, secret: 'fresh-secret', isActive: true };
    store.push(obj);
    return { ...obj, toObject: () => ({ ...obj }) };
  });
  jest.spyOn(Webhook, 'findByIdAndUpdate').mockImplementation((id, upd) => {
    const h = store.find(x => x._id === String(id));
    Object.assign(h, upd);
    return { select: () => ({ lean: async () => { const { secret, ...rest } = h; return rest; } }) };
  });
  jest.spyOn(Webhook, 'deleteOne').mockImplementation(async () => ({ deletedCount: 1 }));
});

function call(method, path, userId, body) {
  const app = express();
  app.use(express.json());
  app.use('/api/v2/integrations', router);
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request({
        port: server.address().port, path, method,
        headers: { 'x-user': userId, 'content-type': 'application/json', ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) },
      }, (res) => {
        let text = '';
        res.on('data', (c) => { text += c; });
        res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (data) req.write(data);
      req.end();
    });
  });
}

const base = '/api/v2/integrations/webhooks';

describe('webhook management', () => {
  test('GET /events lists only supported events', async () => {
    const res = await call('GET', `${base}/events`, ALICE);
    expect(res.status).toBe(200);
    const names = res.body.events.map(e => e.event);
    expect(names).toEqual(expect.arrayContaining(['task.created', 'message.sent']));
    expect(names).not.toContain('file.uploaded');
  });

  test('list: non-member 403, member 200 (redacted), admin gets events array without secret', async () => {
    expect((await call('GET', `${base}?workspaceId=${WS}`, CAROL)).status).toBe(403);
    const asMember = await call('GET', `${base}?workspaceId=${WS}`, BOB);
    expect(asMember.status).toBe(200);
    expect(asMember.body.webhooks[0]).not.toHaveProperty('secret');
    expect(asMember.body.webhooks[0].url).toBe('https://example.com');
    expect((await call('GET', `${base}?workspaceId=bad`, ALICE)).status).toBe(400);
    const res = await call('GET', `${base}?workspaceId=${WS}`, ALICE);
    expect(res.status).toBe(200);
    expect(res.body.webhooks[0].events).toEqual(['task.created']);
    expect(res.body.webhooks[0].url).toBe('https://example.com/h');
    expect(res.body.webhooks[0]).not.toHaveProperty('secret');
  });

  test('create validates events, accepts legacy event, returns secret once', async () => {
    const bad = await call('POST', base, ALICE, { workspaceId: WS, url: 'https://x.test', events: ['file.uploaded'] });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/Unsupported/);
    expect((await call('POST', base, ALICE, { workspaceId: WS, url: 'https://x.test', events: [] })).status).toBe(400);
    expect((await call('POST', base, ALICE, { workspaceId: WS, url: 'ftp://x.test', events: ['task.created'] })).status).toBe(400);
    expect((await call('POST', base, BOB, { workspaceId: WS, url: 'https://x.test', events: ['task.created'] })).status).toBe(403);

    const ok = await call('POST', base, ALICE, { workspaceId: WS, url: 'https://x.test/hook', events: ['task.created', 'message.sent'] });
    expect(ok.status).toBe(201);
    expect(ok.body.webhook.secret).toBe('fresh-secret');
    expect(ok.body.webhook.events).toEqual(['task.created', 'message.sent']);

    const legacy = await call('POST', base, ALICE, { workspaceId: WS, url: 'https://x.test/hook', event: 'task.updated' });
    expect(legacy.status).toBe(201);
    expect(Webhook.create).toHaveBeenLastCalledWith(expect.objectContaining({ events: ['task.updated'] }));
  });

  test('PATCH toggles active (admin only); malformed id 400', async () => {
    expect((await call('PATCH', `${base}/nope`, ALICE, { active: false })).status).toBe(400);
    expect((await call('PATCH', `${base}/${HOOK}`, CAROL, { active: false })).status).toBe(404);
    expect((await call('PATCH', `${base}/${HOOK}`, BOB, { active: false })).status).toBe(403);
    expect((await call('PATCH', `${base}/${HOOK}`, ALICE, { active: 'no' })).status).toBe(400);
    const res = await call('PATCH', `${base}/${HOOK}`, ALICE, { active: false });
    expect(res.status).toBe(200);
    expect(res.body.webhook.isActive).toBe(false);
    expect(res.body.webhook).not.toHaveProperty('secret');
  });

  test('POST /:id/test returns { status, ok } for admins only', async () => {
    expect((await call('POST', `${base}/${HOOK}/test`, BOB)).status).toBe(403);
    const res = await call('POST', `${base}/${HOOK}/test`, ALICE);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 200, ok: true });
    expect(trigger.sendTest).toHaveBeenCalled();
  });

  test('DELETE requires admin (others get 404)', async () => {
    expect((await call('DELETE', `${base}/${HOOK}`, CAROL)).status).toBe(404);
    expect((await call('DELETE', `${base}/${HOOK}`, BOB)).status).toBe(404);
    expect((await call('DELETE', `${base}/${HOOK}`, ALICE)).status).toBe(200);
  });

});
