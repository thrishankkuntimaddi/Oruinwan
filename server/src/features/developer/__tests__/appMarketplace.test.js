'use strict';

const express = require('express');
const http = require('http');
const crypto = require('crypto');

const WS = '64b000000000000000000001';
const OTHER_WS = '64b000000000000000000002';
const ALICE = '64b0000000000000000000a1'; // owner of WS
const BOB = '64b0000000000000000000b1';   // member of WS
const DEV = '64b0000000000000000000d9';   // app developer, member of nothing
const STAFF = '64b0000000000000000000ee'; // platform admin
const APP = '64b0000000000000000000d1';

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
  if (!req.headers['x-user']) return res.status(401).json({ message: 'auth' });
  req.user = { sub: req.headers['x-user'] };
  next();
});

const mockWorkspaces = {
  '64b000000000000000000001': {
    _id: '64b000000000000000000001',
    members: [
      { user: '64b0000000000000000000a1', role: 'owner', status: 'active' },
      { user: '64b0000000000000000000b1', role: 'member', status: 'active' },
    ],
  },
  '64b000000000000000000002': { _id: '64b000000000000000000002', members: [] },
};
jest.mock('../../../identity/workspaces.repo', () => ({
  ...jest.requireActual('../../../identity/workspaces.repo'),
  findById: jest.fn(async (id) => mockWorkspaces[String(id)] || null),
  findManyByIds: jest.fn(async (ids) => ids.map((id) => mockWorkspaces[String(id)]).filter(Boolean)),
}));
jest.mock('../../../identity/users.repo', () => ({
  ...jest.requireActual('../../../identity/users.repo'),
  findById: jest.fn(async (id) => ({
    _id: String(id), username: `user-${String(id).slice(-2)}`, email: `${String(id).slice(-2)}@x.test`,
    roles: String(id) === '64b0000000000000000000ee' ? ['chttrix_admin'] : ['user'],
  })),
  findManyByIds: jest.fn(async (ids) => new Map(ids.map((id) => [id, { _id: id, username: `user-${id.slice(-2)}` }]))),
}));
jest.mock('../../../../utils/sendEmail', () => jest.fn(async () => ({})));
jest.mock('../../../modules/linkPreview/linkPreview.service', () => ({
  assertNotSSRF: jest.fn(async (u) => { if (/internal/.test(u)) throw new Error('Blocked URL'); return new URL(u); }),
}));

// ── In-memory App model ────────────────────────────────────────────────────
const mockStore = { apps: {} };
function mockMakeDoc(data) {
  const doc = { ...data };
  Object.defineProperty(doc, 'save', { enumerable: false, value: jest.fn(async () => { mockStore.apps[String(doc._id)] = doc; return doc; }) });
  Object.defineProperty(doc, 'toObject', { enumerable: false, value: () => ({ ...doc }) });
  return doc;
}
function mockQuery(result) {
  const q = {};
  ['select', 'sort', 'skip', 'limit'].forEach((k) => { q[k] = jest.fn(() => q); });
  q.lean = jest.fn(async () => (Array.isArray(result) ? result.map((r) => ({ ...r })) : result ? { ...result } : result));
  q.then = (res, rej) => Promise.resolve(result).then(res, rej);
  return q;
}
function mockMatches(doc, q) {
  return Object.entries(q).every(([k, v]) => {
    if (k === '$or' || k === '$and') return true;
    if (v && typeof v === 'object' && '$ne' in v) return String(doc[k]) !== String(v.$ne);
    return String(doc[k]) === String(v);
  });
}
jest.mock('../app.model', () => {
  const real = jest.requireActual('../app.model');
  return {
    APP_STATUSES: real.APP_STATUSES, APP_CATEGORIES: real.APP_CATEGORIES, APP_SCOPES: real.APP_SCOPES,
    APPROVED_QUERY: real.APPROVED_QUERY,
    find: jest.fn((q) => mockQuery(Object.values(mockStore.apps).filter((d) => mockMatches(d, q)))),
    findById: jest.fn((id) => mockQuery(mockStore.apps[String(id)] || null)),
    countDocuments: jest.fn(async (q) => Object.values(mockStore.apps).filter((d) => mockMatches(d, q)).length),
    create: jest.fn(async (data) => {
      if (Object.values(mockStore.apps).some((a) => a.name === data.name)) throw Object.assign(new Error('dup'), { code: 11000 });
      const doc = mockMakeDoc({ _id: '64b0000000000000000000' + String(Object.keys(mockStore.apps).length + 10).padStart(2, '0'), ...data });
      mockStore.apps[String(doc._id)] = doc;
      return doc;
    }),
    updateOne: jest.fn(async (q, upd) => {
      const doc = mockStore.apps[String(q._id)];
      if (!doc) return { modifiedCount: 0 };
      if (q.installedIn && q.installedIn.$ne && (doc.installedIn || []).map(String).includes(String(q.installedIn.$ne))) return { modifiedCount: 0 };
      if (upd.$addToSet) doc.installedIn = [...new Set([...(doc.installedIn || []).map(String), String(upd.$addToSet.installedIn)])];
      if (upd.$pull) doc.installedIn = (doc.installedIn || []).filter((x) => String(x) !== String(upd.$pull.installedIn));
      return { modifiedCount: 1 };
    }),
    deleteOne: jest.fn(async (q) => { delete mockStore.apps[String(q._id)]; return { deletedCount: 1 }; }),
    aggregate: jest.fn(async () => []),
  };
});

const mockReviews = { upserts: [] };
jest.mock('../../community/AppReview.model', () => ({
  aggregate: jest.fn(async () => []),
  deleteMany: jest.fn(async () => ({})),
  findOneAndUpdate: jest.fn(async (q, d) => { mockReviews.upserts.push({ ...q, ...d }); return { _id: 'r1', ...q, ...d }; }),
}));

jest.mock('../apiKey.model', () => {
  const real = jest.requireActual('../apiKey.model');
  return {
    schema: real.schema, generateKey: real.generateKey,
    create: jest.fn(async (d) => ({ _id: 'k1', ...d })),
    updateMany: jest.fn(async () => ({ modifiedCount: 1 })),
  };
});
jest.mock('../bot.model', () => {
  const real = jest.requireActual('../bot.model');
  return {
    schema: real.schema, generateToken: real.generateToken,
    create: jest.fn(async (d) => ({ _id: 'b1', ...d })),
    updateMany: jest.fn(async () => ({ modifiedCount: 1 })),
  };
});

const ApiKey = require('../apiKey.model');
const Bot = require('../bot.model');
const { assertNotSSRF } = require('../../../modules/linkPreview/linkPreview.service');
const { installApp, uninstallApp, signBody } = require('../appInstall.service');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/marketplace', require('../../community/marketplace.routes'));
  app.use('/api/developer', require('../apps.routes'));
  return app;
}

function call(method, path, userId, body) {
  const app = makeApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request({
        port: server.address().port, path, method,
        headers: { ...(userId ? { 'x-user': userId } : {}), 'content-type': 'application/json', ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) },
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

const realFetch = global.fetch;
let fetchCalls;
beforeEach(() => {
  for (const k of Object.keys(mockStore.apps)) delete mockStore.apps[k];
  mockReviews.upserts.length = 0;
  jest.clearAllMocks();
  fetchCalls = [];
  global.fetch = jest.fn(async (url, init) => { fetchCalls.push({ url, init }); return { ok: true, status: 200 }; });
});
afterAll(() => { global.fetch = realFetch; });

function seedApp(over = {}) {
  const doc = mockMakeDoc({
    _id: APP, name: 'Standup Bot', description: 'Collects standups every morning.', category: 'productivity',
    isPublished: true, status: 'approved', ownerId: DEV, installedIn: [], scopes: ['tasks:read', 'tasks:write'],
    botUser: { enabled: true, name: 'Standup' }, webhookUrl: 'https://hooks.example.com/oruinwan', signingSecret: 'whsec_test',
    ...over,
  });
  mockStore.apps[APP] = doc;
  return doc;
}

describe('installApp / uninstallApp', () => {
  test('install issues a scoped app token and bot, and delivers a signed app.installed event', async () => {
    seedApp();
    const out = await installApp(APP, WS, { userId: ALICE });
    expect(out.appToken).toMatch(/^chx_/);
    expect(out.botToken).toMatch(/^bot_/);
    expect(out.scopes).toEqual(['tasks:read', 'tasks:write']);
    expect(ApiKey.create).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: WS, permissions: ['tasks:read', 'tasks:write'], appId: APP, createdBy: ALICE }));
    expect(Bot.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Standup', workspaceId: WS, appId: APP, permissions: ['tasks:read', 'tasks:write'] }));
    expect(mockStore.apps[APP].installedIn).toEqual([WS]);

    expect(fetchCalls).toHaveLength(1);
    const { url, init } = fetchCalls[0];
    expect(url).toBe('https://hooks.example.com/oruinwan');
    const payload = JSON.parse(init.body);
    expect(payload).toMatchObject({ event: 'app.installed', appId: APP, data: { workspaceId: WS, token: out.appToken, botToken: out.botToken } });
    expect(init.headers['X-Oruinwan-Signature']).toBe(signBody(init.body, 'whsec_test'));
    expect(init.headers['X-Oruinwan-Signature']).toBe('sha256=' + crypto.createHmac('sha256', 'whsec_test').update(init.body).digest('hex'));
    expect(out.webhookDelivered).toBe(true);
  });

  test('second install is 409; unapproved apps cannot be installed', async () => {
    seedApp({ installedIn: [WS] });
    await expect(installApp(APP, WS, { userId: ALICE })).rejects.toMatchObject({ status: 409 });
    seedApp({ status: 'submitted' });
    await expect(installApp(APP, WS, { userId: ALICE })).rejects.toMatchObject({ status: 404 });
  });

  test('a blocked webhook URL does not fail the install', async () => {
    seedApp({ webhookUrl: 'https://metadata.internal/x' });
    const out = await installApp(APP, WS, { userId: ALICE });
    expect(out.webhookDelivered).toBe(false);
    expect(out.appToken).toMatch(/^chx_/);
    expect(assertNotSSRF).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('uninstall revokes the workspace\'s tokens and bots', async () => {
    seedApp({ installedIn: [WS] });
    const out = await uninstallApp(APP, WS);
    expect(out.installed).toBe(false);
    expect(ApiKey.updateMany).toHaveBeenCalledWith({ appId: expect.anything(), isActive: true, workspaceId: WS }, { isActive: false });
    expect(Bot.updateMany).toHaveBeenCalledWith({ appId: expect.anything(), isActive: true, workspaceId: WS }, { isActive: false });
    expect(mockStore.apps[APP].installedIn).toEqual([]);
    expect(JSON.parse(fetchCalls[0].init.body).event).toBe('app.uninstalled');
  });
});

describe('My apps → review → marketplace', () => {
  const draft = { name: 'Retro Helper', description: 'Runs retrospectives in a channel.', category: 'productivity', scopes: ['channels:read'], botUser: { enabled: false } };

  test('create validates input and starts as a draft with a signing secret', async () => {
    expect((await call('POST', '/api/developer/my-apps', DEV, { name: 'x', description: 'short' })).status).toBe(400);
    expect((await call('POST', '/api/developer/my-apps', DEV, { ...draft, scopes: ['*'] })).status).toBe(400);
    expect((await call('POST', '/api/developer/my-apps', DEV, { ...draft, iconUrl: 'http://x.test/i.png' })).status).toBe(400);
    expect((await call('POST', '/api/developer/my-apps', DEV, { ...draft, webhookUrl: 'ftp://x' })).status).toBe(400);
    const res = await call('POST', '/api/developer/my-apps', DEV, draft);
    expect(res.status).toBe(201);
    expect(res.body.app).toMatchObject({ name: 'Retro Helper', status: 'draft', installCount: 0 });
    expect(res.body.app.signingSecret).toMatch(/^whsec_/);
    expect(res.body.app).not.toHaveProperty('installedIn');
    expect((await call('POST', '/api/developer/my-apps', DEV, draft)).status).toBe(409); // same name
  });

  test('full lifecycle: submit, admin approve, listed, edit re-reviews; non-owners see 404', async () => {
    const created = (await call('POST', '/api/developer/my-apps', DEV, draft)).body.app;
    const id = created._id;
    // Scopes need somewhere to deliver the token.
    expect((await call('POST', `/api/developer/my-apps/${id}/submit`, DEV)).status).toBe(400);
    expect((await call('PATCH', `/api/developer/my-apps/${id}`, DEV, { webhookUrl: 'https://hooks.example.com/retro' })).status).toBe(200);
    expect((await call('PATCH', `/api/developer/my-apps/${id}`, ALICE, { name: 'Hijack' })).status).toBe(404);
    expect((await call('POST', `/api/developer/my-apps/${id}/submit`, DEV)).body.app.status).toBe('submitted');
    expect((await call('PATCH', `/api/developer/my-apps/${id}`, DEV, { description: 'Changed while in review' })).status).toBe(409);

    // Review queue is platform-admin only.
    expect((await call('GET', '/api/developer/admin/apps', ALICE)).status).toBe(403);
    const queue = await call('GET', '/api/developer/admin/apps', STAFF);
    expect(queue.status).toBe(200);
    expect(queue.body.apps.map((a) => a._id)).toContain(id);
    expect((await call('POST', `/api/developer/admin/apps/${id}/review`, ALICE, { decision: 'approve' })).status).toBe(403);
    expect((await call('POST', `/api/developer/admin/apps/${id}/review`, STAFF, { decision: 'reject' })).status).toBe(400); // note required
    const ok = await call('POST', `/api/developer/admin/apps/${id}/review`, STAFF, { decision: 'approve', note: 'Looks good' });
    expect(ok.status).toBe(200);
    expect(mockStore.apps[id].status).toBe('approved');
    expect(mockStore.apps[id].review).toMatchObject({ note: 'Looks good', reviewedBy: STAFF });
    expect(require('../../../../utils/sendEmail')).toHaveBeenCalledWith(expect.objectContaining({ to: 'd9@x.test' }));

    // Editing an approved app sends it back to review.
    const edited = await call('PATCH', `/api/developer/my-apps/${id}`, DEV, { description: 'Runs retros, now with voting.' });
    expect(edited.body.app.status).toBe('submitted');
    expect(edited.body.message).toMatch(/review/);
  });

  test('rejecting a listed app takes it down everywhere', async () => {
    seedApp({ installedIn: [WS, OTHER_WS] });
    const res = await call('POST', `/api/developer/admin/apps/${APP}/review`, STAFF, { decision: 'reject', note: 'Violates policy' });
    expect(res.status).toBe(200);
    expect(mockStore.apps[APP].status).toBe('rejected');
    expect(mockStore.apps[APP].installedIn).toEqual([]);
    expect(ApiKey.updateMany).toHaveBeenCalledWith({ appId: APP, isActive: true }, { isActive: false });
  });

  test('delete revokes every install', async () => {
    seedApp({ installedIn: [WS] });
    expect((await call('DELETE', `/api/developer/my-apps/${APP}`, ALICE)).status).toBe(404);
    expect((await call('DELETE', `/api/developer/my-apps/${APP}`, DEV)).status).toBe(200);
    expect(mockStore.apps[APP]).toBeUndefined();
    expect(Bot.updateMany).toHaveBeenCalledWith({ appId: APP, isActive: true }, { isActive: false });
  });

  test('marketplace install returns the app token once to the admin', async () => {
    seedApp();
    expect((await call('POST', '/api/marketplace/install', BOB, { appId: APP, workspaceId: WS })).status).toBe(403);
    const res = await call('POST', '/api/marketplace/install', ALICE, { appId: APP, workspaceId: WS });
    expect(res.status).toBe(200);
    expect(res.body.appToken).toMatch(/^chx_/);
  });
});

describe('reviews', () => {
  test('only members of a workspace that installed the app; not the owner; one per user', async () => {
    seedApp({ installedIn: [WS] });
    const body = { appId: APP, rating: 4, comment: 'Useful', workspaceId: WS };
    expect((await call('POST', '/api/marketplace/review', BOB, { ...body, workspaceId: undefined })).status).toBe(400);
    expect((await call('POST', '/api/marketplace/review', BOB, { ...body, rating: 4.5 })).status).toBe(400);
    expect((await call('POST', '/api/marketplace/review', DEV, body)).status).toBe(403);           // owner
    expect((await call('POST', '/api/marketplace/review', STAFF, body)).status).toBe(403);         // not a member
    expect((await call('POST', '/api/marketplace/review', ALICE, { ...body, workspaceId: OTHER_WS })).status).toBe(403); // not installed there
    const ok = await call('POST', '/api/marketplace/review', BOB, body);
    expect(ok.status).toBe(201);
    await call('POST', '/api/marketplace/review', BOB, { ...body, rating: 2 });
    // Upserted on (appId, userId): a second review replaces the first.
    expect(mockReviews.upserts.map((r) => [r.userId, r.rating])).toEqual([[BOB, 4], [BOB, 2]]);
  });
});

describe('public integrations', () => {
  test('lists the connector catalog with k-anonymous usage counts', async () => {
    jest.doMock('../../integrations/integration.model', () => ({
      aggregate: jest.fn(async () => [{ _id: 'github', n: 12 }, { _id: 'slack', n: 2 }]),
    }));
    const res = await call('GET', '/api/marketplace/integrations/public');
    expect(res.status).toBe(200);
    const byType = Object.fromEntries(res.body.integrations.map((i) => [i.type, i]));
    expect(byType.github.workspaceCount).toBe(12);
    expect(byType.slack.workspaceCount).toBeNull();
    expect(byType.slack.label).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/workspaceId/);
  });
});
