'use strict';

const WS = '64b000000000000000000001';
const ALICE = '64b0000000000000000000a1';
const SAM = '64b0000000000000000000c5';

jest.mock('../../../../../ai/api/ai.gateway', () => ({ rerank: jest.fn(async () => ({ scores: {} })) }));
jest.mock('../../../identity', () => ({
  workspaces: { findById: jest.fn(async () => ({ _id: '64b000000000000000000001', members: [] })) },
  users: {
    findManyByIds: jest.fn(async () => new Map()),
    findById: jest.fn(async () => null),
    findByUsername: jest.fn(async (name) => (name === 'sam' ? { _id: '64b0000000000000000000c5' } : null)),
  },
}));
jest.mock('../../../identity/queries/workspaces', () => ({ searchPeople: jest.fn(async () => []) }));

function chain(result = []) {
  const q = {};
  ['select', 'sort', 'skip', 'limit', 'populate'].forEach(k => { q[k] = jest.fn(() => q); });
  q.lean = jest.fn(async () => result);
  return q;
}
jest.mock('../../channels/channel.model.js', () => ({ find: jest.fn() }));
jest.mock('../../../../models/DMSession', () => ({ find: jest.fn() }));
jest.mock('../../../modules/messages/message.model.js', () => ({ find: jest.fn() }));
jest.mock('../../../../models/Task', () => ({ find: jest.fn() }));
jest.mock('../../../../models/Note', () => ({ find: jest.fn() }));
jest.mock('../../files/WorkspaceFile', () => ({ find: jest.fn() }));
jest.mock('../../knowledge/KnowledgePage', () => ({ find: jest.fn() }));

const Channel = require('../../channels/channel.model.js');
const DMSession = require('../../../../models/DMSession');
const Message = require('../../../modules/messages/message.model.js');
const Task = require('../../../../models/Task');
const Note = require('../../../../models/Note');
const WorkspaceFile = require('../../files/WorkspaceFile');
const KnowledgePage = require('../../knowledge/KnowledgePage');
const wsQueries = require('../../../identity/queries/workspaces');
const gateway = require('../../../../../ai/api/ai.gateway');
const svc = require('../search.service');

const isResolve = (q) => !!(q.$or && q.$or[0] && q.$or[0].name instanceof RegExp && q.$or[0].name.source.startsWith('^'));

// Channel.find is used for scopes (members.user) and in:#name resolution ($or of names).
beforeEach(() => {
  jest.clearAllMocks();
  Channel.find.mockImplementation((q) => {
    if (isResolve(q)) return chain([{ _id: 'chEng' }]);
    if (q['members.user']) return chain([{ _id: 'chEng' }, { _id: 'chOther' }]);
    return chain([]);
  });
  DMSession.find.mockImplementation(() => chain([{ _id: 'dm1' }]));
  Message.find.mockImplementation(() => chain([]));
  Task.find.mockImplementation(() => chain([]));
  Note.find.mockImplementation(() => chain([]));
  WorkspaceFile.find.mockImplementation(() => chain([]));
  KnowledgePage.find.mockImplementation(() => chain([]));
});

const flat = (q) => JSON.stringify(q, (k, v) => (v instanceof RegExp ? `RE:${v.source}` : v));

describe('searchAll applies query syntax', () => {
  test('plain text behaves as before (all kinds, text $or)', async () => {
    const res = await svc.searchAll({ query: 'budget', workspaceId: WS, userId: ALICE, semantic: false });
    expect(res.syntax).toEqual({ text: 'budget', filters: expect.any(Object), warnings: [] });
    expect(Task.find.mock.calls[0][0].$or).toEqual([{ title: /budget/i }, { description: /budget/i }, { tags: /budget/i }]);
    expect(Message.find.mock.calls[0][0].text).toEqual(/budget/i);
    expect(wsQueries.searchPeople).toHaveBeenCalled();
  });

  test('operators only (no text) still searches, with no text clause', async () => {
    const res = await svc.searchAll({ query: 'from:me type:task', workspaceId: WS, userId: ALICE });
    expect(res.total).toBe(0);
    expect(Task.find).toHaveBeenCalledTimes(1);
    const q = Task.find.mock.calls[0][0];
    expect(q.$or).toBeUndefined();
    expect(q.$and).toContainEqual({ createdBy: { $in: [ALICE] } });
    expect(Message.find).not.toHaveBeenCalled();
    expect(Note.find).not.toHaveBeenCalled();
    expect(gateway.rerank).not.toHaveBeenCalled();
  });

  test('from:@user resolves to an id; unknown user matches nothing', async () => {
    await svc.searchAll({ query: 'from:@sam type:file', workspaceId: WS, userId: ALICE });
    expect(WorkspaceFile.find.mock.calls[0][0].$and).toContainEqual({ createdBy: { $in: [SAM] } });
    await svc.searchAll({ query: 'from:@nobody type:file', workspaceId: WS, userId: ALICE });
    expect(WorkspaceFile.find.mock.calls[1][0].$and).toContainEqual({ createdBy: { $in: [] } });
  });

  test('in:#channel narrows messages to that member channel and drops DMs', async () => {
    await svc.searchAll({ query: 'in:#eng type:message', workspaceId: WS, userId: ALICE });
    const resolve = Channel.find.mock.calls.find(([q]) => isResolve(q))[0];
    expect(resolve.$or[0].name.source).toBe('^eng$');
    expect(resolve.$and[0].$or).toEqual([{ isPrivate: false }, { 'members.user': ALICE }]);
    const mq = Message.find.mock.calls[0][0];
    expect(mq.$or).toEqual([{ channel: { $in: ['chEng'] } }]);
    expect(mq.text).toBeUndefined();
  });

  test('message metadata filters: has / is / dates', async () => {
    await svc.searchAll({ query: 'has:image has:link is:pinned is:thread on:2026-03-10', workspaceId: WS, userId: ALICE });
    const mq = Message.find.mock.calls[0][0];
    expect(mq.$and).toEqual(expect.arrayContaining([
      { createdAt: { $gte: new Date('2026-03-10T00:00:00Z'), $lt: new Date('2026-03-11T00:00:00Z') } },
      { 'attachments.type': 'image' },
      { 'linkPreview.url': { $exists: true, $nin: [null, ''] } },
      { isPinned: true },
      { $or: [{ parentId: { $ne: null } }, { replyCount: { $gt: 0 } }] },
    ]));
    // has:link and is:thread only make sense for messages.
    expect(Note.find).not.toHaveBeenCalled();
    expect(WorkspaceFile.find).not.toHaveBeenCalled();
    expect(Task.find).not.toHaveBeenCalled();
  });

  test('has:image on files filters mime type; notes on attachment category', async () => {
    await svc.searchAll({ query: 'has:image logo', workspaceId: WS, userId: ALICE, semantic: false });
    expect(flat(WorkspaceFile.find.mock.calls[0][0])).toContain('"mimeType":"RE:^image\\\\/"');
    expect(Note.find.mock.calls[0][0].$and).toContainEqual({ 'attachments.category': 'image' });
    expect(Task.find).not.toHaveBeenCalled();
  });

  test('is:pinned on notes', async () => {
    await svc.searchAll({ query: 'is:pinned type:note', workspaceId: WS, userId: ALICE });
    expect(Note.find.mock.calls[0][0].$and).toContainEqual({ isPinned: true });
  });

  test('date filters on knowledge, channels and tasks; people excluded', async () => {
    await svc.searchAll({ query: 'before:2026-01-01 roadmap', workspaceId: WS, userId: ALICE, semantic: false });
    const want = { createdAt: { $lt: new Date('2026-01-01T00:00:00Z') } };
    expect(KnowledgePage.find.mock.calls[0][0].$and).toContainEqual(want);
    expect(Task.find.mock.calls[0][0].$and).toContainEqual(want);
    const chQ = Channel.find.mock.calls.map(c => c[0]).find(q => q.$or && q.$or[0].name instanceof RegExp && q.$or[0].name.source === 'roadmap');
    expect(chQ.$and).toContainEqual(want);
    expect(wsQueries.searchPeople).not.toHaveBeenCalled();
  });

  test('type:person with no text lists people', async () => {
    await svc.searchAll({ query: 'type:person', workspaceId: WS, userId: ALICE });
    expect(wsQueries.searchPeople).toHaveBeenCalledWith(expect.anything(), ALICE, '', expect.any(Object));
  });

  test('type param and type: operator intersect', async () => {
    await svc.searchAll({ query: 'type:task x', type: 'note', workspaceId: WS, userId: ALICE });
    expect(Task.find).not.toHaveBeenCalled();
    expect(Note.find).not.toHaveBeenCalled();
  });

  test('phrases + terms: all must appear', async () => {
    await svc.searchAll({ query: 'beta "release plan"', type: 'task', workspaceId: WS, userId: ALICE });
    const re = Task.find.mock.calls[0][0].$or[0].title;
    expect(re.test('release plan for beta')).toBe(true);
    expect(re.test('release for beta')).toBe(false);
  });

  test('invalid operators are reported and searched literally', async () => {
    const res = await svc.searchAll({ query: 'has:video', type: 'task', workspaceId: WS, userId: ALICE });
    expect(res.syntax.warnings.length).toBe(1);
    expect(Task.find.mock.calls[0][0].$or[0].title.source).toBe('has:video');
  });

  test('empty query returns empty buckets', async () => {
    const res = await svc.searchAll({ query: '   ', workspaceId: WS, userId: ALICE });
    expect(res.total).toBe(0);
    expect(Task.find).not.toHaveBeenCalled();
  });
});
