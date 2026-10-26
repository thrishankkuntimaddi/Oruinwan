'use strict';

/**
 * Socket.IO send-message follows the same rules as the REST send (sendRules.prepareSend):
 * workspace + channel membership or DM participation, blocked DMs, announcement channels,
 * thread parents and quotes from the same conversation, and the same createMessage call.
 */

jest.mock('../../modules/messages/message.model', () => ({ findById: jest.fn(), create: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../../features/channels/channel.model', () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock('../../../models/DMSession', () => ({ findById: jest.fn(), find: jest.fn(), updateOne: jest.fn().mockResolvedValue({}) }));
jest.mock('../../identity', () => ({
  users: { findById: jest.fn().mockResolvedValue({ _id: 'u', username: 'ana' }) },
  workspaces: { findById: jest.fn(), memberWorkspaceIds: jest.fn().mockResolvedValue([]), membership: jest.fn().mockResolvedValue(null) },
}));
jest.mock('../../modules/messages/messages.service', () => ({
  createMessage: jest.fn(),
  findOrCreateDMSession: jest.fn(),
}));
jest.mock('../../modules/uploads/attachmentSanitizer', () => ({ sanitizeAttachments: jest.fn(async (a) => a || []) }));
jest.mock('../../shared/workspaceFeatures', () => ({ isFeatureEnabled: jest.fn().mockResolvedValue(true) }));
jest.mock('../../modules/huddles/huddles.socket', () => jest.fn());
jest.mock('../../features/activity/activity.service', () => ({ emitWithIo: jest.fn().mockResolvedValue() }));

const Message = require('../../modules/messages/message.model');
const Channel = require('../../features/channels/channel.model');
const DMSession = require('../../../models/DMSession');
const identity = require('../../identity');
const messagesService = require('../../modules/messages/messages.service');
const registerChatHandlers = require('../chatHandlers');

// Chainable query mock resolving to `value` for .select().lean() etc.
const q = (value) => {
  const chain = {
    select: () => chain,
    lean: () => Promise.resolve(value),
    populate: () => chain,
    then: (res, rej) => Promise.resolve(value).then(res, rej),
  };
  return chain;
};

const oid = (c) => c.repeat(24);
const USER = oid('a');
const OTHER = oid('b');
const THIRD = oid('c');
const WS = oid('d');
const CH = oid('e');
const DM = oid('f');
const PARENT = oid('1');

function makeSocket(userId) {
  const handlers = {};
  const socket = {
    id: 'sock1',
    user: { id: userId },
    data: {},
    rooms: new Set(),
    on: jest.fn((evt, fn) => { handlers[evt] = fn; }),
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
  };
  return { socket, handlers };
}

function makeIo() {
  const roomEmit = jest.fn();
  return { io: { to: jest.fn(() => ({ emit: roomEmit })), in: jest.fn(() => ({ socketsJoin: jest.fn(), socketsLeave: jest.fn() })) }, roomEmit };
}

const activeIn = (...users) => ({ _id: WS, members: users.map((user) => ({ user, status: 'active' })) });

describe('socket send-message follows the REST send rules', () => {
  let handlers, socket, io;

  beforeEach(async () => {
    jest.clearAllMocks();
    identity.workspaces.findById.mockResolvedValue(activeIn(USER, OTHER, THIRD));
    Channel.find.mockReturnValue(q([]));
    DMSession.find.mockReturnValue(q([]));
    messagesService.createMessage.mockResolvedValue({ _id: 'm1' });
    ({ socket, handlers } = makeSocket(USER));
    ({ io } = makeIo());
    await registerChatHandlers(io, socket);
  });

  const lastError = () => socket.emit.mock.calls.filter(([e]) => e === 'send-error').pop()?.[1];

  it('rejects a non-member sending to a channel', async () => {
    Channel.findById.mockReturnValue(q({ _id: CH, workspace: WS, members: [{ user: OTHER }], isPrivate: true }));
    await handlers['send-message']({ channelId: CH, ciphertext: 'x', messageIv: 'y', clientTempId: 't1' });
    expect(messagesService.createMessage).not.toHaveBeenCalled();
    expect(lastError()).toMatchObject({ clientTempId: 't1', code: 'FORBIDDEN' });
  });

  it('rejects a channel member who is no longer in the workspace', async () => {
    identity.workspaces.findById.mockResolvedValue({ _id: WS, members: [{ user: USER, status: 'removed' }] });
    Channel.findById.mockReturnValue(q({ _id: CH, workspace: WS, members: [{ user: USER }] }));
    await handlers['send-message']({ channelId: CH, ciphertext: 'x', messageIv: 'y', clientTempId: 't1b' });
    expect(messagesService.createMessage).not.toHaveBeenCalled();
    expect(lastError()).toMatchObject({ clientTempId: 't1b' });
  });

  it('rejects a non-participant sending to a DM', async () => {
    DMSession.findById.mockReturnValue(q({ _id: DM, workspace: WS, participants: [OTHER, THIRD] }));
    await handlers['send-message']({ dmSessionId: DM, ciphertext: 'x', messageIv: 'y', clientTempId: 't2' });
    expect(messagesService.createMessage).not.toHaveBeenCalled();
    expect(lastError()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses a blocked DM, like REST', async () => {
    DMSession.findById.mockReturnValue(q({ _id: DM, workspace: WS, participants: [USER, OTHER], blockedBy: [{ user: OTHER }] }));
    await handlers['send-message']({ dmSessionId: DM, ciphertext: 'x', messageIv: 'y', clientTempId: 't2b' });
    expect(messagesService.createMessage).not.toHaveBeenCalled();
    expect(lastError()).toMatchObject({ code: 'BLOCKED' });
  });

  it('refuses a plain member posting in an announcement channel, like REST', async () => {
    Channel.findById.mockReturnValue(q({ _id: CH, workspace: WS, members: [{ user: USER }], postingPolicy: 'admins', admins: [] }));
    await handlers['send-message']({ channelId: CH, ciphertext: 'x', messageIv: 'y', clientTempId: 't2c' });
    expect(messagesService.createMessage).not.toHaveBeenCalled();
    expect(lastError()).toMatchObject({ code: 'POSTING_RESTRICTED' });
  });

  it('rejects plaintext messages with E2EE_REQUIRED', async () => {
    await handlers['send-message']({ channelId: CH, text: 'hello', clientTempId: 't3' });
    expect(messagesService.createMessage).not.toHaveBeenCalled();
    expect(lastError()).toMatchObject({ code: 'E2EE_REQUIRED' });
  });

  it('creates the message with the server-derived workspace and lets createMessage announce it', async () => {
    Channel.findById.mockReturnValue(q({ _id: CH, workspace: WS, company: 'co1', members: [{ user: USER }] }));
    await handlers['send-message']({ channelId: CH, workspaceId: 'wsSpoofed', ciphertext: 'x', messageIv: 'y', clientTempId: 't4', mentionText: '@bob hi' });
    expect(messagesService.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      workspace: WS, channel: CH, sender: USER, ciphertext: 'x', messageIv: 'y', parentId: null, clientTempId: 't4', mentionText: '@bob hi',
    }), io);
    expect(socket.emit).toHaveBeenCalledWith('message-sent', expect.objectContaining({ clientTempId: 't4' }));
  });

  it('passes clientMessageId through and marks a duplicate resend', async () => {
    Channel.findById.mockReturnValue(q({ _id: CH, workspace: WS, members: [{ user: USER }] }));
    const { markDuplicate } = require('../../modules/messages/clientMessageId');
    messagesService.createMessage.mockResolvedValue(markDuplicate({ _id: 'm1', clientMessageId: 'queued-0001' }));
    await handlers['send-message']({ channelId: CH, ciphertext: 'x', messageIv: 'y', clientTempId: 't5', clientMessageId: 'queued-0001' });
    expect(messagesService.createMessage).toHaveBeenCalledWith(expect.objectContaining({ clientMessageId: 'queued-0001' }), io);
    expect(socket.emit).toHaveBeenCalledWith('message-sent', expect.objectContaining({ clientTempId: 't5', duplicate: true, clientMessageId: 'queued-0001' }));
  });

  it('refuses a reply to a locked thread with THREAD_LOCKED', async () => {
    Channel.findById.mockReturnValue(q({ _id: CH, workspace: WS, members: [{ user: USER }] }));
    Message.findById.mockReturnValue(q({ _id: PARENT, channel: CH, parentId: null, threadLockedAt: new Date(), threadLockedByName: 'dana' }));
    await handlers['send-message']({ channelId: CH, parentId: PARENT, ciphertext: 'x', messageIv: 'y', clientTempId: 't6' });
    expect(messagesService.createMessage).not.toHaveBeenCalled();
    expect(lastError()).toEqual({
      clientTempId: 't6', code: 'THREAD_LOCKED', message: 'This thread was locked by dana. New replies are turned off.',
    });
  });

  it('refuses a quote from another conversation', async () => {
    Channel.findById.mockReturnValue(q({ _id: CH, workspace: WS, members: [{ user: USER }] }));
    Message.findById.mockReturnValue(q({ _id: PARENT, channel: oid('9') }));
    await handlers['send-message']({ channelId: CH, quotedMessageId: PARENT, ciphertext: 'x', messageIv: 'y', clientTempId: 't7' });
    expect(messagesService.createMessage).not.toHaveBeenCalled();
    expect(lastError()).toMatchObject({ code: 'INVALID_QUOTE' });
  });

  it('a reply in a group cannot point at a message from before the sender joined', async () => {
    DMSession.findById.mockReturnValue(q({ _id: DM, workspace: WS, participants: [USER, OTHER], isGroup: true, memberSince: [{ user: USER, at: new Date('2026-05-01') }] }));
    Message.findById.mockReturnValue(q({ _id: PARENT, dm: DM, parentId: null, createdAt: new Date('2026-04-01') }));
    await handlers['send-message']({ dmSessionId: DM, parentId: PARENT, ciphertext: 'x', messageIv: 'y', clientTempId: 't8' });
    expect(messagesService.createMessage).not.toHaveBeenCalled();
    expect(lastError()).toMatchObject({ code: 'INVALID_PARENT' });
  });
});

describe('socket rooms follow the conversation rule', () => {
  let handlers, socket;

  beforeEach(async () => {
    jest.clearAllMocks();
    Channel.find.mockReturnValue(q([]));
    DMSession.find.mockReturnValue(q([]));
    ({ socket, handlers } = makeSocket(USER));
    const { io } = makeIo();
    await registerChatHandlers(io, socket);
  });

  it('join-channel needs channel membership and an active workspace membership', async () => {
    Channel.findById.mockReturnValue(q({ _id: CH, workspace: WS, members: [{ user: USER }] }));
    identity.workspaces.findById.mockResolvedValue({ _id: WS, members: [{ user: USER, status: 'removed' }] });
    await handlers['join-channel']({ channelId: CH });
    expect(socket.join).not.toHaveBeenCalledWith(`channel:${CH}`);

    identity.workspaces.findById.mockResolvedValue(activeIn(USER));
    await handlers['join-channel']({ channelId: CH });
    expect(socket.join).toHaveBeenCalledWith(`channel:${CH}`);
  });

  it('join-dm needs participation and an active workspace membership', async () => {
    DMSession.findById.mockReturnValue(q({ _id: DM, workspace: WS, participants: [USER, OTHER] }));
    identity.workspaces.findById.mockResolvedValue(activeIn(OTHER));
    await handlers['join-dm']({ dmSessionId: DM });
    expect(socket.join).not.toHaveBeenCalledWith(`dm:${DM}`);

    identity.workspaces.findById.mockResolvedValue(activeIn(USER, OTHER));
    await handlers['join-dm']({ dmSessionId: DM });
    expect(socket.join).toHaveBeenCalledWith(`dm:${DM}`);
  });

  it('restores rooms only in workspaces the person is still active in', async () => {
    expect(identity.workspaces.memberWorkspaceIds).toHaveBeenCalledWith(USER);
    expect(DMSession.find).toHaveBeenCalledWith(expect.objectContaining({ workspace: { $in: [] } }));
  });
});
