'use strict';

/**
 * Personal connections: who can connect, whose key answers, and that nobody can see, use or
 * remove another person's connection. Real routes on express listen(0), with an in-memory store
 * standing in for MongoDB and the provider checks mocked.
 */

const express = require('express');

const WS = '64b0000000000000000000aa';
const OTHER_WS = '64b0000000000000000000bb';
const ADMIN = '64b000000000000000000001';
const ALICE = '64b000000000000000000002';
const BOB = '64b000000000000000000003';

// ── in-memory stand-ins ───────────────────────────────────────────────────────
const mockStore = [];
const mockWorkspaces = {};
const mockAudit = [];
const mockGenerate = jest.fn();
const mockGithubUser = jest.fn();
let mockCaller = ALICE;

const matches = (row, q) => Object.entries(q).every(([k, v]) => String(row[k]) === String(v));

jest.mock('../connection.model', () => {
  const lean = (v) => ({ lean: async () => (v ? JSON.parse(JSON.stringify(v)) : v) });
  return {
    find: jest.fn((q) => lean(mockStore.filter((r) => matches(r, q)))),
    findOne: jest.fn((q) => lean(mockStore.find((r) => matches(r, q)) || null)),
    findOneAndUpdate: jest.fn((q, update) => {
      let row = mockStore.find((r) => matches(r, q));
      if (!row) { row = { _id: `c${mockStore.length + 1}`, createdAt: new Date().toISOString() }; mockStore.push(row); }
      Object.assign(row, update, { updatedAt: new Date().toISOString() });
      return lean(row);
    }),
    deleteOne: jest.fn(async (q) => {
      const i = mockStore.findIndex((r) => matches(r, q));
      if (i < 0) return { deletedCount: 0 };
      mockStore.splice(i, 1);
      return { deletedCount: 1 };
    }),
    updateOne: jest.fn(async () => ({})),
    aggregate: jest.fn(async () => {
      const counts = {};
      mockStore.filter((r) => String(r.workspaceId) === WS).forEach((r) => { counts[r.provider] = (counts[r.provider] || 0) + 1; });
      return Object.entries(counts).map(([_id, people]) => ({ _id, people }));
    }),
  };
});

jest.mock('../../../modules/conversations/cryptoUtils', () => ({
  sealSecret: (v) => `sealed:${v}`,
  openSecret: (v) => String(v).replace(/^sealed:/, ''),
}));

jest.mock('../../../identity', () => ({
  workspaces: {
    findById: jest.fn(async (id) => mockWorkspaces[String(id)] || null),
    update: jest.fn(async (id, patch) => {
      const ws = mockWorkspaces[String(id)];
      const { $merge, ...rest } = patch.settings;
      ws.settings = $merge ? { ...ws.settings, ...rest } : rest;
    }),
  },
  users: { findById: jest.fn(async () => null) },
}));

jest.mock('../../../shared/middleware/auth', () => (req, _res, next) => { req.user = { sub: mockCaller }; next(); });
jest.mock('../../../shared/adminAudit', () => ({ recordAdminAction: jest.fn(async (e) => { mockAudit.push(e); }) }));
jest.mock('../../../shared/featureFlags', () => ({ isEnabled: () => true, requireFlag: () => (_q, _s, n) => n() }));

jest.mock('../../../../../ai/providers', () => ({
  createProvider: jest.fn((name, opts) => ({ name, apiKey: opts.apiKey, generateText: mockGenerate })),
  modelsFor: () => ({ chat: 'model-chat', fast: 'model-fast' }),
}));
jest.mock('../../integrations/github/github.client', () => ({
  createClient: jest.fn((token) => ({ token, getUser: () => mockGithubUser(token), createIssue: jest.fn(async (repo, issue) => ({ number: 7, html_url: `https://github.com/${repo}/issues/7`, title: issue.title, token })) })),
  summarizeChecks: () => null,
}));
jest.mock('../../integrations/integration.model', () => ({ findOne: jest.fn(() => ({ lean: async () => null })) }));
jest.mock('../../integrations/ai-provider.model', () => ({
  find: jest.fn(() => ({ lean: async () => [] })),
  findOne: jest.fn(() => ({ lean: async () => null })),
}));

const resolver = require('../../ai/ai.provider.resolver');
const connections = require('../connections.service');

let server;
let base;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/connections', require('../connections.routes'));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  mockStore.length = 0;
  mockAudit.length = 0;
  mockGenerate.mockReset();
  mockGithubUser.mockReset();
  mockCaller = ALICE;
  resolver.invalidate();
  const members = [
    { user: ADMIN, role: 'owner', status: 'active' },
    { user: ALICE, role: 'member', status: 'active' },
    { user: BOB, role: 'member', status: 'active' },
  ];
  mockWorkspaces[WS] = { _id: WS, name: 'Acme', company: null, members, settings: {} };
  mockWorkspaces[OTHER_WS] = { _id: OTHER_WS, name: 'Other', company: null, members: [{ user: BOB, role: 'owner', status: 'active' }], settings: {} };
});

async function call(as, method, path, body) {
  mockCaller = as;
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe('connecting your own agent', () => {
  test('a member connects their own Claude: the key is checked live, sealed, never returned, and audit-logged', async () => {
    mockGenerate.mockResolvedValueOnce('OK');
    const res = await call(ALICE, 'POST', '/api/connections/agents/anthropic', { workspaceId: WS, apiKey: 'sk-ant-alice', model: 'claude-x' });
    expect(res.status).toBe(201);
    expect(res.body.connection).toMatchObject({ provider: 'anthropic', kind: 'agent', method: 'api_key', model: 'claude-x' });
    expect(JSON.stringify(res.body)).not.toContain('sk-ant-alice');
    expect(mockStore[0]).toMatchObject({ userId: ALICE, workspaceId: WS, secret: 'sealed:sk-ant-alice' });
    expect(mockAudit).toEqual([expect.objectContaining({ userId: ALICE, action: 'connection.personal_connected', details: expect.objectContaining({ provider: 'anthropic' }) })]);
    // What is written to the log (the request itself is only read for IP and user agent).
    expect(JSON.stringify(mockAudit.map(({ req: _req, ...entry }) => entry))).not.toContain('sk-ant-alice');
  });

  test('a rejected key is not saved', async () => {
    mockGenerate.mockRejectedValueOnce(Object.assign(new Error('invalid x-api-key'), { status: 401 }));
    const res = await call(ALICE, 'POST', '/api/connections/agents/openai', { workspaceId: WS, apiKey: 'sk-bad' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('AGENT_KEY_REJECTED');
    expect(mockStore).toHaveLength(0);
  });

  test('people outside the workspace get nothing', async () => {
    const res = await call(ALICE, 'GET', `/api/connections?workspaceId=${OTHER_WS}`);
    expect(res.status).toBe(403);
    expect((await call(ALICE, 'POST', '/api/connections/agents/anthropic', { workspaceId: OTHER_WS, apiKey: 'k' })).status).toBe(403);
  });
});

describe('scoping: a personal connection is only ever its owner’s', () => {
  beforeEach(async () => {
    await connections.save({ workspaceId: WS, userId: ALICE, provider: 'anthropic', method: 'api_key', secret: 'sk-ant-alice' });
  });

  test('a person only lists their own connections', async () => {
    expect((await call(ALICE, 'GET', `/api/connections?workspaceId=${WS}`)).body.connections.map((c) => c.provider)).toEqual(['anthropic']);
    expect((await call(BOB, 'GET', `/api/connections?workspaceId=${WS}`)).body.connections).toEqual([]);
  });

  test('another member cannot remove it (and learns nothing about it)', async () => {
    const res = await call(BOB, 'DELETE', `/api/connections/anthropic?workspaceId=${WS}`);
    expect(res.status).toBe(404);
    expect(mockStore).toHaveLength(1);
    // Nor can an admin: the workspace owner removes their own only.
    expect((await call(ADMIN, 'DELETE', `/api/connections/anthropic?workspaceId=${WS}`)).status).toBe(404);
    expect(mockStore).toHaveLength(1);
  });

  test('the owner removes it, and that is audit-logged', async () => {
    const res = await call(ALICE, 'DELETE', `/api/connections/anthropic?workspaceId=${WS}`);
    expect(res.status).toBe(200);
    expect(mockStore).toHaveLength(0);
    expect(mockAudit.at(-1)).toMatchObject({ userId: ALICE, action: 'connection.personal_disconnected' });
  });

  test('her key answers her requests, even with no workspace install; nobody else’s', async () => {
    const mine = await resolver.contextFor(WS, 'anthropic', ALICE);
    expect(mine).toMatchObject({ assistant: 'anthropic', keySource: 'personal' });
    expect(mine.provider.apiKey).toBe('sk-ant-alice');

    await expect(resolver.contextFor(WS, 'anthropic', BOB)).rejects.toMatchObject({ code: 'AI_ASSISTANT_NOT_CONNECTED' });
    await expect(resolver.contextFor(WS, 'anthropic')).rejects.toMatchObject({ code: 'AI_ASSISTANT_NOT_CONNECTED' });
    // Same person, another workspace: not there either.
    await expect(resolver.contextFor(OTHER_WS, 'anthropic', ALICE)).rejects.toMatchObject({ code: 'AI_ASSISTANT_NOT_CONNECTED' });
  });

  test('her own connection comes before the workspace install; others get the workspace one', async () => {
    const AIProvider = require('../../integrations/ai-provider.model');
    AIProvider.findOne.mockImplementation(() => ({ lean: async () => ({ provider: 'anthropic', status: 'active', apiKey: 'sealed:sk-ant-workspace', config: {} }) }));
    try {
      expect((await resolver.contextFor(WS, 'anthropic', ALICE)).provider.apiKey).toBe('sk-ant-alice');
      const bob = await resolver.contextFor(WS, 'anthropic', BOB);
      expect(bob).toMatchObject({ keySource: 'workspace' });
      expect(bob.provider.apiKey).toBe('sk-ant-workspace');
    } finally {
      AIProvider.findOne.mockImplementation(() => ({ lean: async () => null }));
    }
  });

  test('when admins turn personal connections off, members’ own keys stop being used; admins’ still work', async () => {
    await connections.save({ workspaceId: WS, userId: ADMIN, provider: 'anthropic', method: 'api_key', secret: 'sk-ant-admin' });
    expect((await call(ALICE, 'PUT', '/api/connections/policy', { workspaceId: WS, membersMayConnect: false })).status).toBe(403);
    const off = await call(ADMIN, 'PUT', '/api/connections/policy', { workspaceId: WS, membersMayConnect: false });
    expect(off.body.policy).toEqual({ membersMayConnect: false });
    expect(mockAudit.at(-1)).toMatchObject({ action: 'connection.policy_changed' });

    await expect(resolver.contextFor(WS, 'anthropic', ALICE)).rejects.toMatchObject({ code: 'AI_ASSISTANT_NOT_CONNECTED' });
    expect((await resolver.contextFor(WS, 'anthropic', ADMIN)).provider.apiKey).toBe('sk-ant-admin');

    const blocked = await call(ALICE, 'POST', '/api/connections/agents/openai', { workspaceId: WS, apiKey: 'sk-new' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PERSONAL_CONNECTIONS_OFF');
    // She can still remove what she had.
    expect((await call(ALICE, 'DELETE', `/api/connections/anthropic?workspaceId=${WS}`)).status).toBe(200);
  });

  test('admins see how many people use their own, without names or keys; members do not', async () => {
    const admin = await call(ADMIN, 'GET', `/api/connections?workspaceId=${WS}`);
    expect(admin.body.counts).toEqual({ anthropic: 1 });
    expect(JSON.stringify(admin.body)).not.toContain('sk-ant');
    expect((await call(BOB, 'GET', `/api/connections?workspaceId=${WS}`)).body.counts).toBeUndefined();
  });
});

describe('personal GitHub', () => {
  test('a token is checked against GitHub, then issues she creates are opened with her token', async () => {
    mockGithubUser.mockImplementation(async (token) => {
      if (token !== 'ghp_alice') throw Object.assign(new Error('bad'), { code: 'GITHUB_BAD_TOKEN' });
      return { id: 1, login: 'alice', name: 'Alice', avatar_url: 'https://a/av.png' };
    });
    const bad = await call(ALICE, 'POST', '/api/connections/github/token', { workspaceId: WS, token: 'nope' });
    expect(bad.status).toBe(400);
    const ok = await call(ALICE, 'POST', '/api/connections/github/token', { workspaceId: WS, token: 'ghp_alice' });
    expect(ok.status).toBe(201);
    expect(ok.body.connection).toMatchObject({ provider: 'github', method: 'token', account: { login: 'alice' } });

    const gh = require('../../integrations/github/github.service');
    const mine = await gh.githubClientFor(WS, ALICE);
    expect(mine.personal).toBe(true);
    expect(mine.gh.token).toBe('ghp_alice');
    // Bob has no GitHub of his own and the workspace has none: he is told it isn't connected.
    await expect(gh.githubClientFor(WS, BOB)).rejects.toMatchObject({ code: 'INTEGRATION_NOT_CONNECTED' });
  });

  test('the OAuth callback refuses a forged or missing state', async () => {
    const res = await fetch(`${base}/api/connections/github/callback?code=x&state=forged`, { redirect: 'manual' });
    expect(res.status).toBe(400);
    expect(mockStore).toHaveLength(0);
  });

  test('authorize is refused when no GitHub OAuth app is set up (no pretend sign-in)', async () => {
    const saved = { ...process.env };
    delete process.env.GITHUB_CONNECT_CLIENT_ID; delete process.env.GITHUB_CLIENT_ID;
    try {
      const res = await call(ALICE, 'POST', '/api/connections/github/authorize', { workspaceId: WS });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('GITHUB_OAUTH_NOT_CONFIGURED');
    } finally {
      process.env = saved;
    }
  });

  test('with an OAuth app, authorize returns GitHub’s own consent page with a signed state for this person', async () => {
    const saved = { ...process.env };
    Object.assign(process.env, { GITHUB_CONNECT_CLIENT_ID: 'cid', GITHUB_CONNECT_CLIENT_SECRET: 'csecret', ACCESS_TOKEN_SECRET: 'test-secret', BACKEND_URL: 'http://api.test' });
    try {
      const res = await call(ALICE, 'POST', '/api/connections/github/authorize', { workspaceId: WS });
      expect(res.status).toBe(200);
      const u = new URL(res.body.url);
      expect(u.origin + u.pathname).toBe('https://github.com/login/oauth/authorize');
      expect(u.searchParams.get('client_id')).toBe('cid');
      expect(u.searchParams.get('redirect_uri')).toBe('http://api.test/api/connections/github/callback');
      const state = require('../github.oauth').readState(u.searchParams.get('state'));
      expect(state).toMatchObject({ workspaceId: WS, userId: ALICE });
    } finally {
      process.env = saved;
    }
  });
});
