'use strict';

// The assistant doing work: threads, thread replies, tasks, notes, reminders, mentions.
// Every tool runs as the requester, only where they may act, through the same services
// (and so the same live events and notifications) as the app.

const WS = '64b000000000000000000001';
const OTHER_WS = '64b000000000000000000002';
const ME = '64b0000000000000000000a1';
const BOB = '64b0000000000000000000b2';
const OUTSIDER = '64b0000000000000000000c3';
const CH = '64b0000000000000000000d1'; // #general: I'm a member
const CH_NOT_MINE = '64b0000000000000000000d2'; // #secret: I'm not a member
const CH_ANN = '64b0000000000000000000d3'; // #announcements: admins only
const CH_ELSEWHERE = '64b0000000000000000000d4'; // another workspace
const PARENT = '64b0000000000000000000e1';
const REPLY = '64b0000000000000000000e2';
const TRIGGER = '64b0000000000000000000e3';
const SECRET_MSG = '64b0000000000000000000e4';
const NOTE = '64b0000000000000000000f1';

const mockUsers = {
  [ME]: { _id: ME, username: 'thrishank', name: 'Thrishank K' },
  [BOB]: { _id: BOB, username: 'bob', name: 'Bob Builder' },
};

jest.mock('../../../identity', () => ({
  workspaces: {
    findById: jest.fn(async () => ({
      _id: '64b000000000000000000001',
      company: null,
      members: [
        { user: '64b0000000000000000000a1', role: 'member', status: 'active' },
        { user: '64b0000000000000000000b2', role: 'member', status: 'active' },
      ],
    })),
  },
  users: {
    findById: jest.fn(async (id) => mockUsers[String(id)] || null),
    findManyByIds: jest.fn(async (ids) => new Map(ids.map(String).filter((id) => mockUsers[id]).map((id) => [id, mockUsers[id]]))),
  },
}));
jest.mock('../../../identity/hydrate', () => ({ hydrate: async (x) => x, USER_MIN: {} }));

const lean = (v) => ({ select: () => ({ lean: async () => v }), lean: async () => v });
const mockChannels = {
  [CH]: { _id: CH, name: 'general', workspace: WS, company: null, members: [{ user: ME }, { user: BOB }] },
  [CH_NOT_MINE]: { _id: CH_NOT_MINE, name: 'secret', workspace: WS, company: null, members: [{ user: BOB }] },
  [CH_ANN]: { _id: CH_ANN, name: 'announcements', workspace: WS, company: null, postingPolicy: 'admins', members: [{ user: ME }, { user: BOB }] },
  [CH_ELSEWHERE]: { _id: CH_ELSEWHERE, name: 'elsewhere', workspace: OTHER_WS, company: null, members: [{ user: ME }] },
};
jest.mock('../../channels/channel.model', () => ({
  findById: jest.fn((id) => lean(mockChannels[String(id)] || null)),
  find: jest.fn((q) => lean(Object.values(mockChannels).filter((c) => String(c.workspace) === String(q.workspace) && q.name.test(c.name)))),
}));
jest.mock('../../channels/channelMute.controller', () => ({ canManageChannel: jest.fn(async () => false) }));
jest.mock('../../../../models/DMSession', () => ({ findById: jest.fn(() => lean(null)), findOne: jest.fn(() => lean(null)), updateOne: jest.fn() }));

const mockMessages = {
  [PARENT]: { _id: PARENT, channel: CH, workspace: WS, company: null, sender: BOB, replyCount: 2 },
  [REPLY]: { _id: REPLY, channel: CH, workspace: WS, parentId: PARENT },
  [TRIGGER]: { _id: TRIGGER, channel: CH, workspace: WS },
  [SECRET_MSG]: { _id: SECRET_MSG, channel: CH_NOT_MINE, workspace: WS },
};
jest.mock('../../../modules/messages/message.model', () => ({ findById: jest.fn((id) => lean(mockMessages[String(id)] || null)) }));
jest.mock('../../../modules/messages/messageAccess', () => ({
  canAccessMessage: jest.fn(async (msg) => String(msg.channel) !== '64b0000000000000000000d2'),
}));
jest.mock('../../../modules/threads/threadAccess', () => ({
  checkThreadAccess: jest.fn(async (msg) => (String(msg.channel) === '64b0000000000000000000d2'
    ? { ok: false, status: 404, error: 'Message not found' } : { ok: true, message: msg })),
}));

const mockCreateMessage = jest.fn(async (doc) => ({ _id: '64b0000000000000000000aa', ...doc }));
jest.mock('../../../modules/messages/messages.service', () => ({
  createMessage: (...a) => mockCreateMessage(...a),
  findOrCreateDMSession: jest.fn(),
}));
const mockPostReply = jest.fn(async (_io, { parent }) => ({ _id: '64b0000000000000000000bb', parentId: parent._id }));
jest.mock('../../../modules/threads/threads.service', () => ({ postEncryptedReply: (...a) => mockPostReply(...a) }));
const mockEncrypt = jest.fn(async () => ({ ciphertext: 'CT', messageIv: 'IV' }));
jest.mock('../../../modules/conversations/cryptoUtils', () => ({ encryptForConversation: (...a) => mockEncrypt(...a) }));

const mockFeatures = { threads: true, tasks: true, notes: true, reminders: true };
jest.mock('../../../shared/workspaceFeatures', () => ({ isFeatureEnabled: jest.fn(async (_ws, f) => mockFeatures[f] !== false) }));

const mockCreateTask = jest.fn(async (_uid, data) => ({ tasks: [{ _id: 'task-1', title: data.title, priority: data.priority, dueDate: data.dueDate || null }] }));
jest.mock('../../tasks/tasks.service', () => ({ createTask: (...a) => mockCreateTask(...a) }));
const mockAssertTasks = jest.fn(async () => {});
jest.mock('../../../shared/plans/planService', () => ({
  enforce: async (p) => { try { await p; } catch (err) { if (err.code === 'PLAN_LIMIT') throw err; } },
  assertCanCreateTasks: (...a) => mockAssertTasks(...a),
  taskAddsForBody: jest.requireActual('../../../shared/plans/planService').taskAddsForBody,
}));

const mockCreateNote = jest.fn(async (_uid, data) => ({ note: { _id: NOTE, title: data.title } }));
const mockUpdateNote = jest.fn(async () => ({ note: { _id: NOTE } }));
jest.mock('../../notes/notes.service', () => ({ createNote: (...a) => mockCreateNote(...a), updateNote: (...a) => mockUpdateNote(...a) }));
const mockNotes = [];
jest.mock('../../../../models/Note', () => {
  const editable = (n, q) => n.workspace === q.workspace && q.$or.some((c) => (c.owner && n.owner === c.owner) || (c.sharedWith && (n.sharedWith || []).includes(c.sharedWith) && n.allowEditing));
  return {
    findOne: jest.fn((q) => lean(mockNotes.find((n) => n._id === String(q._id) && editable(n, q)) || null)),
    find: jest.fn((q) => ({ sort: () => ({ limit: () => lean(mockNotes.filter((n) => editable(n, q) && q.title.test(n.title))) }) })),
  };
});
const mockReminderUpsert = jest.fn(async (filter, update) => ({ _id: 'rem-1', ...filter, ...update }));
jest.mock('../../../modules/messages/messageReminder.model', () => ({ findOneAndUpdate: (...a) => mockReminderUpsert(...a) }));

const actions = require('../../../../utils/aiActions');

const io = { to: jest.fn(() => ({ emit: jest.fn() })) };
const inChannel = { userId: ME, workspaceId: WS, io, shared: true, channelId: CH, conversation: { id: CH, type: 'channel', parentId: null, triggerMessageId: TRIGGER } };
const inThread = { ...inChannel, conversation: { ...inChannel.conversation, parentId: PARENT } };
const privateChat = { userId: ME, workspaceId: WS, io };

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockFeatures, { threads: true, tasks: true, notes: true, reminders: true });
  mockNotes.length = 0;
});

describe('create_thread', () => {
  test('in a channel: posts the "[Thread] …" parent as the requester, encrypted, and the details as the first reply', async () => {
    const out = await actions.createThread({ title: 'review is pending', topic: 'review', details: 'Waiting on **design** sign-off.' }, inChannel);
    expect(out).toMatchObject({ success: true, threadId: '64b0000000000000000000aa', title: '[Thread] review: review is pending', detailsPosted: true, firstReplyId: '64b0000000000000000000bb' });
    expect(out.link).toMatch(new RegExp(`/workspace/${WS}/thread/channel/${CH}/64b0000000000000000000aa$`));
    expect(mockEncrypt).toHaveBeenCalledWith(CH, 'channel', '[Thread] review: review is pending');
    // the normal send path: new-message to the room, notifications, mentions
    expect(mockCreateMessage).toHaveBeenCalledWith(expect.objectContaining({ channel: CH, workspace: WS, sender: ME, ciphertext: 'CT', messageIv: 'IV', isEncrypted: true }), io);
    const [, reply] = mockPostReply.mock.calls[0];
    expect(mockPostReply.mock.calls[0][0]).toBe(io);
    expect(reply).toMatchObject({ senderId: ME, ciphertext: 'CT', messageIv: 'IV', parent: { _id: '64b0000000000000000000aa', channel: CH, replyCount: 0, sender: ME } });
    expect(mockEncrypt).toHaveBeenCalledWith(CH, 'channel', 'Waiting on **design** sign-off.');
  });

  test('a title that already carries the tag is kept; no details means no reply', async () => {
    const out = await actions.createThread({ title: '[Thread] release: notes due Friday' }, inChannel);
    expect(out.title).toBe('[Thread] release: notes due Friday');
    expect(mockPostReply).not.toHaveBeenCalled();
  });

  test('mentions people and @here: handles in the text and as mentionText (never the message itself)', async () => {
    await actions.createThread({ title: 'deploy window', mention: ['Bob', 'here'] }, inChannel);
    const doc = mockCreateMessage.mock.calls[0][0];
    expect(mockEncrypt).toHaveBeenCalledWith(CH, 'channel', '[Thread] deploy window @bob @here');
    expect(doc.mentionText).toBe('@bob @here');
  });

  test('in another channel by name, but only one the requester belongs to', async () => {
    const ok = await actions.createThread({ title: 'x', channel: '#general' }, privateChat);
    expect(ok.success).toBe(true);
    const denied = await actions.createThread({ title: 'x', channel: '#secret' }, privateChat);
    expect(denied).toMatchObject({ success: false, error: expect.stringMatching(/not a member of #secret/) });
    const missing = await actions.createThread({ title: 'x', channel: '#nope' }, privateChat);
    expect(missing.success).toBe(false);
    expect(mockCreateMessage).toHaveBeenCalledTimes(1);
  });

  test('refused: admins-only channel, other workspace, threads turned off, no target, not in the workspace', async () => {
    expect((await actions.createThread({ title: 'x', channel: CH_ANN }, privateChat)).error).toMatch(/Only channel admins/);
    expect((await actions.createThread({ title: 'x', channel: CH_ELSEWHERE }, privateChat)).error).toMatch(/not found in this workspace/);
    expect((await actions.createThread({ title: 'x' }, privateChat)).error).toMatch(/Which channel or person/);
    expect((await actions.createThread({ title: 'x' }, { ...inChannel, userId: OUTSIDER })).error).toMatch(/not a member of this workspace/);
    mockFeatures.threads = false;
    expect((await actions.createThread({ title: 'x' }, inChannel)).error).toMatch(/Threads are turned off/);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  test('a conversation without a server key copy: nothing posted, a clear reason', async () => {
    mockEncrypt.mockRejectedValueOnce(new Error('Conversation key unavailable for server-side encryption'));
    const out = await actions.createThread({ title: 'x' }, inChannel);
    expect(out).toMatchObject({ success: false, error: expect.stringMatching(/#general was set up before/) });
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });
});

describe('reply_in_thread', () => {
  test('replies in the thread the assistant was asked in, as the requester, with @mentions', async () => {
    const out = await actions.replyInThread({ message: 'On it', mention: ['@bob'] }, inThread);
    expect(out).toMatchObject({ success: true, threadId: PARENT, replyId: '64b0000000000000000000bb', sent: 'On it @bob' });
    const [, args] = mockPostReply.mock.calls[0];
    expect(args).toMatchObject({ senderId: ME, mentionText: '@bob', parent: { _id: PARENT, channel: CH } });
    expect(require('../../../modules/threads/threadAccess').checkThreadAccess).toHaveBeenCalledWith(expect.objectContaining({ _id: PARENT }), ME, { forWrite: true });
  });

  test('a reply id is taken as its thread', async () => {
    const out = await actions.replyInThread({ message: 'x', threadId: REPLY }, privateChat);
    expect(out.threadId).toBe(PARENT);
  });

  test('refused when the requester cannot see the thread, or there is no thread', async () => {
    mockMessages['64b0000000000000000000e9'] = { _id: '64b0000000000000000000e9', channel: CH_NOT_MINE, workspace: WS };
    expect((await actions.replyInThread({ message: 'x', threadId: '64b0000000000000000000e9' }, privateChat)).success).toBe(false);
    expect((await actions.replyInThread({ message: 'x' }, inChannel)).error).toMatch(/Which thread/);
    expect((await actions.replyInThread({ message: 'x', threadId: PARENT }, { ...privateChat, workspaceId: OTHER_WS })).success).toBe(false);
    expect(mockPostReply).not.toHaveBeenCalled();
  });
});

describe('create_task', () => {
  test('assignee by name, due date, urgent priority, linked to the thread it was asked in', async () => {
    const out = await actions.createTaskForUser({ title: 'Finish review', assignees: ['Bob'], dueDate: '2026-11-02', priority: 'urgent', linkToConversation: true }, inThread);
    expect(out).toMatchObject({ success: true, taskId: 'task-1', priority: 'highest', assignees: ['Bob Builder'], linkedToMessage: true });
    expect(out.link).toMatch(new RegExp(`/workspace/${WS}/tasks/task-1$`));
    const [uid, data, passedIo] = mockCreateTask.mock.calls[0];
    expect(uid).toBe(ME);
    expect(passedIo).toBe(io); // tasks.service emits task-created and notifies the assignee
    expect(data).toMatchObject({ workspaceId: WS, assignmentType: 'individual', assignedToIds: [BOB], linkedMessage: PARENT, source: 'ai', priority: 'highest' });
    expect(mockAssertTasks).toHaveBeenCalledWith(WS, ME, { self: 0, others: 1 });
  });

  test('refused: an outsider assignee, a message the requester cannot see, a plan limit, tasks off, a non-member', async () => {
    expect((await actions.createTaskForUser({ title: 't', assignees: ['Zed'] }, inChannel)).error).toMatch(/"Zed" is not a member/);
    expect((await actions.createTaskForUser({ title: 't', linkedMessageId: SECRET_MSG }, inChannel)).error).toMatch(/cannot see it/);
    mockAssertTasks.mockRejectedValueOnce(Object.assign(new Error('Free plan: 10 active tasks per workspace'), { code: 'PLAN_LIMIT' }));
    expect((await actions.createTaskForUser({ title: 't' }, inChannel)).error).toMatch(/Free plan/);
    expect((await actions.createTaskForUser({ title: 't' }, { ...inChannel, userId: OUTSIDER })).success).toBe(false);
    mockFeatures.tasks = false;
    expect((await actions.createTaskForUser({ title: 't' }, inChannel)).error).toMatch(/Tasks are turned off/);
    expect(mockCreateTask).not.toHaveBeenCalled();
  });
});

describe('notes', () => {
  test('create_note stores Markdown as note blocks through the notes service', async () => {
    const out = await actions.createNote({ title: 'Release plan', content: '# Goals\nShip **v2**\n\n- [ ] QA\n- [x] Docs', shareWith: ['bob'] }, inChannel);
    expect(out).toMatchObject({ success: true, noteId: NOTE, sharedWith: ['Bob Builder'] });
    const [uid, data, passedIo] = mockCreateNote.mock.calls[0];
    expect(uid).toBe(ME);
    expect(passedIo).toBe(io);
    expect(data.sharedWith).toEqual([BOB]);
    const blocks = JSON.parse(data.content);
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'text', 'checklist']);
    expect(blocks[1].content).toBe('Ship <strong>v2</strong>');
    expect(JSON.parse(blocks[2].content).map((i) => [i.text, i.done])).toEqual([['QA', false], ['Docs', true]]);
  });

  test('append_to_note adds blocks after the existing content of a note the requester can edit', async () => {
    mockNotes.push({ _id: NOTE, workspace: WS, owner: BOB, sharedWith: [ME], allowEditing: true, title: 'Standup', content: JSON.stringify([{ id: 'a', type: 'text', content: 'old', meta: {} }]) });
    const out = await actions.appendToNote({ title: 'standup', content: '## Today\nreview is pending' }, inChannel);
    expect(out).toMatchObject({ success: true, noteId: NOTE });
    const [uid, noteId, updates, passedIo] = mockUpdateNote.mock.calls[0];
    expect([uid, noteId, passedIo]).toEqual([ME, NOTE, io]);
    expect(JSON.parse(updates.content).map((b) => [b.type, b.content])).toEqual([['text', 'old'], ['heading', 'Today'], ['text', 'review is pending']]);
  });

  test('append_to_note: a note shared read-only (or not at all) is not found; notes off is refused', async () => {
    mockNotes.push({ _id: NOTE, workspace: WS, owner: BOB, sharedWith: [ME], allowEditing: false, title: 'Standup', content: '' });
    expect((await actions.appendToNote({ noteId: NOTE, content: 'x' }, inChannel)).error).toMatch(/cannot edit/);
    mockFeatures.notes = false;
    expect((await actions.createNote({ title: 'x', content: 'y' }, inChannel)).error).toMatch(/Notes are turned off/);
    expect(mockUpdateNote).not.toHaveBeenCalled();
    expect(mockCreateNote).not.toHaveBeenCalled();
  });
});

describe('set_reminder', () => {
  const later = new Date(Date.now() + 3_600_000).toISOString();

  test('reminds the requester about the thread they asked in', async () => {
    const out = await actions.setReminder({ remindAt: later, note: 'check the review' }, inThread);
    expect(out).toMatchObject({ success: true, reminderId: 'rem-1', note: 'check the review' });
    expect(mockReminderUpsert).toHaveBeenCalledWith({ userId: ME, messageId: PARENT }, expect.objectContaining({ delivered: false, note: 'check the review' }), { upsert: true, new: true });
  });

  test('refused: a past time, a message the requester cannot see, nothing to attach to', async () => {
    expect((await actions.setReminder({ remindAt: '2020-01-01T00:00:00Z' }, inThread)).error).toMatch(/future/);
    expect((await actions.setReminder({ remindAt: later, messageId: SECRET_MSG }, inThread)).error).toMatch(/cannot see it/);
    expect((await actions.setReminder({ remindAt: later }, privateChat)).error).toMatch(/attached to a message/);
    expect(mockReminderUpsert).not.toHaveBeenCalled();
  });
});

test('send_message_to_channel: by name, and only the @handles leave as mentionText', async () => {
  const out = await actions.sendMessageToChannel({ channelId: 'general', message: 'Build is green, @bob' }, privateChat);
  expect(out).toMatchObject({ success: true, channelName: '#general', sent: 'Build is green, @bob' });
  expect(mockCreateMessage.mock.calls[0][0].mentionText).toBe('@bob');
  expect((await actions.sendMessageToChannel({ channelId: CH_NOT_MINE, message: 'x' }, privateChat)).success).toBe(false);
});

describe('wiring', () => {
  const { ACTION_FOR, DECLARATIONS } = require('../../../../../ai/tools/registry');
  const ChatAgent = require('../../../../../ai/agents/chat.agent');
  const { plainCtx } = require('../../../../../ai/service/actionsProxy');
  const { sharedContext } = require('../ai.internal.routes');

  test('every new tool is declared and has a server action', () => {
    for (const name of ['create_thread', 'reply_in_thread', 'append_to_note', 'set_reminder']) {
      expect(DECLARATIONS.some((d) => d.name === name)).toBe(true);
      expect(typeof actions[ACTION_FOR[name]]).toBe('function');
    }
  });

  test('"create a thread with review is pending" gets the thread tools (it used to get none)', () => {
    const ask = 'create a thread with review is pending';
    expect(ChatAgent.wantsTools(ask)).toBe(true);
    expect([...ChatAgent.toolsFor(ask)]).toEqual(expect.arrayContaining(['create_thread', 'reply_in_thread']));
    expect(ChatAgent.wantsTools('remind me tomorrow at 9 about this')).toBe(true);
    expect([...ChatAgent.toolsFor('remind me tomorrow at 9 about this')]).toContain('set_reminder');
    expect(ChatAgent.wantsTools('assign a task to bob due friday')).toBe(true);
    expect(ChatAgent.wantsTools('what is the capital of France?')).toBe(false);
  });

  test('the conversation context reaches the actions, also through the standalone AI process', async () => {
    const wire = plainCtx({ ...inThread, io: {}, req: {} });
    expect(wire).toEqual({ userId: ME, workspaceId: WS, shared: true, channelId: CH, conversation: { id: CH, type: 'channel', parentId: PARENT, triggerMessageId: TRIGGER } });
    expect(sharedContext(wire)).toEqual({ shared: true, channelId: CH, conversation: wire.conversation });
    expect(sharedContext({ conversation: { id: { $gt: '' } }, channelId: 'a b' })).toEqual({});
  });

  test('the chat agent runs create_thread with the conversation it was asked in', async () => {
    const { Orchestrator } = require('../../../../../ai/orchestrator');
    const { MockProvider } = require('../../../../../ai/providers');
    const createThread = jest.fn(async () => ({ success: true, threadId: 't1', link: 'https://app/x' }));
    const provider = new MockProvider(({ kind }) => (kind !== 'chat' ? 'n/a' : {
      functionCalls: [{ name: 'create_thread', args: { title: 'review is pending', topic: 'review' } }],
      next: { text: 'Started [Thread] review: review is pending — [Open thread](https://app/x)' },
    }));
    const quiet = { debug() {}, info() {}, warn() {}, error() {} };
    const orchestrator = new Orchestrator({ provider, actions: { createThread }, logger: quiet });
    const out = await orchestrator.run('chat', { message: 'create a thread with review is pending' }, { userId: ME, workspaceId: WS, shared: true, conversation: inChannel.conversation });
    expect(createThread).toHaveBeenCalledWith({ title: 'review is pending', topic: 'review' }, expect.objectContaining({ userId: ME, workspaceId: WS, conversation: inChannel.conversation }));
    expect(out.text).toMatch(/Open thread/);
    expect(provider.calls[0].tools.map((t) => t.name)).toContain('create_thread');
  });
});
