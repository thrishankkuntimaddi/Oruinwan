'use strict';

const express = require('express');
const http = require('http');

const WS = '64b000000000000000000001';
const OTHER_WS = '64b000000000000000000002';
const ALICE = '64b0000000000000000000a1'; // owner
const BOB = '64b0000000000000000000b1';   // member
const CAROL = '64b0000000000000000000c1'; // not a member
const APP = '64b0000000000000000000d1';
const KEY = '64b0000000000000000000e1';
const BOT = '64b0000000000000000000f1';
const CH = '64b000000000000000000011';

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
  if (!req.headers['x-user']) return res.status(401).json({ message: 'auth' });
  req.user = { sub: req.headers['x-user'] };
  next();
});

const workspaces = {
  '64b000000000000000000001': {
    _id: '64b000000000000000000001',
    members: [
      { user: '64b0000000000000000000a1', role: 'owner', status: 'active' },
      { user: '64b0000000000000000000b1', role: 'member', status: 'active' },
    ],
  },
  '64b000000000000000000002': {
    _id: '64b000000000000000000002',
    members: [{ user: '64b0000000000000000000c1', role: 'owner', status: 'active' }],
  },
};
// Workspaces and members live in PostgreSQL; the repositories are mocked.
jest.mock('../../../identity/workspaces.repo', () => ({
  ...jest.requireActual('../../../identity/workspaces.repo'),
  findById: jest.fn(async (id) => workspaces[String(id)] || null),
  findManyByIds: jest.fn(async (ids) => ids.map((id) => workspaces[String(id)]).filter(Boolean)),
  memberWorkspaceIds: jest.fn(async (userId) => Object.values(workspaces)
    .filter((w) => w.members.some((m) => m.user === String(userId) && m.status === 'active')).map((w) => w._id)),
}));
jest.mock('../../../identity/users.repo', () => ({
  ...jest.requireActual('../../../identity/users.repo'),
  findManyByIds: jest.fn(async (ids) => new Map(ids.map((id) => [id, { _id: id, username: `user-${id.slice(-2)}` }]))),
}));

function mockChain(result) {
  const q = {};
  ['select', 'sort', 'skip', 'limit', 'populate'].forEach(k => { q[k] = jest.fn(() => q); });
  q.lean = jest.fn(async () => result);
  q.then = (res, rej) => Promise.resolve(result).then(res, rej);
  return q;
}

const appDoc = () => ({ _id: '64b0000000000000000000d1', name: 'Poll', isPublished: true, installedIn: ['64b000000000000000000002'] });
jest.mock('../app.model', () => ({
  find: jest.fn(), findById: jest.fn(), countDocuments: jest.fn(async () => 1), updateOne: jest.fn(async () => ({})),
}));
jest.mock('../../community/AppReview.model', () => ({ aggregate: jest.fn(async () => []) }));

const mockKeys = {};
jest.mock('../apiKey.model', () => {
  const real = jest.requireActual('../apiKey.model');
  return {
    schema: real.schema,
    generateKey: real.generateKey,
    find: jest.fn(() => mockChain([])),
    create: jest.fn(async (d) => ({ _id: 'newkey', ...d })),
    findById: jest.fn((id) => {
      const doc = mockKeys[String(id)] || null;
      const p = Promise.resolve(doc);
      p.select = () => ({ lean: async () => doc });
      return p;
    }),
  };
});

const mockBots = {};
jest.mock('../bot.model', () => {
  const real = jest.requireActual('../bot.model');
  return {
    schema: real.schema,
    generateToken: real.generateToken,
    find: jest.fn(() => mockChain([])),
    create: jest.fn(async (d) => ({ _id: 'newbot', ...d })),
    findById: jest.fn((id) => {
      const doc = mockBots[String(id)] || null;
      const p = Promise.resolve(doc);
      p.select = () => ({ lean: async () => doc });
      return p;
    }),
    updateOne: jest.fn(async () => ({})),
  };
});

jest.mock('../../channels/channel.model', () => ({ findOne: jest.fn() }));
jest.mock('../../../modules/conversations/cryptoUtils', () => ({
  encryptForConversation: jest.fn(async () => ({ ciphertext: 'CT', messageIv: 'IV' })),
}));
jest.mock('../../../modules/messages/messages.service', () => ({
  createMessage: jest.fn(async () => ({ _id: 'msg1' })),
}));
jest.mock('../../../socket/getIO', () => ({ getIO: () => null }));

const App = require('../app.model');
const Channel = require('../../channels/channel.model');
const messagesService = require('../../../modules/messages/messages.service');
const cryptoUtils = require('../../../modules/conversations/cryptoUtils');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/marketplace', require('../../community/marketplace.routes'));
  app.use('/api/developer', require('../apiKeys.routes'));
  app.use('/api/developer', require('../bots.routes'));
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

beforeEach(() => {
  App.find.mockImplementation(() => mockChain([appDoc()]));
  App.findById.mockImplementation(() => { const d = appDoc(); const p = Promise.resolve(d); p.select = () => Promise.resolve(d); return p; });
  for (const k of Object.keys(mockKeys)) delete mockKeys[k];
  for (const k of Object.keys(mockBots)) delete mockBots[k];
});

describe('marketplace (M1/M2)', () => {
  test('lists apps with installed flag and never installedIn', async () => {
    const res = await call('GET', `/api/marketplace/apps?workspaceId=${OTHER_WS}`, CAROL);
    expect(res.status).toBe(200);
    expect(res.body.apps[0].installed).toBe(true);
    expect(res.body.apps[0]).not.toHaveProperty('installedIn');
    const mine = await call('GET', `/api/marketplace/apps?workspaceId=${WS}`, BOB);
    expect(mine.body.apps[0].installed).toBe(false);
  });
  test('workspace-scoped list requires membership', async () => {
    expect((await call('GET', `/api/marketplace/apps?workspaceId=${WS}`, CAROL)).status).toBe(403);
    expect((await call('GET', `/api/marketplace/apps?workspaceId=bad`, CAROL)).status).toBe(400);
  });
  test('q is escaped', async () => {
    const res = await call('GET', '/api/marketplace/apps?q=(', null);
    expect(res.status).toBe(200);
    expect(App.find.mock.calls[0][0].$or[0].name.source).toBe('\\(');
  });
  test('install/uninstall need workspace admin', async () => {
    expect((await call('POST', '/api/marketplace/install', BOB, { appId: APP, workspaceId: WS })).status).toBe(403);
    expect((await call('POST', '/api/marketplace/install', CAROL, { appId: APP, workspaceId: WS })).status).toBe(403);
    const ok = await call('POST', '/api/marketplace/install', ALICE, { appId: APP, workspaceId: WS });
    expect(ok.status).toBe(200);
    expect(App.updateOne).toHaveBeenCalledWith({ _id: APP }, { $addToSet: { installedIn: WS } });
    expect((await call('POST', '/api/marketplace/uninstall', BOB, { appId: APP, workspaceId: OTHER_WS })).status).toBe(403);
    expect((await call('POST', '/api/marketplace/uninstall', ALICE, { appId: APP, workspaceId: WS })).status).toBe(404); // not installed there
    expect((await call('POST', '/api/marketplace/uninstall', CAROL, { appId: APP, workspaceId: OTHER_WS })).status).toBe(200);
    expect((await call('POST', '/api/marketplace/install', ALICE, { appId: 'bad', workspaceId: WS })).status).toBe(400);
  });
  test('developer apps endpoints: gated and no installedIn', async () => {
    const list = await call('GET', `/api/developer/apps?workspaceId=${WS}`, BOB);
    expect(list.status).toBe(200);
    expect(list.body.apps[0]).not.toHaveProperty('installedIn');
    expect((await call('GET', `/api/developer/apps?workspaceId=${WS}`, CAROL)).status).toBe(403);
    expect((await call('POST', `/api/developer/apps/${APP}/install`, BOB, { workspaceId: WS })).status).toBe(403);
    expect((await call('POST', `/api/developer/apps/${APP}/install`, ALICE, { workspaceId: WS })).status).toBe(200);
    expect((await call('DELETE', `/api/developer/apps/${APP}/uninstall`, BOB, { workspaceId: OTHER_WS })).status).toBe(403);
  });
});

describe('API keys (D1)', () => {
  test('list/create require workspace admin', async () => {
    expect((await call('GET', `/api/developer/api-keys?workspaceId=${WS}`, CAROL)).status).toBe(403);
    expect((await call('GET', `/api/developer/api-keys?workspaceId=${WS}`, BOB)).status).toBe(403);
    expect((await call('GET', `/api/developer/api-keys?workspaceId=${WS}`, ALICE)).status).toBe(200);
    expect((await call('POST', '/api/developer/api-keys', BOB, { workspaceId: WS, name: 'k' })).status).toBe(403);
    const created = await call('POST', '/api/developer/api-keys', ALICE, { workspaceId: WS, name: 'k' });
    expect(created.status).toBe(201);
    expect(created.body.rawKey).toMatch(/^chx_/);
    expect((await call('POST', '/api/developer/api-keys', ALICE, { workspaceId: WS, name: 'k', permissions: ['root'] })).status).toBe(400);
  });
  test('revoke checks the key\'s own workspace', async () => {
    const save = jest.fn();
    mockKeys[KEY] = { _id: KEY, workspaceId: OTHER_WS, isActive: true, save };
    // Alice is owner of WS but not of the key's workspace.
    expect((await call('DELETE', `/api/developer/api-keys/${KEY}`, ALICE)).status).toBe(403);
    expect((await call('DELETE', `/api/developer/api-keys/${KEY}?workspaceId=${WS}`, CAROL)).status).toBe(404);
    expect((await call('DELETE', '/api/developer/api-keys/bad', CAROL)).status).toBe(400);
    expect(save).not.toHaveBeenCalled();
    expect((await call('DELETE', `/api/developer/api-keys/${KEY}`, CAROL)).status).toBe(200);
    expect(save).toHaveBeenCalled();
  });
});

describe('Bots (D2)', () => {
  test('list/create require workspace admin', async () => {
    expect((await call('GET', `/api/developer/bots?workspaceId=${WS}`, BOB)).status).toBe(403);
    expect((await call('GET', `/api/developer/bots?workspaceId=${WS}`, CAROL)).status).toBe(403);
    expect((await call('POST', '/api/developer/bots', BOB, { workspaceId: WS, name: 'b' })).status).toBe(403);
    expect((await call('POST', '/api/developer/bots', ALICE, { workspaceId: WS, name: 'b' })).status).toBe(201);
  });
  test('test message: only into the bot\'s workspace channels, encrypted', async () => {
    mockBots[BOT] = { _id: BOT, name: 'Helper', workspaceId: WS, isActive: true, permissions: ['messages:write'], save: jest.fn() };
    Channel.findOne.mockImplementation((q) => ({ select: () => ({ lean: async () => (String(q._id) === CH && String(q.workspace) === WS ? { _id: CH, workspace: WS } : null) }) }));

    expect((await call('POST', `/api/developer/bots/${BOT}/message`, BOB, { channelId: CH, text: 'hi' })).status).toBe(403);
    expect((await call('POST', `/api/developer/bots/${BOT}/message`, CAROL, { channelId: CH, text: 'hi' })).status).toBe(403);
    expect((await call('POST', `/api/developer/bots/${BOT}/message`, ALICE, { channelId: '64b000000000000000000099', text: 'hi' })).status).toBe(404);
    expect((await call('POST', `/api/developer/bots/${BOT}/message`, ALICE, { channelId: 'x', text: 'hi' })).status).toBe(400);
    expect((await call('POST', `/api/developer/bots/${BOT}/message`, ALICE, { channelId: CH })).status).toBe(400);

    const ok = await call('POST', `/api/developer/bots/${BOT}/message`, ALICE, { channelId: CH, text: 'hi' });
    expect(ok.status).toBe(201);
    expect(ok.body.messageId).toBe('msg1');
    expect(cryptoUtils.encryptForConversation).toHaveBeenCalledWith(CH, 'channel', expect.stringContaining('Helper'));
    expect(messagesService.createMessage.mock.calls[0][0]).toMatchObject({ type: 'message', channel: CH, ciphertext: 'CT', messageIv: 'IV', sender: ALICE });
  });
  test('test message: clear 400 when the channel key is unavailable', async () => {
    mockBots[BOT] = { _id: BOT, name: 'Helper', workspaceId: WS, isActive: true, permissions: ['*'] };
    Channel.findOne.mockImplementation(() => ({ select: () => ({ lean: async () => ({ _id: CH, workspace: WS }) }) }));
    cryptoUtils.encryptForConversation.mockRejectedValueOnce(new Error('no key'));
    const res = await call('POST', `/api/developer/bots/${BOT}/message`, ALICE, { channelId: CH, text: 'hi' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/encryption key/);
  });
  test('delete bot requires admin of the bot\'s workspace', async () => {
    const save = jest.fn();
    mockBots[BOT] = { _id: BOT, name: 'Helper', workspaceId: WS, isActive: true, save };
    expect((await call('DELETE', `/api/developer/bots/${BOT}`, CAROL)).status).toBe(403);
    expect((await call('DELETE', `/api/developer/bots/${BOT}`, BOB)).status).toBe(403);
    expect((await call('DELETE', `/api/developer/bots/${BOT}`, ALICE)).status).toBe(200);
    expect(save).toHaveBeenCalled();
  });
});
