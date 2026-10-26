'use strict';

/** Deleting a thread reply for everyone recounts the thread and tells the conversation. */

jest.mock('../message.model.js', () => ({
    findById: jest.fn(),
    countDocuments: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../../models/DMSession', () => ({}));
// ME and OTHER are active members of the workspace (oid 30).
jest.mock('../../../identity', () => ({
    users: { findById: jest.fn().mockResolvedValue({ username: 'alice' }) },
    workspaces: { findById: jest.fn().mockResolvedValue({ members: ['000000000000000000000001', '000000000000000000000002'].map((user) => ({ user, status: 'active' })) }) },
}));
jest.mock('../../conversations/conversationKeys.service', () => ({}));
jest.mock('../../../shared/events/bus', () => ({ publish: jest.fn().mockResolvedValue() }));
// Both people are members of the channel; admins vary per test.
const mockChannel = (over = {}) => ({ select: () => ({ lean: async () => ({ members: [{ user: '000000000000000000000001' }, { user: '000000000000000000000002' }], admins: [], createdBy: '000000000000000000000002', workspace: '00000000000000000000001e', ...over }) }) });
jest.mock('../../../features/channels/channel.model.js', () => ({
    findById: jest.fn(() => mockChannel()),
}));

const Message = require('../message.model.js');
const messagesService = require('../messages.service');

const oid = (n) => n.toString(16).padStart(24, '0');
const ME = oid(1);
const PARENT = oid(100);
const REPLY = oid(101);
const CHANNEL = oid(10);

function query(value) {
    const q = { select: () => q, sort: () => q, lean: () => q, then: (res, rej) => Promise.resolve(value).then(res, rej) };
    return q;
}

test('deleting a reply recounts its thread and announces the new counters', async () => {
    const reply = { _id: REPLY, parentId: PARENT, channel: CHANNEL, sender: ME, hiddenFor: [], save: jest.fn().mockResolvedValue() };
    Message.findById.mockResolvedValue(reply);
    Message.countDocuments.mockResolvedValue(0);
    Message.findOne.mockImplementation(() => query(null));
    const emitted = [];
    const io = { to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) };

    await messagesService.deleteMessage(REPLY, ME, io, 'everyone');

    expect(reply.isDeletedUniversally).toBe(true);
    const deleted = emitted.find(e => e.event === 'message:deleted');
    expect(deleted.payload.parentId).toBe(PARENT);
    expect(deleted.payload.deletedByName).toBe('alice');
    expect(Message.updateOne).toHaveBeenCalledWith({ _id: PARENT }, { $set: { replyCount: 0, lastReplyAt: null } });
    const updated = emitted.find(e => e.event === 'message-updated');
    expect(updated).toEqual({ room: `channel:${CHANNEL}`, event: 'message-updated', payload: { messageId: PARENT, channelId: CHANNEL, dmId: null, updates: { replyCount: 0, lastReplyAt: null } } });
});

test('a missing message is a 404, not a server error', async () => {
    Message.findById.mockResolvedValue(null);
    await expect(messagesService.deleteMessage(REPLY, ME, null)).rejects.toMatchObject({ status: 404 });
});

describe('who may delete someone else\'s reply for everyone', () => {
    const Channel = require('../../../features/channels/channel.model.js');
    const identity = require('../../../identity');
    const OTHER = oid(2);
    const reply = () => ({ _id: REPLY, parentId: PARENT, channel: CHANNEL, sender: OTHER, hiddenFor: [], save: jest.fn().mockResolvedValue() });

    beforeEach(() => {
        Message.countDocuments.mockResolvedValue(0);
        Message.findOne.mockImplementation(() => query(null));
        identity.workspaces.membership = jest.fn().mockResolvedValue({ member: true, isAdmin: false });
    });

    test('a channel admin can', async () => {
        Channel.findById.mockImplementation(() => mockChannel({ admins: [ME] }));
        const doc = reply();
        Message.findById.mockResolvedValue(doc);
        await messagesService.deleteMessage(REPLY, ME, null, 'everyone');
        expect(doc.isDeletedUniversally).toBe(true);
    });

    test('a workspace owner/admin can', async () => {
        Channel.findById.mockImplementation(() => mockChannel());
        identity.workspaces.membership.mockResolvedValue({ member: true, isAdmin: true });
        const doc = reply();
        Message.findById.mockResolvedValue(doc);
        await messagesService.deleteMessage(REPLY, ME, null, 'everyone');
        expect(doc.isDeletedUniversally).toBe(true);
    });

    test('a plain member cannot', async () => {
        Channel.findById.mockImplementation(() => mockChannel());
        Message.findById.mockResolvedValue(reply());
        await expect(messagesService.deleteMessage(REPLY, ME, null, 'everyone')).rejects.toMatchObject({ status: 403 });
    });
});
