'use strict';

const express = require('express');

const mockRecords = [];
const mockGenerate = jest.fn();
let mockIsAdmin = true;

jest.mock('../../../shared/middleware/auth', () => (req, _res, next) => { req.user = { sub: '64b000000000000000000001' }; next(); });
jest.mock('../../ai/ai.access', () => ({
  requireAIAccess: ({ adminOnly } = {}) => (req, res, next) => {
    if (adminOnly && !mockIsAdmin) return res.status(403).json({ message: 'Admins only' });
    req.aiWorkspace = { id: '64b0000000000000000000aa', isAdmin: mockIsAdmin, role: mockIsAdmin ? 'owner' : 'member' };
    return next();
  },
}));
jest.mock('../../integrations/ai-provider.model', () => ({
  find: jest.fn(() => ({ lean: async () => mockRecords.filter((r) => r.status === 'active') })),
  findOne: jest.fn((q) => ({ lean: async () => mockRecords.find((r) => r.status === 'active' && q.provider.$in.includes(r.provider)) || null })),
}));
jest.mock('../../integrations/ai-provider.service', () => ({
  connectProvider: jest.fn(async ({ provider, config }) => { mockRecords.push({ provider, status: 'active', config }); }),
  disconnectProvider: jest.fn(async ({ provider }) => { mockRecords.forEach((r) => { if (r.provider === provider) r.status = 'inactive'; }); }),
}));
const mockMine = [];
jest.mock('../../connections/connection.model', () => ({
  find: jest.fn(() => ({ lean: async () => mockMine })),
  findOne: jest.fn((q) => ({ lean: async () => mockMine.find((c) => c.provider === q.provider) || null })),
  updateOne: jest.fn(async () => ({})),
}));
jest.mock('../../../identity', () => ({
  workspaces: { findById: jest.fn(async () => ({ _id: '64b0000000000000000000aa', settings: {}, members: [{ user: '64b000000000000000000001', role: mockIsAdmin ? 'owner' : 'member', status: 'active' }] })) },
}));
jest.mock('../../connections/connections.audit', () => ({ record: jest.fn(async () => {}) }));
jest.mock('../../../modules/conversations/cryptoUtils', () => ({ openSecret: (v) => v, sealSecret: (v) => v }));
jest.mock('../../../../../ai/providers', () => ({
  createProvider: jest.fn(() => ({ generateText: mockGenerate })),
  modelsFor: () => ({ chat: 'model-chat', fast: 'model-fast' }),
}));

const aiProviderService = require('../../integrations/ai-provider.service');

let server;
let base;
beforeAll(async () => {
  const a = express();
  a.use(express.json());
  a.use('/api/agents', require('../agents.routes'));
  await new Promise((resolve) => { server = a.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

async function call(method, path, body) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => null) };
}

beforeEach(() => {
  mockRecords.length = 0;
  mockMine.length = 0;
  mockGenerate.mockReset();
  mockIsAdmin = true;
  jest.clearAllMocks();
});

test('the directory lists Oruinwan AI as built in and the outside agents as not installed', async () => {
  const res = await call('GET', '/api/agents?workspaceId=x');
  expect(res.status).toBe(200);
  const byId = Object.fromEntries(res.body.agents.map((a) => [a.id, a]));
  expect(byId.default.installed).toBe(true);
  expect(byId.anthropic).toMatchObject({ name: 'Claude', installed: false, icon: '/icons/ai/anthropic.svg' });
  expect(byId.anthropic.authorization.keysUrl).toMatch(/anthropic/);
  expect(byId.anthropic.authorization.keyPattern).toBeUndefined();
  expect(res.body.tools.map((t) => t.id)).toContain('github');
});

test('installing checks the key with a live request first and saves it only when it works', async () => {
  mockGenerate.mockResolvedValueOnce('OK');
  const ok = await call('POST', '/api/agents/install', { workspaceId: 'x', agentId: 'anthropic', apiKey: 'sk-ant-good' });
  expect(ok.status).toBe(201);
  expect(aiProviderService.connectProvider).toHaveBeenCalledWith(expect.objectContaining({ provider: 'anthropic', apiKey: 'sk-ant-good' }));

  mockGenerate.mockRejectedValueOnce(Object.assign(new Error('invalid x-api-key'), { status: 401 }));
  const bad = await call('POST', '/api/agents/install', { workspaceId: 'x', agentId: 'openai', apiKey: 'sk-bad' });
  expect(bad.status).toBe(400);
  expect(bad.body.message).toMatch(/not accepted/);
  expect(aiProviderService.connectProvider).toHaveBeenCalledTimes(1);
});

test('only admins install or remove agents', async () => {
  mockIsAdmin = false;
  expect((await call('POST', '/api/agents/install', { workspaceId: 'x', agentId: 'anthropic', apiKey: 'k' })).status).toBe(403);
  expect((await call('DELETE', '/api/agents/anthropic?workspaceId=x')).status).toBe(403);
});

test('a member who connected their own Claude sees it as theirs and in use, and can chat with it', async () => {
  mockIsAdmin = false;
  mockMine.push({ provider: 'anthropic', kind: 'agent', method: 'api_key', secret: 'sk-ant-mine', config: { model: 'claude-mine' } });
  const res = await call('GET', '/api/agents?workspaceId=x');
  const claude = res.body.agents.find((a) => a.id === 'anthropic');
  expect(claude).toMatchObject({ installed: true, installedForWorkspace: false, inUse: 'personal', model: 'claude-mine', connectedForYou: { method: 'api_key', model: 'claude-mine' } });
  expect(JSON.stringify(res.body)).not.toContain('sk-ant-mine');
  expect(res.body.policy).toEqual({ membersMayConnect: true, canConnectOwn: true });
  expect(res.body.agents.find((a) => a.id === 'openai')).toMatchObject({ installed: false, inUse: null, connectedForYou: null });
});

test('a chat with an agent that is not installed says so', async () => {
  const res = await call('POST', '/api/agents/xai/dm', { workspaceId: 'x' });
  expect(res.status).toBe(400);
  expect(res.body.code).toBe('AGENT_NOT_INSTALLED');
});
