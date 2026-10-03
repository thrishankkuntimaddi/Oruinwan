'use strict';

const express = require('express');
const http = require('http');

const WS = '64b000000000000000000001';
const ALICE = '64b0000000000000000000a1';
const BOB = '64b0000000000000000000b1';
const CAROL = '64b0000000000000000000c1';

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
  req.user = { sub: req.headers['x-user'] };
  next();
});
jest.mock('../../../../../ai/api/ai.gateway', () => ({ rerank: jest.fn(async () => ({ scores: {} })) }));

const workspaceDoc = {
  _id: '64b000000000000000000001',
  members: [
    { user: '64b0000000000000000000a1', role: 'owner', status: 'active' },
    { user: '64b0000000000000000000b1', role: 'member', status: 'active' },
  ],
};
// Identity is in PostgreSQL: workspace + membership come from the repositories.
jest.mock('../../../identity', () => {
  const ws = () => ({ ...workspaceDoc, company: null });
  const membership = async (_id, userId) => {
    const member = workspaceDoc.members.find(m => m.user === String(userId) && m.status === 'active') || null;
    return { workspace: ws(), member, role: member?.role || null, isAdmin: member?.role === 'owner' };
  };
  return {
    workspaces: { findById: jest.fn(async () => ws()), membership: jest.fn(membership), memberWorkspaceIds: jest.fn(async () => [workspaceDoc._id]) },
    users: { findManyByIds: jest.fn(async () => new Map()), findById: jest.fn(async () => null) },
  };
});
jest.mock('../../../identity/queries/workspaces', () => ({ searchPeople: jest.fn(async () => []) }));
jest.mock('../../../../models/Workspace', () => ({
  findOne: jest.fn(() => ({ select: () => ({ lean: async () => workspaceDoc }) })),
  findById: jest.fn(() => ({ select: () => ({ lean: async () => workspaceDoc }) })),
}));

// Chainable query mock that records the filter passed to find().
function chain(result = []) {
  const q = {};
  ['select', 'sort', 'skip', 'limit', 'populate'].forEach(k => { q[k] = jest.fn(() => q); });
  q.lean = jest.fn(async () => result);
  return q;
}
jest.mock('../../channels/channel.model.js', () => ({ find: jest.fn() }));
jest.mock('../../../../models/DMSession', () => ({ find: jest.fn() }));
jest.mock('../../../modules/messages/message.model.js', () => ({ find: jest.fn() }));
jest.mock('../../../../models/User', () => ({ find: jest.fn() }));
jest.mock('../../../../models/Task', () => ({ find: jest.fn() }));
jest.mock('../../../../models/Note', () => ({ find: jest.fn() }));
jest.mock('../../files/WorkspaceFile', () => ({ find: jest.fn() }));
jest.mock('../../knowledge/KnowledgePage', () => ({ find: jest.fn() }));

const Channel = require('../../channels/channel.model.js');
const DMSession = require('../../../../models/DMSession');
const Message = require('../../../modules/messages/message.model.js');
const User = require('../../../../models/User');
const wsQueries = require('../../../identity/queries/workspaces');
const Task = require('../../../../models/Task');
const Note = require('../../../../models/Note');
const WorkspaceFile = require('../../files/WorkspaceFile');
const KnowledgePage = require('../../knowledge/KnowledgePage');
const gateway = require('../../../../../ai/api/ai.gateway');

const router = require('../search.routes');
const searchSvc = require('../search.service');

function call(path, userId) {
  const app = express();
  app.use('/api/search', router);
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      http.get({ port: server.address().port, path, headers: { 'x-user': userId } }, (res) => {
        let text = '';
        res.on('data', (c) => { text += c; });
        res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); });
      }).on('error', (e) => { server.close(); reject(e); });
    });
  });
}

beforeEach(() => {
  Channel.find.mockImplementation(() => chain([{ _id: 'ch1' }]));
  DMSession.find.mockImplementation(() => chain([{ _id: 'dm1' }]));
  Message.find.mockImplementation(() => chain([]));
  User.find.mockImplementation(() => chain([]));
  Task.find.mockImplementation(() => chain([]));
  Note.find.mockImplementation(() => chain([]));
  WorkspaceFile.find.mockImplementation(() => chain([]));
  KnowledgePage.find.mockImplementation(() => chain([]));
});

describe('search access control (S1)', () => {
  const paths = [
    `/api/search?workspaceId=${WS}&q=hi`,
    `/api/search/universal?workspaceId=${WS}&query=hi`,
    `/api/search/contacts?workspaceId=${WS}&query=hi`,
  ];
  test.each(paths)('non-member gets 403 on %s', async (p) => {
    const res = await call(p, CAROL);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('message');
  });
  test.each(paths)('malformed workspaceId gets 400 on %s', async (p) => {
    const res = await call(p.replace(WS, 'not-an-id'), ALICE);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });
  test.each(paths)('member gets 200 on %s', async (p) => {
    const res = await call(p, BOB);
    expect(res.status).toBe(200);
  });
});

describe('regex escaping (S2)', () => {
  test('universal and contacts do not blow up on regex metacharacters', async () => {
    for (const p of [`/api/search/universal?workspaceId=${WS}&query=(`, `/api/search/contacts?workspaceId=${WS}&query=a[`]) {
      const res = await call(p, ALICE);
      expect(res.status).toBe(200);
    }
    // People search runs in PostgreSQL with the unescaped term (bound as a parameter).
    const [, , text] = wsQueries.searchPeople.mock.calls[0];
    expect(text).toBe('(');
    expect(User.find).not.toHaveBeenCalled();
  });
});

describe('message visibility is applied in the query (S3)', () => {
  test('filters deleted/hidden messages and scopes to member channels/DMs before paginating', async () => {
    await searchSvc.searchMessages(WS, ALICE, /x/i, { limit: 5, offset: 10 });
    const q = Message.find.mock.calls[0][0];
    expect(q.isDeleted).toEqual({ $ne: true });
    expect(q.isDeletedUniversally).toEqual({ $ne: true });
    expect(q.hiddenFor).toEqual({ $ne: ALICE });
    expect(q.deletedFor).toEqual({ $ne: ALICE });
    expect(q.$or).toEqual([{ channel: { $in: ['ch1'] } }, { dm: { $in: ['dm1'] } }]);
    expect(Channel.find.mock.calls[0][0]).toMatchObject({ workspace: WS, 'members.user': ALICE });
  });
  test('channelId outside the caller\'s channels yields an empty scope', async () => {
    await searchSvc.searchMessages(WS, ALICE, /x/i, { channelId: '64b0000000000000000000ff' });
    const q = Message.find.mock.calls[0][0];
    expect(q.$or).toEqual([{ channel: { $in: [] } }]);
  });
  test('channel tasks limited to caller\'s channels', async () => {
    await searchSvc.searchTasks(WS, ALICE, /x/i, {});
    const q = Task.find.mock.calls[0][0];
    expect(q.$and[0].$or).toContainEqual({ visibility: 'channel', channel: { $in: ['ch1'] } });
    expect(q.deletedFor).toEqual({ $ne: ALICE });
  });
});

describe('semantic flag (S4)', () => {
  const many = Array.from({ length: 5 }, (_, i) => ({ _id: `f${i}`, name: `file ${i}`, createdBy: null }));
  test('semantic=false skips AI re-ranking; default runs it', async () => {
    WorkspaceFile.find.mockImplementation(() => chain(many));
    await call(`/api/search?workspaceId=${WS}&q=file&semantic=false`, ALICE);
    expect(gateway.rerank).not.toHaveBeenCalled();
    await call(`/api/search?workspaceId=${WS}&q=file`, ALICE);
    expect(gateway.rerank).toHaveBeenCalled();
  });
});
