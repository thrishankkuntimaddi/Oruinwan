'use strict';

const express = require('express');
const http = require('http');

const mockWs = '64b000000000000000000001';
const PUBCH = '64b0000000000000000000e1';
const PRIVCH = '64b0000000000000000000e2';
const mockAlice = '64b0000000000000000000a1';

const mockKeys = {
  all: { _id: 'k1', workspaceId: mockWs, keyPrefix: 'chx_all', createdBy: mockAlice, permissions: ['*'] },
  readonly: { _id: 'k2', workspaceId: mockWs, keyPrefix: 'chx_ro', createdBy: mockAlice, permissions: ['tasks:read'] },
};

jest.mock('../apiKey.model', () => ({
  hashKey: (raw) => raw,
  findOne: jest.fn((q) => ({ lean: async () => mockKeys[q.keyHash] || null })),
  findByIdAndUpdate: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../../models/Workspace', () => ({
  findOne: jest.fn(() => ({ select: () => ({ lean: async () => ({ _id: '64b000000000000000000001' }) }) })),
  findById: jest.fn(() => ({ populate: () => ({ lean: async () => ({ members: [
    { user: { _id: 'u1', username: 'alice', email: 'a@x' }, role: 'owner', status: 'active' },
    { user: { _id: 'u2', username: 'gone' }, role: 'member', status: 'removed' },
  ] }) }) })),
}));

const mockChannelFind = jest.fn();
jest.mock('../../channels/channel.model', () => ({ find: (...a) => mockChannelFind(...a) }));
const mockMessageFind = jest.fn();
jest.mock('../../../modules/messages/message.model', () => ({ find: (...a) => mockMessageFind(...a) }));
const mockTaskFind = jest.fn();
jest.mock('../../../../models/Task', () => ({ find: (...a) => mockTaskFind(...a) }));
const mockFileFind = jest.fn();
jest.mock('../../files/WorkspaceFile', () => ({ find: (...a) => mockFileFind(...a) }));
jest.mock('../../tasks/tasks.service', () => ({
  createTask: jest.fn(async (userId, data) => ({ tasks: [{ _id: 't1', title: data.title, workspace: data.workspaceId }] })),
}));
jest.mock('../../integrations/webhook.trigger', () => ({ fire: jest.fn() }));

const tasksService = require('../../tasks/tasks.service');
const router = require('../publicApi.routes');

function chain(result) {
  const c = {};
  ['sort', 'limit', 'select', 'populate'].forEach(m => { c[m] = jest.fn(() => c); });
  c.lean = jest.fn(async () => result);
  return c;
}

function call(method, path, key, body) {
  const app = express();
  app.use(express.json());
  app.use('/api/public', router);
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const data = body ? JSON.stringify(body) : null;
      const headers = { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}), ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) };
      const req = http.request({ port: server.address().port, path, method, headers }, (res) => {
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
  mockChannelFind.mockImplementation(() => chain([{ _id: PUBCH, name: 'general', members: [{}, {}] }]));
});

describe('public API', () => {
  test('missing / invalid key → 401 { message }', async () => {
    const r1 = await call('GET', '/api/public/tasks');
    expect(r1.status).toBe(401);
    expect(r1.body).toHaveProperty('message');
    expect((await call('GET', '/api/public/tasks', 'nope')).status).toBe(401);
  });

  test('scopes are enforced on every route', async () => {
    for (const p of ['/messages', '/files', '/users', '/channels']) {
      const r = await call('GET', `/api/public${p}`, 'readonly');
      expect(r.status).toBe(403);
      expect(r.body.message).toMatch(/permission/);
    }
    expect((await call('POST', '/api/public/tasks', 'readonly', { title: 'x' })).status).toBe(403);
  });

  test('GET /tasks queries by workspace and excludes deleted', async () => {
    const c = chain([{ _id: 't1' }]);
    mockTaskFind.mockReturnValue(c);
    const r = await call('GET', '/api/public/tasks?status=todo', 'readonly');
    expect(r.status).toBe(200);
    expect(mockTaskFind).toHaveBeenCalledWith({ workspace: mockWs, deleted: { $ne: true }, status: 'todo' });
    expect(c.populate).toHaveBeenCalledWith('assignedTo', 'username');
    expect((await call('GET', '/api/public/tasks?status=bogus', 'readonly')).status).toBe(400);
  });

  test('POST /tasks creates through the tasks service as the key creator', async () => {
    const r = await call('POST', '/api/public/tasks', 'all', { title: ' Ship it ', priority: 'high' });
    expect(r.status).toBe(201);
    expect(r.body.task._id).toBe('t1');
    expect(tasksService.createTask).toHaveBeenCalledWith(mockAlice, expect.objectContaining({
      workspaceId: mockWs, title: 'Ship it', priority: 'high', assignmentType: 'self',
    }), null, expect.anything());
    expect((await call('POST', '/api/public/tasks', 'all', {})).status).toBe(400);
    expect((await call('POST', '/api/public/tasks', 'all', { title: 'x', priority: 'urgent' })).status).toBe(400);
    expect((await call('POST', '/api/public/tasks', 'all', { title: 'x', assigneeIds: ['bad'] })).status).toBe(400);
  });

  test('POST /tasks maps service 4xx errors', async () => {
    tasksService.createTask.mockRejectedValueOnce(Object.assign(new Error('You are not a member of this workspace'), { statusCode: 403 }));
    const r = await call('POST', '/api/public/tasks', 'all', { title: 'x' });
    expect(r.status).toBe(403);
    expect(r.body.message).toMatch(/member/);
  });

  test('GET /messages returns metadata only from public channels', async () => {
    mockMessageFind.mockReturnValue(chain([{ _id: 'm1', channel: PUBCH, sender: { _id: 'u1', username: 'alice' }, type: 'message', payload: { isEncrypted: true, ciphertext: 'SECRET' } }]));
    const r = await call('GET', '/api/public/messages', 'all');
    expect(r.status).toBe(200);
    const q = mockMessageFind.mock.calls[0][0];
    expect(q.channel).toEqual({ $in: [PUBCH] });
    expect(q.isDeleted).toEqual({ $ne: true });
    expect(JSON.stringify(r.body)).not.toContain('SECRET');
    expect(r.body.messages[0]).toMatchObject({ id: 'm1', channelId: PUBCH, isEncrypted: true });
    expect((await call('GET', `/api/public/messages?channelId=${PRIVCH}`, 'all')).status).toBe(404);
    expect((await call('GET', '/api/public/messages?channelId=zzz', 'all')).status).toBe(400);
  });

  test('GET /files excludes deleted; GET /channels excludes private; GET /users only active', async () => {
    mockFileFind.mockReturnValue(chain([]));
    expect((await call('GET', '/api/public/files', 'all')).status).toBe(200);
    expect(mockFileFind).toHaveBeenCalledWith({ workspaceId: mockWs, isDeleted: { $ne: true } });

    const ch = await call('GET', '/api/public/channels', 'all');
    expect(ch.status).toBe(200);
    expect(mockChannelFind).toHaveBeenLastCalledWith(expect.objectContaining({ isPrivate: { $ne: true } }));
    expect(ch.body.channels[0].membersCount).toBe(2);

    const u = await call('GET', '/api/public/users', 'all');
    expect(u.body.users.map(x => x.username)).toEqual(['alice']);
    expect(u.body.users[0]).not.toHaveProperty('email');
  });
});
