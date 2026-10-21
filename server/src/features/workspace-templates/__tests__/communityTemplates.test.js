'use strict';

const express = require('express');
const http = require('http');

const WS = '64b000000000000000000001';
const ALICE = '64b0000000000000000000a1'; // owner of WS
const BOB = '64b0000000000000000000b1';   // member of WS
const CAROL = '64b0000000000000000000c1'; // someone else
const STAFF = '64b0000000000000000000ee'; // platform admin

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
  if (!req.headers['x-user']) return res.status(401).json({ message: 'auth' });
  req.user = { sub: req.headers['x-user'] };
  next();
});
jest.mock('../../../identity/workspaces.repo', () => ({
  ...jest.requireActual('../../../identity/workspaces.repo'),
  findById: jest.fn(async (id) => (String(id) === '64b000000000000000000001' ? {
    _id: '64b000000000000000000001', icon: '🚀', color: '#112233',
    settings: { isPrivate: false, allowMemberInvite: false, secretThing: 'nope' },
    members: [
      { user: '64b0000000000000000000a1', role: 'owner', status: 'active' },
      { user: '64b0000000000000000000b1', role: 'member', status: 'active' },
    ],
  } : null)),
}));
jest.mock('../../../identity/users.repo', () => ({
  ...jest.requireActual('../../../identity/users.repo'),
  findById: jest.fn(async (id) => ({ _id: String(id), roles: String(id) === '64b0000000000000000000ee' ? ['oruinwan_admin'] : [] })),
  findManyByIds: jest.fn(async (ids) => new Map(ids.map((id) => [id, { _id: id, username: `user-${id.slice(-2)}` }]))),
}));
jest.mock('../../../identity/orgs.repo', () => ({
  ...jest.requireActual('../../../identity/orgs.repo'),
  workspacePermissions: { get: jest.fn(async () => ({ featureToggles: { ai: false, polls: true, bogus: 1 } })) },
}));

const mockChannels = [
  { _id: 'c1', name: 'general', description: 'Everything', isDefault: true },
  { _id: 'c2', name: 'design', description: 'Mockups' },
];
const mockChannelFind = jest.fn();
jest.mock('../../channels/channel.model', () => ({ find: (...a) => mockChannelFind(...a), countDocuments: jest.fn(async () => 0) }));

// ── In-memory WorkspaceTemplate ─────────────────────────────────────────────
const mockStore = {};
function mockDoc(data) {
  const d = JSON.parse(JSON.stringify(data));
  Object.defineProperty(d, 'save', { enumerable: false, value: jest.fn(async () => { mockStore[d._id] = d; return d; }) });
  Object.defineProperty(d, 'toObject', { enumerable: false, value: () => JSON.parse(JSON.stringify(d)) });
  return d;
}
function mockGet(o, path) { return path.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
function mockMatch(d, q) {
  return Object.entries(q).every(([k, v]) => {
    if (k === '$or') return true;
    const val = mockGet(d, k);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('$gt' in v) return (val || 0) > v.$gt;
      if ('$in' in v) return v.$in.includes(val);
      if ('$nin' in v) return !v.$nin.includes(val);
      if ('$ne' in v) return String(val) !== String(v.$ne);
    }
    return String(val) === String(v);
  });
}
function mockChain(rows) {
  const c = {};
  ['select', 'sort', 'skip', 'limit'].forEach((m) => { c[m] = jest.fn(() => c); });
  c.lean = jest.fn(async () => rows.map((r) => JSON.parse(JSON.stringify(r))));
  return c;
}
let mockSeq = 0;
jest.mock('../../../models/WorkspaceTemplate', () => {
  const realSchemaCategories = ['general', 'engineering', 'design', 'marketing', 'sales', 'hr', 'finance', 'support', 'product', 'custom'];
  return {
    schema: { path: () => ({ enumValues: realSchemaCategories }) },
    find: jest.fn((q) => mockChain(Object.values(mockStore).filter((d) => mockMatch(d, q)))),
    findById: jest.fn(async (id) => (mockStore[String(id)] ? mockDoc(mockStore[String(id)]) : null)),
    countDocuments: jest.fn(async (q) => Object.values(mockStore).filter((d) => mockMatch(d, q)).length),
    create: jest.fn(async (data) => { const d = mockDoc({ _id: `64b0000000000000000001${String(++mockSeq).padStart(2, '0')}`, usageCount: 0, isActive: true, ...data }); mockStore[d._id] = d; return d; }),
    updateOne: jest.fn(async (q, upd) => {
      const d = mockStore[String(q._id)];
      if (!d) return { modifiedCount: 0 };
      if (q['community.reports.userId'] && (d.community.reports || []).some((r) => String(r.userId) === String(q['community.reports.userId'].$ne))) return { modifiedCount: 0 };
      if (upd.$push) { d.community.reports = [...(d.community.reports || []), upd.$push['community.reports']]; }
      if (upd.$inc) d.community.reportCount = (d.community.reportCount || 0) + 1;
      if (upd.$set) for (const [k, v] of Object.entries(upd.$set)) d.community[k.split('.')[1]] = v;
      return { modifiedCount: 1 };
    }),
    aggregate: jest.fn(async () => []),
  };
});
const mockRatings = {};
jest.mock('../TemplateRating.model', () => ({
  findOneAndUpdate: jest.fn(async (q, d) => { mockRatings[`${q.templateId}:${q.userId}`] = d.rating; return d; }),
  aggregate: jest.fn(async () => {
    const vals = Object.values(mockRatings);
    return vals.length ? [{ avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length }] : [];
  }),
}));

function call(method, path, userId, body) {
  const app = express();
  app.use(express.json());
  app.use('/api/workspace-templates', require('../workspace-templates.routes'));
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

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  for (const k of Object.keys(mockRatings)) delete mockRatings[k];
  mockChannelFind.mockImplementation(() => mockChain(mockChannels));
});

const meta = { workspaceId: WS, name: 'Product squad', description: 'Channels for a small product team.', category: 'product' };

async function publishAndApprove() {
  const pub = await call('POST', '/api/workspace-templates/community/publish', ALICE, meta);
  expect(pub.status).toBe(201);
  const id = pub.body.template._id;
  expect((await call('POST', `/api/workspace-templates/community/admin/${id}/moderate`, STAFF, { action: 'approve' })).status).toBe(200);
  return id;
}

describe('community templates', () => {
  test('only workspace admins publish; the snapshot is structure only and starts pending', async () => {
    expect((await call('POST', '/api/workspace-templates/community/publish', BOB, meta)).status).toBe(403);
    expect((await call('POST', '/api/workspace-templates/community/publish', CAROL, meta)).status).toBe(403);
    expect((await call('POST', '/api/workspace-templates/community/publish', ALICE, { ...meta, name: 'x' })).status).toBe(400);

    const res = await call('POST', '/api/workspace-templates/community/publish', ALICE, meta);
    expect(res.status).toBe(201);
    // Only public, non-archived channels are read.
    expect(mockChannelFind).toHaveBeenCalledWith({ workspace: WS, isPrivate: { $ne: true }, isArchived: { $ne: true } });
    const saved = mockStore[res.body.template._id];
    expect(saved.isPublic).toBe(false);
    expect(saved.company).toBeNull();
    expect(saved.community.status).toBe('pending');
    expect(saved.defaultChannels.map((c) => c.name)).toEqual(['general', 'design']);
    expect(saved.settings).toEqual({ isPrivate: false, allowMemberInvite: false });
    expect(saved.featureToggles).toEqual({ ai: false, polls: true });
    expect(res.body.template.channels).toEqual([
      { name: 'general', description: 'Everything', isDefault: true },
      { name: 'design', description: 'Mockups', isDefault: false },
    ]);

    // Not in the public gallery until approved.
    expect((await call('GET', '/api/workspace-templates/community')).body.templates).toHaveLength(0);
    expect((await call('GET', '/api/workspace-templates/community/mine', ALICE)).body.templates[0].status).toBe('pending');
  });

  test('moderation is platform-admin only; approve lists it, hide removes it', async () => {
    const pub = await call('POST', '/api/workspace-templates/community/publish', ALICE, meta);
    const id = pub.body.template._id;
    expect((await call('GET', '/api/workspace-templates/community/admin', ALICE)).status).toBe(403);
    expect((await call('POST', `/api/workspace-templates/community/admin/${id}/moderate`, ALICE, { action: 'approve' })).status).toBe(403);
    const queue = await call('GET', '/api/workspace-templates/community/admin?status=pending', STAFF);
    expect(queue.body.templates.map((t) => t._id)).toEqual([id]);

    await call('POST', `/api/workspace-templates/community/admin/${id}/moderate`, STAFF, { action: 'approve' });
    const gallery = await call('GET', '/api/workspace-templates/community');
    expect(gallery.body.templates.map((t) => t._id)).toEqual([id]);
    expect(gallery.body.templates[0]).toMatchObject({ importCount: 0, ratingAvg: 0, publisher: { username: 'user-a1' } });
    expect(JSON.stringify(gallery.body)).not.toMatch(/sourceWorkspaceId|reports/);

    expect((await call('POST', `/api/workspace-templates/community/admin/${id}/moderate`, STAFF, { action: 'hide' })).status).toBe(400); // reason needed
    await call('POST', `/api/workspace-templates/community/admin/${id}/moderate`, STAFF, { action: 'hide', note: 'Spam' });
    expect(mockStore[id].isPublic).toBe(false);
    expect((await call('GET', '/api/workspace-templates/community')).body.templates).toHaveLength(0);
  });

  test('ratings: one per user, averaged, publisher cannot rate', async () => {
    const id = await publishAndApprove();
    expect((await call('POST', `/api/workspace-templates/community/${id}/rate`, ALICE, { rating: 5 })).status).toBe(403);
    expect((await call('POST', `/api/workspace-templates/community/${id}/rate`, BOB, { rating: 0 })).status).toBe(400);
    await call('POST', `/api/workspace-templates/community/${id}/rate`, BOB, { rating: 4 });
    await call('POST', `/api/workspace-templates/community/${id}/rate`, BOB, { rating: 2 }); // replaces Bob's
    const r = await call('POST', `/api/workspace-templates/community/${id}/rate`, CAROL, { rating: 5 });
    expect(r.body).toMatchObject({ ratingAvg: 3.5, ratingCount: 2 });
    expect(mockStore[id].community.ratingAvg).toBe(3.5);
  });

  test('reports: once per user, show up in the reported queue, can be dismissed', async () => {
    const id = await publishAndApprove();
    expect((await call('POST', `/api/workspace-templates/community/${id}/report`, BOB, { reason: 'x' })).status).toBe(400);
    expect((await call('POST', `/api/workspace-templates/community/${id}/report`, BOB, { reason: 'Offensive channel names' })).status).toBe(200);
    expect((await call('POST', `/api/workspace-templates/community/${id}/report`, BOB, { reason: 'Again' })).status).toBe(409);
    const q = await call('GET', '/api/workspace-templates/community/admin?status=reported', STAFF);
    expect(q.body.templates[0]).toMatchObject({ _id: id, reportCount: 1 });
    expect(q.body.templates[0].reports[0]).toMatchObject({ reason: 'Offensive channel names', by: 'user-b1' });
    await call('POST', `/api/workspace-templates/community/admin/${id}/moderate`, STAFF, { action: 'dismiss_reports' });
    expect(mockStore[id].community.reportCount).toBe(0);
    expect(mockStore[id].isPublic).toBe(true);
  });

  test('publisher can edit (re-review) and unpublish; others cannot', async () => {
    const id = await publishAndApprove();
    expect((await call('PATCH', `/api/workspace-templates/community/${id}`, BOB, { name: 'Mine now' })).status).toBe(404);
    const e = await call('PATCH', `/api/workspace-templates/community/${id}`, ALICE, { description: 'Updated description here.' });
    expect(e.status).toBe(200);
    expect(mockStore[id].community.status).toBe('pending');
    expect(mockStore[id].isPublic).toBe(false);
    expect((await call('DELETE', `/api/workspace-templates/community/${id}`, BOB)).status).toBe(404);
    expect((await call('DELETE', `/api/workspace-templates/community/${id}`, ALICE)).status).toBe(200);
    expect(mockStore[id].isActive).toBe(false);
  });
});
