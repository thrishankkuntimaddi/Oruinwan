'use strict';

// Key versions (conversations/keyEpochs) live in PostgreSQL; here every conversation is on its first key.
jest.mock('../../conversations/keyEpochs', () => ({ checkSendVersion: jest.fn(async (_id, _type, v) => (v == null ? 1 : Number(v))) }));
jest.mock('../message.model.js', () => ({ findOne: jest.fn(), create: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../../../../models/DMSession');
jest.mock('../../../../models/Workspace');
jest.mock('../../conversations/conversationKeys.service', () => ({}));
jest.mock('../messageAccess', () => ({ loadAccessibleMessage: jest.fn() }));
jest.mock('../../../identity/hydrate', () => ({ hydrate: jest.fn(async (o) => o) }));
const mockChannels = {};
jest.mock('../../../features/channels/channel.model.js', () => ({
  findById: jest.fn((id) => ({ select: () => ({ lean: async () => mockChannels[String(id)] || null }) })),
}));
jest.mock('../../../features/integrations/webhook.trigger', () => ({ fire: jest.fn() }));
jest.mock('../../notifications/notificationEventEmitter', () => ({ emit: jest.fn() }));

const Message = require('../message.model.js');
const emitter = require('../../notifications/notificationEventEmitter');
const service = require('../messages.service');
const { normalizeClientMessageId, isDuplicateSend } = require('../clientMessageId');

const CH = '64b0000000000000000000e1';
const PRIV = '64b0000000000000000000e2';

function doc(obj) {
  return { ...obj, toObject: () => ({ ...obj }), populate: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockChannels[CH] = { workspace: 'w1', isPrivate: false, name: 'general' };
  mockChannels[PRIV] = { workspace: 'w1', isPrivate: true, name: 'secret' };
});

describe('normalizeClientMessageId', () => {
  test('accepts uuid-like ids and rejects junk', () => {
    expect(normalizeClientMessageId('3f1c2a9e-1b2c-4d5e-8f90-123456789abc')).toBe('3f1c2a9e-1b2c-4d5e-8f90-123456789abc');
    expect(normalizeClientMessageId('  queued:0001  ')).toBe('queued:0001');
    expect(normalizeClientMessageId('short')).toBeNull();
    expect(normalizeClientMessageId('has spaces in it')).toBeNull();
    expect(normalizeClientMessageId({ $gt: '' })).toBeNull();
    expect(normalizeClientMessageId('x'.repeat(101))).toBeNull();
    expect(normalizeClientMessageId(undefined)).toBeNull();
  });
});

describe('createMessage idempotency', () => {
  const base = { type: 'message', workspace: 'w1', channel: CH, sender: 'u1', ciphertext: 'C', messageIv: 'I' };

  test('returns the stored message on a resend without creating a new one', async () => {
    Message.findOne.mockResolvedValue(doc({ _id: 'm1', clientMessageId: 'queued-0001' }));
    const io = { to: jest.fn(() => ({ emit: jest.fn() })) };
    const out = await service.createMessage({ ...base, clientMessageId: 'queued-0001' }, io);
    expect(Message.findOne).toHaveBeenCalledWith({ sender: 'u1', clientMessageId: 'queued-0001' });
    expect(Message.create).not.toHaveBeenCalled();
    expect(io.to).not.toHaveBeenCalled();
    expect(out._id).toBe('m1');
    expect(isDuplicateSend(out)).toBe(true);
    expect(JSON.parse(JSON.stringify(out)).isDuplicateSend).toBeUndefined();
  });

  test('stores clientMessageId on a first send', async () => {
    Message.findOne.mockResolvedValue(null);
    Message.create.mockResolvedValue(doc({ _id: 'm2', clientMessageId: 'queued-0002', attachments: [] }));
    const out = await service.createMessage({ ...base, clientMessageId: 'queued-0002' }, null);
    expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({ clientMessageId: 'queued-0002' }));
    expect(isDuplicateSend(out)).toBe(false);
  });

  test('a duplicate-key race returns the winner', async () => {
    Message.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(doc({ _id: 'm3', clientMessageId: 'queued-0003' }));
    Message.create.mockRejectedValue(Object.assign(new Error('E11000'), { code: 11000 }));
    const out = await service.createMessage({ ...base, clientMessageId: 'queued-0003' }, null);
    expect(out._id).toBe('m3');
    expect(isDuplicateSend(out)).toBe(true);
  });

  test('without a clientMessageId nothing is looked up', async () => {
    Message.create.mockResolvedValue(doc({ _id: 'm4', attachments: [] }));
    await service.createMessage(base, null);
    expect(Message.findOne).not.toHaveBeenCalled();
    expect(Message.create.mock.calls[0][0].clientMessageId).toBeUndefined();
  });
});

describe('message.sent automation trigger', () => {
  const msg = { _id: 'm1', type: 'message', sender: { username: 'ana' }, attachments: [{ type: 'image' }], createdAt: new Date(), payload: { ciphertext: 'CIPHER', messageIv: 'IV' } };

  test('emits metadata only for public channels', async () => {
    await service._emitMessageSentAutomation(msg, { channel: CH, workspace: 'w1', sender: 'u1', type: 'message' }, null);
    expect(emitter.emit).toHaveBeenCalledWith('message.sent', expect.objectContaining({
      automationOnly: true, workspaceId: 'w1', channelId: CH, channelName: 'general', senderUsername: 'ana', hasAttachments: true, attachmentTypes: ['image'],
    }));
    expect(JSON.stringify(emitter.emit.mock.calls[0][1])).not.toMatch(/CIPHER/);
  });

  test('skips DMs, private channels, system and automation-posted messages', async () => {
    await service._emitMessageSentAutomation(msg, { dm: 'd1', sender: 'u1', type: 'message' }, null);
    await service._emitMessageSentAutomation(msg, { channel: PRIV, workspace: 'w1', sender: 'u1', type: 'message' }, null);
    await service._emitMessageSentAutomation(msg, { channel: CH, workspace: 'w1', sender: 'u1', type: 'system' }, null);
    await service._emitMessageSentAutomation(msg, { channel: CH, workspace: 'w1', sender: 'u1', type: 'message', fromAutomation: true }, null);
    expect(emitter.emit).not.toHaveBeenCalled();
  });
});
