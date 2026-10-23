'use strict';

/**
 * Read receipts: one helper for the socket's mark-chat-read and REST reset-unread — access
 * check, readBy + read time, read-update (unless receipts are off) and conversation:read —
 * and message info's per-reader read times.
 */

const oid = (n) => n.toString(16).padStart(24, '0');
const ME = oid(1);
const DM = oid(20);
const CH = oid(30);

jest.mock('../message.model', () => ({ updateMany: jest.fn(), updateOne: jest.fn() }));
jest.mock('../messageAccess', () => ({ canAccessMessage: jest.fn() }));
jest.mock('../../../features/auth/privacy.service', () => ({ getPrivacy: jest.fn() }));
jest.mock('../../notifications/notificationService', () => ({ markConversationRead: jest.fn().mockResolvedValue([]) }));
jest.mock('../../../socket/getIO', () => ({ getIO: jest.fn() }));
jest.mock('../../../identity', () => ({ workspaces: {}, users: {} }));

const Message = require('../message.model');
const { canAccessMessage } = require('../messageAccess');
const privacy = require('../../../features/auth/privacy.service');
const notifications = require('../../notifications/notificationService');
const { getIO } = require('../../../socket/getIO');
const { markConversationRead, readUpdate, withReadTimes } = require('../readReceipts.service');
const { resetUnread } = require('../../../features/chatlist/chatlist.controller');

function makeIo() {
    const emits = [];
    return { emits, io: { to: jest.fn((room) => ({ emit: (event, payload) => emits.push({ room, event, payload }) })) } };
}

function makeRes() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn((c) => { res.statusCode = c; return res; });
    res.json = jest.fn((b) => { res.body = b; return res; });
    return res;
}

beforeEach(() => {
    jest.clearAllMocks();
    Message.updateMany.mockResolvedValue({ modifiedCount: 2 });
    privacy.getPrivacy.mockResolvedValue({ readReceipts: true });
    canAccessMessage.mockResolvedValue(true);
});

describe('markConversationRead', () => {
    test('a DM participant: readBy and a read time on unread messages from others, then events', async () => {
        const { io, emits } = makeIo();
        const r = await markConversationRead(io, { readerId: ME, type: 'dm', id: DM });

        expect(r).toEqual({ ok: true, modified: 2 });
        expect(canAccessMessage).toHaveBeenCalledWith({ dm: DM }, ME);
        const [filter, update] = Message.updateMany.mock.calls[0];
        expect(filter).toEqual({ dm: DM, sender: { $ne: ME }, readBy: { $ne: ME } });
        expect(update.$addToSet).toEqual({ readBy: ME });
        expect(update.$push.readReceipts.user).toBe(ME);
        expect(update.$push.readReceipts.at).toBeInstanceOf(Date);
        expect(emits).toEqual([
            { room: `dm:${DM}`, event: 'read-update', payload: { readerId: ME, dmSessionId: DM } },
            { room: `user:${ME}`, event: 'conversation:read', payload: { conversationType: 'dm', conversationId: DM } },
        ]);
        expect(notifications.markConversationRead).toHaveBeenCalledWith(io, { userId: ME, conversationType: 'dm', conversationId: DM });
    });

    test('a channel: same, to the channel room', async () => {
        const { io, emits } = makeIo();
        await markConversationRead(io, { readerId: ME, type: 'channel', id: CH });
        expect(Message.updateMany.mock.calls[0][0]).toEqual({ channel: CH, sender: { $ne: ME }, readBy: { $ne: ME } });
        expect(emits[0]).toEqual({ room: `channel:${CH}`, event: 'read-update', payload: { readerId: ME, channelId: CH } });
    });

    test('someone outside the conversation records nothing', async () => {
        canAccessMessage.mockResolvedValue(false);
        const { io, emits } = makeIo();
        expect(await markConversationRead(io, { readerId: ME, type: 'dm', id: DM })).toEqual({ ok: false, reason: 'forbidden' });
        expect(Message.updateMany).not.toHaveBeenCalled();
        expect(emits).toEqual([]);
    });

    test('receipts off: still recorded, but only the reader is told', async () => {
        privacy.getPrivacy.mockResolvedValue({ readReceipts: false });
        const { io, emits } = makeIo();
        await markConversationRead(io, { readerId: ME, type: 'dm', id: DM });
        expect(Message.updateMany).toHaveBeenCalled();
        expect(emits.map((e) => e.event)).toEqual(['conversation:read']);

        privacy.getPrivacy.mockResolvedValue({ readReceipts: true });
        const second = makeIo();
        await markConversationRead(second.io, { readerId: ME, type: 'dm', id: DM, receipts: false });
        expect(second.emits.map((e) => e.event)).toEqual(['conversation:read']);
    });

    test('rejects unknown conversation types', async () => {
        expect(await markConversationRead(null, { readerId: ME, type: 'thread', id: DM })).toEqual({ ok: false, reason: 'invalid' });
        expect(canAccessMessage).not.toHaveBeenCalled();
    });
});

describe('POST /api/chat/reset-unread', () => {
    test('marks read through the shared helper (with events when sockets run)', async () => {
        const { io, emits } = makeIo();
        getIO.mockReturnValue(io);
        const res = makeRes();
        await resetUnread({ user: { sub: ME }, body: { type: 'dm', id: DM } }, res);
        expect(res.body).toEqual({ success: true });
        expect(Message.updateMany).toHaveBeenCalled();
        expect(emits.map((e) => e.event)).toEqual(['read-update', 'conversation:read']);
    });

    test('403 for a conversation the caller is not in', async () => {
        canAccessMessage.mockResolvedValue(false);
        const res = makeRes();
        await resetUnread({ user: { sub: ME }, body: { type: 'channel', id: CH } }, res);
        expect(res.statusCode).toBe(403);
        expect(Message.updateMany).not.toHaveBeenCalled();
    });

    test('400 for a missing or invalid id', async () => {
        const res = makeRes();
        await resetUnread({ user: { sub: ME }, body: { type: 'dm', id: 'nope' } }, res);
        expect(res.statusCode).toBe(400);
        const res2 = makeRes();
        await resetUnread({ user: { sub: ME }, body: { type: 'dm' } }, res2);
        expect(res2.statusCode).toBe(400);
    });
});

describe('read times', () => {
    test('readUpdate adds the reader and when', () => {
        const at = new Date('2026-10-23T10:00:00Z');
        expect(readUpdate(ME, at)).toEqual({ $addToSet: { readBy: ME }, $push: { readReceipts: { user: ME, at } } });
    });

    test('withReadTimes: first read time per reader, null for older reads without one', () => {
        const users = [{ _id: oid(2), username: 'ben' }, { _id: oid(3), username: 'chen' }];
        const receipts = [
            { user: oid(2), at: new Date('2026-10-23T10:05:00Z') },
            { user: oid(2), at: new Date('2026-10-23T10:01:00Z') },
            { user: oid(9), at: new Date('2026-10-23T10:00:00Z') }, // hidden reader: not added
        ];
        expect(withReadTimes(users, receipts)).toEqual([
            { _id: oid(2), username: 'ben', readAt: '2026-10-23T10:01:00.000Z' },
            { _id: oid(3), username: 'chen', readAt: null },
        ]);
        expect(withReadTimes(users, undefined).map((u) => u.readAt)).toEqual([null, null]);
    });
});
