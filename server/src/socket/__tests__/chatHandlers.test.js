'use strict';

jest.mock('../../features/messages/message.model', () => ({ findById: jest.fn(), create: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../../features/channels/channel.model', () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock('../../../models/DMSession', () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock('../../../models/Workspace', () => ({ findById: jest.fn() }));
jest.mock('../../../models/User', () => ({ findById: jest.fn() }));
jest.mock('../../modules/messages/messages.service', () => ({
  createMessage: jest.fn(),
  findOrCreateDMSession: jest.fn(),
}));
jest.mock('../handlers/huddles.socket', () => jest.fn());
jest.mock('../../features/activity/activity.service', () => ({ emitWithIo: jest.fn().mockResolvedValue() }));

const Channel = require('../../features/channels/channel.model');
const DMSession = require('../../../models/DMSession');
const User = require('../../../models/User');
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

function makeSocket(userId) {
  const handlers = {};
  const socket = {
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
  return { io: { to: jest.fn(() => ({ emit: roomEmit })) }, roomEmit };
}

describe('socket send-message authorization', () => {
  const USER = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  let handlers, socket, io, roomEmit;

  beforeEach(async () => {
    User.findById.mockReturnValue(q({ _id: USER }));
    Channel.find.mockReturnValue(q([]));
    DMSession.find.mockReturnValue(q([]));
    ({ socket, handlers } = makeSocket(USER));
    ({ io, roomEmit } = makeIo());
    await registerChatHandlers(io, socket);
  });

  it('rejects a non-member sending to a channel', async () => {
    Channel.findById.mockReturnValue(q({ _id: 'ch1', workspace: 'ws1', company: 'co1', members: [{ user: OTHER }] }));

    await handlers['send-message']({ channelId: 'ch1', workspaceId: 'ws1', ciphertext: 'x', messageIv: 'y', clientTempId: 't1' });

    expect(messagesService.createMessage).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('send-error', expect.objectContaining({ clientTempId: 't1', code: 'FORBIDDEN' }));
    expect(roomEmit).not.toHaveBeenCalledWith('new-message', expect.anything());
  });

  it('rejects a non-participant sending to a DM', async () => {
    DMSession.findById.mockReturnValue(q({ _id: 'dm1', workspace: 'ws1', participants: [OTHER, 'cccccccccccccccccccccccc'] }));

    await handlers['send-message']({ dmSessionId: 'dm1', ciphertext: 'x', messageIv: 'y', clientTempId: 't2' });

    expect(messagesService.createMessage).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('send-error', expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('rejects plaintext messages with E2EE_REQUIRED', async () => {
    await handlers['send-message']({ channelId: 'ch1', text: 'hello', clientTempId: 't3' });

    expect(messagesService.createMessage).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('send-error', expect.objectContaining({ code: 'E2EE_REQUIRED' }));
  });

  it('creates the message with server-derived workspace for a member', async () => {
    Channel.findById.mockReturnValue(q({ _id: 'ch1', workspace: 'wsReal', company: 'co1', members: [{ user: USER }] }));
    messagesService.createMessage.mockResolvedValue({ _id: 'm1', toObject: () => ({ _id: 'm1' }) });

    await handlers['send-message']({ channelId: 'ch1', workspaceId: 'wsSpoofed', ciphertext: 'x', messageIv: 'y', clientTempId: 't4' });

    expect(messagesService.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      workspace: 'wsReal', channel: 'ch1', sender: USER, ciphertext: 'x', messageIv: 'y', parentId: null,
    }));
    expect(socket.emit).toHaveBeenCalledWith('message-sent', expect.objectContaining({ clientTempId: 't4' }));
    expect(roomEmit).toHaveBeenCalledWith('new-message', expect.objectContaining({ clientTempId: 't4' }));
  });
});
