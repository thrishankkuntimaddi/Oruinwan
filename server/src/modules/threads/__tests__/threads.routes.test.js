'use strict';

/**
 * Thread life cycle over HTTP: reading a thread (deleted replies drop out, access is the
 * conversation's), replying (one level deep, counters announced to the conversation) and
 * the reply-deletion recount.
 */

const express = require('express');
const http = require('http');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-user'] };
    next();
});

const oid = (n) => n.toString(16).padStart(24, '0');
const ALICE = oid(1);
const BOB = oid(2);
const STRANGER = oid(3);
const CHANNEL = oid(10);
const PARENT = oid(100);
const REPLY = oid(101);

function query(value) {
    const q = {
        select: jest.fn(() => q),
        sort: jest.fn(() => q),
        lean: jest.fn(() => q),
        then: (res, rej) => Promise.resolve(typeof value === 'function' ? value() : value).then(res, rej),
    };
    return q;
}

jest.mock('../../messages/message.model.js', () => ({
    findById: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
    countDocuments: jest.fn(),
}));
jest.mock('../../../features/channels/channel.model.js', () => ({ findById: jest.fn() }));
jest.mock('../../../../models/DMSession', () => ({ findById: jest.fn() }));
jest.mock('../../../identity', () => ({
    workspaces: { membership: jest.fn().mockResolvedValue(null) },
    users: { findById: jest.fn().mockResolvedValue({ _id: 'x', username: 'alice' }) },
}));
jest.mock('../../../identity/hydrate', () => ({ hydrate: jest.fn(async (doc) => doc) }));
jest.mock('../../notifications/notificationService', () => ({ threadReply: jest.fn().mockResolvedValue([]) }));

const Message = require('../../messages/message.model.js');
const Channel = require('../../../features/channels/channel.model.js');
const router = require('../threads.routes');

function makeIo() {
    const emitted = [];
    return {
        emitted,
        to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }),
    };
}

function call(method, path, userId, body, io) {
    const app = express();
    app.use(express.json());
    if (io) app.set('io', io);
    app.use('/api/threads', router);
    return new Promise((resolve, reject) => {
        const server = app.listen(0, () => {
            const data = body ? JSON.stringify(body) : null;
            const req = http.request({
                port: server.address().port, path, method,
                headers: { 'x-user': userId, 'content-type': 'application/json', ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) },
            }, (res) => {
                let text = '';
                res.on('data', (c) => { text += c; });
                res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); });
            });
            req.on('error', (e) => { server.close(); reject(e); });
            if (data) req.write(data);
            req.end();
        });
    });
}

const parentDoc = (over = {}) => ({ _id: PARENT, channel: CHANNEL, workspace: oid(50), sender: ALICE, replyCount: 0, followers: [], payload: { ciphertext: 'c', messageIv: 'i' }, ...over });

beforeEach(() => {
    jest.clearAllMocks();
    Channel.findById.mockImplementation(() => query({ _id: CHANNEL, members: [{ user: ALICE }, { user: BOB }], isPrivate: true, workspace: oid(50), name: 'general' }));
});

describe('GET /api/threads/:messageId', () => {
    it('lists only live replies and hides the deleted parent content', async () => {
        Message.findById.mockImplementation(() => query(parentDoc({ isDeletedUniversally: true })));
        Message.find.mockImplementation(() => query([{ _id: REPLY, parentId: PARENT, sender: BOB }]));

        const res = await call('GET', `/api/threads/${PARENT}`, BOB);

        expect(res.status).toBe(200);
        const filter = Message.find.mock.calls[0][0];
        expect(filter).toMatchObject({ parentId: PARENT, isDeletedUniversally: { $ne: true }, hiddenFor: { $ne: BOB } });
        expect(res.body.parent.payload).toEqual({ isDeleted: true });
        expect(res.body.count).toBe(1);
    });

    it('refuses people outside the conversation', async () => {
        Message.findById.mockImplementation(() => query(parentDoc()));
        const res = await call('GET', `/api/threads/${PARENT}`, STRANGER);
        expect(res.status).toBe(403);
        expect(Message.find).not.toHaveBeenCalled();
    });
});

describe('POST /api/threads/:messageId', () => {
    it('stores the encrypted reply and announces the new count and last reply time', async () => {
        const io = makeIo();
        const created = new Date('2026-10-20T10:00:00Z');
        Message.findById.mockImplementation(() => query(parentDoc()));
        Message.create.mockResolvedValue({ toObject: () => ({ _id: REPLY, parentId: PARENT, sender: BOB, createdAt: created, payload: { ciphertext: 'x', messageIv: 'y' } }) });
        Message.findByIdAndUpdate.mockImplementation(() => query(parentDoc({ replyCount: 1, lastReplyAt: created })));
        Message.findById.mockImplementationOnce(() => query(parentDoc()));
        // followAndNotify reads the followers back.
        Message.findById.mockImplementation(() => query(parentDoc({ followers: [ALICE, BOB] })));

        const res = await call('POST', `/api/threads/${PARENT}`, BOB, { ciphertext: 'x', messageIv: 'y' }, io);

        expect(res.status).toBe(201);
        expect(Message.create.mock.calls[0][0]).toMatchObject({ parentId: PARENT, channel: CHANNEL, payload: { ciphertext: 'x', messageIv: 'y', isEncrypted: true } });
        const updated = io.emitted.find(e => e.event === 'message-updated');
        expect(updated.room).toBe(`channel:${CHANNEL}`);
        expect(updated.payload.updates).toEqual({ replyCount: 1, lastReplyAt: created.toISOString() });
        expect(io.emitted.map(e => e.event)).toEqual(expect.arrayContaining(['thread:created', 'thread-reply']));
    });

    it('rejects plaintext replies', async () => {
        const res = await call('POST', `/api/threads/${PARENT}`, BOB, { text: 'hello' });
        expect(res.status).toBe(400);
        expect(Message.create).not.toHaveBeenCalled();
    });

    it('does not let a reply start its own thread', async () => {
        Message.findById.mockImplementation(() => query(parentDoc({ parentId: oid(99) })));
        const res = await call('POST', `/api/threads/${PARENT}`, BOB, { ciphertext: 'x', messageIv: 'y' });
        expect(res.status).toBe(400);
        expect(Message.create).not.toHaveBeenCalled();
    });

    it('notifies followers with a link that opens the thread', async () => {
        const notificationService = require('../../notifications/notificationService');
        const { followAndNotify } = require('../threads.service');
        Message.findById.mockImplementation(() => query(parentDoc({ followers: [ALICE, BOB] })));
        const n = await followAndNotify(makeIo(), { parent: parentDoc(), replierId: BOB, senderUsername: 'bob' });
        expect(n).toBe(1);
        // The replier and, on the first reply, the parent's author follow the thread.
        expect(Message.updateOne).toHaveBeenCalledWith({ _id: PARENT }, { $addToSet: { followers: { $each: [BOB, ALICE] } } });
        expect(notificationService.threadReply.mock.calls[0][1]).toMatchObject({ followerIds: [ALICE], parentMessageId: PARENT, channelId: CHANNEL });
    });
});

describe('recountThread', () => {
    it('counts live replies and stores the newest reply time', async () => {
        const { recountThread, emitThreadCounters } = require('../threads.service');
        const last = new Date('2026-10-20T09:00:00Z');
        Message.countDocuments.mockResolvedValue(2);
        Message.findOne.mockImplementation(() => query({ createdAt: last }));

        const counters = await recountThread(PARENT);

        expect(counters).toEqual({ replyCount: 2, lastReplyAt: last });
        expect(Message.countDocuments.mock.calls[0][0]).toMatchObject({ parentId: PARENT, isDeletedUniversally: { $ne: true } });
        expect(Message.updateOne).toHaveBeenCalledWith({ _id: PARENT }, { $set: { replyCount: 2, lastReplyAt: last } });

        const io = makeIo();
        emitThreadCounters(io, { _id: PARENT, dm: oid(7) }, counters);
        expect(io.emitted).toEqual([{ room: `dm:${oid(7)}`, event: 'message-updated', payload: { messageId: PARENT, channelId: null, dmId: oid(7), updates: { replyCount: 2, lastReplyAt: last.toISOString() } } }]);
    });
});

describe('locked threads over HTTP', () => {
    it('a reply to a locked thread is refused with 403 THREAD_LOCKED and nothing is stored', async () => {
        Message.findById.mockImplementation(() => query(parentDoc({ threadLockedAt: new Date(), threadLockedBy: ALICE, threadLockedByName: 'alice' })));
        const res = await call('POST', `/api/threads/${PARENT}`, BOB, { ciphertext: 'x', messageIv: 'y' });
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ code: 'THREAD_LOCKED', message: 'This thread was locked by alice. New replies are turned off.' });
        expect(Message.create).not.toHaveBeenCalled();
    });

    it('reading a thread says whether it is locked and what the reader may do', async () => {
        const lockedAt = new Date('2026-10-20T10:00:00Z');
        Channel.findById.mockImplementation(() => query({ _id: CHANNEL, members: [{ user: ALICE }, { user: BOB }], admins: [ALICE], isPrivate: true, workspace: null, name: 'general' }));
        Message.findById.mockImplementation(() => query(parentDoc({ sender: BOB, threadLockedAt: lockedAt, threadLockedBy: ALICE, threadLockedByName: 'alice' })));
        Message.find.mockImplementation(() => query([]));

        const asAdmin = await call('GET', `/api/threads/${PARENT}`, ALICE);
        expect(asAdmin.body.lock).toEqual({ locked: true, lockedAt: lockedAt.toISOString(), lockedBy: { _id: ALICE, username: 'alice' } });
        expect(asAdmin.body.permissions).toEqual({ canModerate: true, canLock: true });

        const asStarter = await call('GET', `/api/threads/${PARENT}`, BOB);
        expect(asStarter.body.permissions).toEqual({ canModerate: false, canLock: true });
    });

    it('a member who did not start the thread cannot lock it; a channel admin can', async () => {
        Channel.findById.mockImplementation(() => query({ _id: CHANNEL, members: [{ user: ALICE }, { user: BOB }, { user: STRANGER }], admins: [ALICE], isPrivate: true, workspace: null, name: 'general' }));
        Message.findById.mockImplementation(() => query(parentDoc({ sender: BOB })));
        Message.findByIdAndUpdate.mockImplementation((id, update) => query(parentDoc({ ...update.$set })));

        const denied = await call('POST', `/api/threads/${PARENT}/lock`, STRANGER, {});
        expect(denied.status).toBe(403);

        const io = makeIo();
        const ok = await call('POST', `/api/threads/${PARENT}/lock`, ALICE, {}, io);
        expect(ok.status).toBe(200);
        expect(ok.body).toMatchObject({ locked: true, lockedBy: { _id: ALICE, username: 'alice' } });
        expect(io.emitted).toEqual([expect.objectContaining({ room: `channel:${CHANNEL}`, event: 'thread:locked' })]);

        const unlocked = await call('DELETE', `/api/threads/${PARENT}/lock`, ALICE, null, io);
        expect(unlocked.body).toMatchObject({ locked: false, lockedBy: null });
    });
});
