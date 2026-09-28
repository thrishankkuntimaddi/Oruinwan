'use strict';

jest.mock('../message.model.js');
jest.mock('../../../../models/DMSession');
jest.mock('../../../../models/Workspace');
jest.mock('../../conversations/conversationKeys.service', () => ({}));
jest.mock('../messageAccess', () => ({ loadAccessibleMessage: jest.fn() }));
const mockChannels = {};
jest.mock('../../../features/channels/channel.model.js', () => ({
  findById: jest.fn((id) => ({ select: () => ({ lean: async () => mockChannels[String(id)] || null }) })),
}));
jest.mock('../../../features/integrations/webhook.trigger', () => ({ fire: jest.fn() }));

const trigger = require('../../../features/integrations/webhook.trigger');
const { _fireMessageSentWebhook } = require('../messages.service');

const msg = { _id: 'm1', type: 'message', attachments: [], createdAt: new Date(), payload: { ciphertext: 'CIPHER', messageIv: 'IV' } };

describe('message.sent webhook', () => {
  beforeEach(() => {
    mockChannels['64b0000000000000000000e1'] = { workspace: 'w1', isPrivate: false };
    mockChannels['64b0000000000000000000e2'] = { workspace: 'w1', isPrivate: true };
  });

  test('fires for public channel messages with metadata only', async () => {
    await _fireMessageSentWebhook(msg, { channel: '64b0000000000000000000e1', workspace: 'w1', sender: 'u1', type: 'message' });
    expect(trigger.fire).toHaveBeenCalledWith('w1', 'message.sent', expect.objectContaining({ messageId: 'm1', channelId: '64b0000000000000000000e1', senderId: 'u1' }));
    const data = trigger.fire.mock.calls[0][2];
    expect(JSON.stringify(data)).not.toMatch(/CIPHER|IV"/);
  });

  test('skips DMs, private channels and system messages', async () => {
    await _fireMessageSentWebhook(msg, { dm: 'd1', sender: 'u1', type: 'message' });
    await _fireMessageSentWebhook(msg, { channel: '64b0000000000000000000e2', workspace: 'w1', sender: 'u1', type: 'message' });
    await _fireMessageSentWebhook(msg, { channel: '64b0000000000000000000e1', workspace: 'w1', sender: 'u1', type: 'system' });
    expect(trigger.fire).not.toHaveBeenCalled();
  });
});
