'use strict';

// postEncryptedReply: a server-side thread reply (the assistant's reply_in_thread / create_thread)
// is broadcast like a composer reply and @here / @channel / @everyone in it notify the channel.

jest.mock('../../messages/message.model.js', () => ({ create: jest.fn(), findByIdAndUpdate: jest.fn(), updateOne: jest.fn(), findById: jest.fn() }));
jest.mock('../../../features/channels/channel.model.js', () => ({ findById: jest.fn() }));
jest.mock('../../../../models/DMSession', () => ({ findById: jest.fn() }));
jest.mock('../../notifications/notificationService', () => ({ mention: jest.fn(), threadReply: jest.fn() }));
jest.mock('../../../identity', () => ({
    users: { findManyByIds: jest.fn(async () => new Map()) },
    workspaces: {
        // Everyone in these tests is an active member of the workspace.
        findById: jest.fn(async () => ({ members: new Proxy([], { get: (t, k) => (k === 'some' ? () => true : t[k]) }) })),
    },
}));
jest.mock('../../../identity/hydrate', () => ({ hydrate: async (x) => x, USER_MIN: {} }));
jest.mock('../../../features/channels/channelMute.controller', () => ({ canManageChannel: jest.fn() }));
jest.mock('../../../features/presence/presence.service', () => ({ getBulkPresenceAsync: jest.fn() }));

const Message = require('../../messages/message.model.js');
const Channel = require('../../../features/channels/channel.model.js');
const notificationService = require('../../notifications/notificationService');
const { getBulkPresenceAsync } = require('../../../features/presence/presence.service');
const { postEncryptedReply } = require('../threads.service');

const q = (v) => ({ select: () => ({ lean: async () => v }) });

function fakeIo() {
    const emitted = [];
    return { emitted, to: (room) => ({ emit: (event, data) => emitted.push({ room, event, data }) }) };
}

const parent = { _id: 'p1', channel: 'c1', workspace: 'w1', company: null, sender: 'alice', replyCount: 0 };

beforeEach(() => {
    jest.clearAllMocks();
    Message.create.mockImplementation(async (doc) => ({ _id: 'r1', toObject: () => ({ _id: 'r1', ...doc, sender: { _id: doc.sender, username: 'alice' }, createdAt: new Date('2026-10-24T10:00:00Z') }) }));
    Message.findByIdAndUpdate.mockImplementation(() => ({ lean: async () => ({ _id: 'p1', channel: 'c1', replyCount: 1 }) }));
    Message.updateOne.mockResolvedValue({});
    Message.findById.mockImplementation(() => q({ followers: ['alice'] }));
    Channel.findById.mockImplementation(() => q({ name: 'general', workspace: 'w1', members: [{ user: 'alice' }, { user: 'bob' }, { user: 'carol' }] }));
});

test('stores the encrypted reply and emits thread:created, thread-reply and message-updated to the channel', async () => {
    const io = fakeIo();
    const reply = await postEncryptedReply(io, { parent, senderId: 'alice', ciphertext: 'CT', messageIv: 'IV' });
    expect(reply._id).toBe('r1');
    expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({
        parentId: 'p1', channel: 'c1', sender: 'alice', payload: { ciphertext: 'CT', messageIv: 'IV', isEncrypted: true },
    }));
    expect(Message.findByIdAndUpdate).toHaveBeenCalledWith('p1', expect.objectContaining({ $inc: { replyCount: 1 } }), { new: true });
    expect(io.emitted.map((e) => [e.room, e.event])).toEqual([
        ['channel:c1', 'thread:created'], ['channel:c1', 'thread-reply'], ['channel:c1', 'message-updated'],
    ]);
    // the replier and the parent's author follow the thread
    expect(Message.updateOne).toHaveBeenCalledWith({ _id: 'p1' }, { $addToSet: { followers: { $each: ['alice'] } } });
});

test('@here in the reply notifies the channel members who are online', async () => {
    getBulkPresenceAsync.mockResolvedValue({ bob: { status: 'online' }, carol: { status: 'offline' } });
    await postEncryptedReply(fakeIo(), { parent, senderId: 'alice', ciphertext: 'CT', messageIv: 'IV', mentionText: '@here' });
    const notified = notificationService.mention.mock.calls.map(([, a]) => [a.mentionedUserId, !!a.isEveryone, a.parentMessageId]);
    expect(notified).toEqual([['bob', true, 'p1']]);
});

test('@everyone in the reply works like @channel: every member but the replier', async () => {
    await postEncryptedReply(fakeIo(), { parent, senderId: 'alice', ciphertext: 'CT', messageIv: 'IV', mentionText: '@everyone' });
    const notified = notificationService.mention.mock.calls.map(([, a]) => a.mentionedUserId).sort();
    expect(notified).toEqual(['bob', 'carol']);
    expect(getBulkPresenceAsync).not.toHaveBeenCalled();
});

test('a notification failure never fails the reply', async () => {
    notificationService.mention.mockRejectedValue(new Error('push down'));
    Channel.findById.mockImplementation(() => { throw new Error('db down'); });
    await expect(postEncryptedReply(fakeIo(), { parent, senderId: 'alice', ciphertext: 'CT', messageIv: 'IV', mentionText: '@channel' })).resolves.toMatchObject({ _id: 'r1' });
});
