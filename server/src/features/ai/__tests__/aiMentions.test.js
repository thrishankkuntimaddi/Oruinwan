'use strict';

// @mentions in AI chats: who the people are, messaging them, and searching the
// requester's own (client-decrypted) messages with them.

const WS = '64b000000000000000000001';
const ME = '64b0000000000000000000a1';
const MUZAMIL = '64b0000000000000000000b2';
const REMOVED = '64b0000000000000000000c3';
const OUTSIDER = '64b0000000000000000000d4';
const BLOCKER = '64b0000000000000000000e5';
const OLD_DM_PERSON = '64b0000000000000000000f6';

const mockUsers = {
  [ME]: { _id: ME, username: 'thrishank', name: 'Thrishank K' },
  [MUZAMIL]: { _id: MUZAMIL, username: 'muzamil', name: 'Muzamil Ahmed' },
  [REMOVED]: { _id: REMOVED, username: 'gone', name: 'Gone Person' },
  [BLOCKER]: { _id: BLOCKER, username: 'blocker', name: 'Bea Blocker' },
  [OLD_DM_PERSON]: { _id: OLD_DM_PERSON, username: 'olddm', name: 'Old Dm' },
};

jest.mock('../../../identity', () => ({
  workspaces: {
    findById: jest.fn(async () => ({
      _id: '64b000000000000000000001',
      members: [
        { user: '64b0000000000000000000a1', role: 'member', status: 'active' },
        { user: '64b0000000000000000000b2', role: 'member', status: 'active' },
        { user: '64b0000000000000000000c3', role: 'member', status: 'removed' },
        { user: '64b0000000000000000000e5', role: 'member', status: 'active' },
        { user: '64b0000000000000000000f6', role: 'member', status: 'active' },
      ],
    })),
  },
  users: {
    findById: jest.fn(async (id) => mockUsers[String(id)] || null),
    findManyByIds: jest.fn(async (ids) => new Map(ids.map(String).filter((id) => mockUsers[id]).map((id) => [id, mockUsers[id]]))),
  },
}));
jest.mock('../../../identity/hydrate', () => ({ hydrate: async (x) => x, USER_MIN: {} }));

// DMs that exist: me↔blocker (blocked by them), me↔olddm (old browser key, no server copy).
const mockDms = [
  { _id: 'dm-blocker', participants: [ME, BLOCKER], blockedBy: [{ user: BLOCKER }], hiddenFor: [] },
  { _id: 'dm-old', participants: [ME, OLD_DM_PERSON], blockedBy: [], hiddenFor: [] },
];
const mockMatch = (q, dm) => (q.participants.$all || []).every((p) => dm.participants.map(String).includes(String(p)));
jest.mock('../../../../models/DMSession', () => ({
  find: jest.fn((q) => ({ select: () => ({ lean: async () => mockDms.filter((dm) => mockMatch(q, dm)) }) })),
  findOne: jest.fn((q) => ({ select: () => ({ lean: async () => mockDms.find((dm) => mockMatch(q, dm)) || null }) })),
  updateOne: jest.fn(async () => ({})),
}));

const mockFindOrCreate = jest.fn();
const mockCreateMessage = jest.fn(async (doc) => ({ _id: 'msg-1', ...doc }));
jest.mock('../../../modules/messages/messages.service', () => ({
  findOrCreateDMSession: (...a) => mockFindOrCreate(...a),
  createMessage: (...a) => mockCreateMessage(...a),
}));
const mockEncrypt = jest.fn();
jest.mock('../../../modules/conversations/cryptoUtils', () => ({ encryptForConversation: (...a) => mockEncrypt(...a) }));

const { resolveMentions, cleanMentions } = require('../ai.mentions');
const { sendDirectMessage } = require('../../../../utils/aiActions');
const ChatAgent = require('../../../../../ai/agents/chat.agent');
const mentionTools = require('../../../../../ai/utils/mentions');
const { Orchestrator } = require('../../../../../ai/orchestrator');
const { MockProvider } = require('../../../../../ai/providers');

const ctx = { userId: ME, workspaceId: WS };
const quiet = { debug() {}, info() {}, warn() {}, error() {} };

beforeEach(() => {
  mockFindOrCreate.mockReset();
  mockCreateMessage.mockClear();
  mockEncrypt.mockReset();
  // A new DM gets a key with a server copy (ensureDMConversationKey → bootstrapConversationKey).
  mockFindOrCreate.mockImplementation(async (a, b) => ({ _id: `dm-${[a, b].sort().join('-')}`, company: null, workspace: WS, hiddenFor: [] }));
  mockEncrypt.mockImplementation(async (id) => {
    if (id === 'dm-old') throw new Error('Conversation key unavailable for server-side encryption');
    return { ciphertext: 'c1pher', messageIv: 'iv' };
  });
});

describe('mention resolution', () => {
  test('cleanMentions keeps valid, unique ids and caps the list', () => {
    const out = cleanMentions([{ id: MUZAMIL, name: 'x' }, { id: MUZAMIL }, { id: 'nope' }, null, { _id: BLOCKER }]);
    expect(out.map((m) => m.id)).toEqual([MUZAMIL, BLOCKER]);
  });

  test('resolves members from the directory (not the client name) with DM and block state', async () => {
    const people = await resolveMentions([
      { id: MUZAMIL, name: 'Spoofed Name' },
      { id: BLOCKER },
      { id: REMOVED },
      { id: OUTSIDER },
      { id: ME },
    ], ctx);
    expect(people).toEqual([
      { id: MUZAMIL, name: 'Muzamil Ahmed', username: 'muzamil', hasDirectMessage: false, blocked: null },
      { id: BLOCKER, name: 'Bea Blocker', username: 'blocker', hasDirectMessage: true, blocked: 'them' },
    ]);
  });

  test('keeps a transcript only for a real DM, and only when allowed', async () => {
    const transcript = [{ from: 'Old Dm', text: 'the invoice is due friday', at: '2026-10-20' }, { isMe: true, text: 'ok' }];
    const [withDm] = await resolveMentions([{ id: OLD_DM_PERSON, transcript }], ctx);
    expect(withDm.transcript).toEqual([
      { from: 'Old Dm', isMe: false, text: 'the invoice is due friday', at: '2026-10-20' },
      { from: 'You', isMe: true, text: 'ok', at: null },
    ]);
    const [noDm] = await resolveMentions([{ id: MUZAMIL, transcript }], ctx);
    expect(noDm.transcript).toBeUndefined();
    const [shared] = await resolveMentions([{ id: OLD_DM_PERSON, transcript }], { ...ctx, allowTranscripts: false });
    expect(shared.transcript).toBeUndefined();
  });

  test('a requester outside the workspace resolves nobody', async () => {
    expect(await resolveMentions([{ id: MUZAMIL }], { userId: OUTSIDER, workspaceId: WS })).toEqual([]);
  });
});

describe('send_direct_message to a mentioned person', () => {
  test('creates the DM when missing, encrypts with its key and sends as the requester', async () => {
    const out = await sendDirectMessage({ userId: MUZAMIL, message: '  The build is green  ' }, ctx);
    expect(out).toMatchObject({ success: true, to: 'Muzamil Ahmed', username: 'muzamil', sent: 'The build is green', messageId: 'msg-1' });
    expect(mockFindOrCreate).toHaveBeenCalledWith(ME, MUZAMIL, WS);
    expect(mockEncrypt).toHaveBeenCalledWith(out.dmSessionId, 'dm', 'The build is green');
    const doc = mockCreateMessage.mock.calls[0][0];
    expect(doc).toMatchObject({ sender: ME, ciphertext: 'c1pher', messageIv: 'iv', isEncrypted: true, dm: out.dmSessionId });
  });

  test('accepts the @handle a model passes instead of the id', async () => {
    const out = await sendDirectMessage({ userId: '@Muzamil', message: 'hi' }, ctx);
    expect(out).toMatchObject({ success: true, toUserId: MUZAMIL });
  });

  test('only active members of this workspace can be messaged', async () => {
    for (const who of [OUTSIDER, REMOVED, 'nobody']) {
      const out = await sendDirectMessage({ userId: who, message: 'hi' }, ctx);
      expect(out.success).toBe(false);
      expect(out.error).toMatch(/not a member of this workspace/);
    }
    expect(mockFindOrCreate).not.toHaveBeenCalled();
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  test('blocked people stay blocked', async () => {
    const out = await sendDirectMessage({ userId: BLOCKER, message: 'hi' }, ctx);
    expect(out).toMatchObject({ success: false });
    expect(out.error).toMatch(/can't send messages to Bea Blocker/);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  test('an older DM without a server key copy explains how to fix it instead of a dead end', async () => {
    mockFindOrCreate.mockResolvedValueOnce({ _id: 'dm-old', workspace: WS, hiddenFor: [] });
    const out = await sendDirectMessage({ userId: OLD_DM_PERSON, message: 'hi' }, ctx);
    expect(out.success).toBe(false);
    expect(out.error).toMatch(/Open it once in Oruinwan/);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  test('rejects missing text and messaging yourself', async () => {
    expect((await sendDirectMessage({ userId: MUZAMIL, message: '  ' }, ctx)).success).toBe(false);
    expect((await sendDirectMessage({ userId: ME, message: 'hi' }, ctx)).error).toMatch(/yourself/);
  });

  test('no workspace: nothing is sent', async () => {
    expect((await sendDirectMessage({ userId: MUZAMIL, message: 'hi' }, { userId: ME })).success).toBe(false);
  });
});

describe('root cause: the assistant was not given the send tool', () => {
  test.each([
    'tell muzamil the build is green',
    'ping @sara about the deploy',
    'message Raj that I will be late',
    'let maya know the doc is ready',
  ])('"%s" offers tools now', (message) => {
    expect(ChatAgent.wantsTools(message)).toBe(true);
  });

  test.each(['tell me a joke', 'explain what a race condition is', 'send me ideas for a launch tweet'])('"%s" still gets no tools', (message) => {
    expect(ChatAgent.wantsTools(message)).toBe(false);
  });

  test('with a mentioned person the send + search tools are offered and the person is described', async () => {
    const provider = new MockProvider(() => 'ok');
    const sendDirectMessageAction = jest.fn(async () => ({ success: true }));
    const orchestrator = new Orchestrator({ provider, actions: { sendDirectMessage: sendDirectMessageAction }, logger: quiet });
    const mentions = [{ id: MUZAMIL, name: 'Muzamil Ahmed', username: 'muzamil', hasDirectMessage: false, blocked: null }];
    await orchestrator.run('chat', { message: 'hey @muzamil the build is green', context: { mentions } }, { userId: ME, workspaceId: WS });
    const call = provider.calls.find((c) => c.kind === 'chat');
    expect(call.tools.map((t) => t.name).sort()).toEqual(['search_messages_with_person', 'send_direct_message']);
    expect(call.systemInstruction).toContain(`Muzamil Ahmed (@muzamil): userId ${MUZAMIL}`);
    expect(call.systemInstruction).toContain('no direct message with the user yet');
  });

  test('the model sending to the mentioned person reaches the action as the requester', async () => {
    const sendDirectMessageAction = jest.fn(async (args) => ({ success: true, to: 'Muzamil Ahmed', sent: args.message }));
    const provider = new MockProvider(({ kind }) => (kind !== 'chat' ? 'n/a' : {
      text: '',
      functionCalls: [{ name: 'send_direct_message', args: { userId: MUZAMIL, message: 'The build is green' } }],
      next: (results) => ({ text: `Sent to ${results[0].response.to}: "${results[0].response.sent}"` }),
    }));
    const orchestrator = new Orchestrator({ provider, actions: { sendDirectMessage: sendDirectMessageAction }, logger: quiet });
    const mentions = [{ id: MUZAMIL, name: 'Muzamil Ahmed', username: 'muzamil', hasDirectMessage: false, blocked: null }];
    const out = await orchestrator.run('chat', { message: 'tell @muzamil the build is green', context: { mentions } }, { userId: ME, workspaceId: WS });
    expect(sendDirectMessageAction).toHaveBeenCalledWith({ userId: MUZAMIL, message: 'The build is green' }, expect.objectContaining({ userId: ME, workspaceId: WS }));
    expect(out.text).toBe('Sent to Muzamil Ahmed: "The build is green"');
    expect(out.actionsExecuted[0].result.sent).toBe('The build is green');
  });
});

describe('search_messages_with_person', () => {
  const transcript = [
    { from: 'Muzamil Ahmed', isMe: false, text: 'Can you send the invoice for October?', at: '2026-10-01' },
    { from: 'You', isMe: true, text: 'Sure, sending it today', at: '2026-10-01' },
    { from: 'Muzamil Ahmed', isMe: false, text: 'Lunch on Friday?', at: '2026-10-10' },
    { from: 'Muzamil Ahmed', isMe: false, text: 'The October invoice is approved', at: '2026-10-12' },
  ];
  const person = { id: MUZAMIL, name: 'Muzamil Ahmed', username: 'muzamil', hasDirectMessage: true, blocked: null, transcript };

  test('finds matching messages, oldest first', () => {
    const out = mentionTools.runSearch([person], { userId: MUZAMIL, query: 'what did muzamil say about the invoice' });
    expect(out).toMatchObject({ success: true, person: 'Muzamil Ahmed', searched: 4, keywords: ['invoice'] });
    expect(out.messages.map((m) => m.text)).toEqual(['Can you send the invoice for October?', 'The October invoice is approved']);
  });

  test('no keywords: the latest messages', () => {
    const out = mentionTools.runSearch([person], { userId: MUZAMIL, limit: 2 });
    expect(out.latest).toBe(true);
    expect(out.messages.map((m) => m.text)).toEqual(['Lunch on Friday?', 'The October invoice is approved']);
  });

  test('only people mentioned in this request can be searched', () => {
    expect(mentionTools.runSearch([person], { userId: OUTSIDER, query: 'x' }).success).toBe(false);
  });

  test('no DM yet / nothing shared from the device', () => {
    expect(mentionTools.runSearch([{ ...person, hasDirectMessage: false, transcript: undefined }], { userId: MUZAMIL }).note).toMatch(/no direct messages/);
    expect(mentionTools.runSearch([{ ...person, transcript: undefined }], { userId: MUZAMIL }).error).toMatch(/end-to-end encrypted/);
  });

  test('runs inside the chat agent without any server action', async () => {
    const provider = new MockProvider(({ kind }) => (kind !== 'chat' ? 'n/a' : {
      text: '',
      functionCalls: [{ name: 'search_messages_with_person', args: { userId: MUZAMIL, query: 'invoice' } }],
      next: (results) => ({ text: `found ${results[0].response.messages.length}` }),
    }));
    const orchestrator = new Orchestrator({ provider, actions: {}, logger: quiet });
    const out = await orchestrator.run('chat', { message: 'what did @muzamil say about the invoice?', context: { mentions: [person] } }, { userId: ME, workspaceId: WS });
    expect(out.text).toBe('found 2');
  });
});
