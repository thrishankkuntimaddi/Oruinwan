'use strict';

/**
 * Files on thread replies get the same check as files on channel and DM messages: a file a
 * message points at becomes readable to that conversation (uploads/upload.access.js), so a
 * reply may only carry files its sender uploaded, at their /api/v2/uploads/file URL.
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
const CHANNEL = oid(10);
const PARENT = oid(100);
const REPLY = oid(101);

function query(value) {
    const q = {
        select: jest.fn(() => q),
        sort: jest.fn(() => q),
        populate: jest.fn(() => q),
        lean: jest.fn(() => q),
        then: (res, rej) => Promise.resolve(value).then(res, rej),
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
    users: { findById: jest.fn().mockResolvedValue({ _id: 'x', username: 'bob' }) },
}));
jest.mock('../../../identity/hydrate', () => ({ hydrate: jest.fn(async (doc) => doc) }));
jest.mock('../../notifications/notificationService', () => ({ threadReply: jest.fn().mockResolvedValue([]) }));
jest.mock('../../uploads/attachmentSanitizer', () => ({ sanitizeAttachments: jest.fn() }));

const Message = require('../../messages/message.model.js');
const Channel = require('../../../features/channels/channel.model.js');
const { sanitizeAttachments } = require('../../uploads/attachmentSanitizer');
const router = require('../threads.routes');

function post(userId, body) {
    const app = express();
    app.use(express.json());
    app.set('io', { to: () => ({ emit: () => {} }) });
    app.use('/api/threads', router);
    return new Promise((resolve, reject) => {
        const server = app.listen(0, () => {
            const data = JSON.stringify(body);
            const req = http.request({
                port: server.address().port, path: `/api/threads/${PARENT}`, method: 'POST',
                headers: { 'x-user': userId, 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
            }, (res) => {
                let text = '';
                res.on('data', (c) => { text += c; });
                res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); });
            });
            req.on('error', (e) => { server.close(); reject(e); });
            req.write(data);
            req.end();
        });
    });
}

const parentDoc = { _id: PARENT, channel: CHANNEL, workspace: oid(50), sender: ALICE, replyCount: 0, followers: [], payload: { ciphertext: 'c', messageIv: 'i' } };
const FILE = { type: 'image', url: '/api/v2/uploads/file?path=channels%2Fa.png', name: 'a.png', size: 10, mimeType: 'image/png' };

beforeEach(() => {
    jest.clearAllMocks();
    Channel.findById.mockImplementation(() => query({ _id: CHANNEL, members: [{ user: ALICE }, { user: BOB }], isPrivate: true, workspace: oid(50), name: 'general' }));
    Message.findById.mockImplementation(() => query(parentDoc));
    Message.create.mockImplementation(async (doc) => ({ toObject: () => ({ ...doc, _id: REPLY, createdAt: new Date() }) }));
    Message.findByIdAndUpdate.mockImplementation(() => query({ ...parentDoc, replyCount: 1 }));
});

test('stores only the attachments the sanitizer accepts', async () => {
    sanitizeAttachments.mockResolvedValue([FILE]);
    const res = await post(BOB, { ciphertext: 'x', messageIv: 'y', attachments: [{ ...FILE, extra: 'dropped' }] });
    expect(res.status).toBe(201);
    expect(sanitizeAttachments).toHaveBeenCalledWith([{ ...FILE, extra: 'dropped' }], BOB);
    expect(Message.create.mock.calls[0][0].attachments).toEqual([FILE]);
});

test('refuses a reply pointing at a file that is not an upload of the sender', async () => {
    sanitizeAttachments.mockRejectedValue(Object.assign(new Error('Attachments must be uploaded files'), { status: 400, code: 'INVALID_ATTACHMENT' }));
    const res = await post(BOB, { ciphertext: 'x', messageIv: 'y', attachments: [{ type: 'file', url: 'https://evil.example/x' }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ATTACHMENT');
    expect(Message.create).not.toHaveBeenCalled();
});

test('a reply without files still works', async () => {
    sanitizeAttachments.mockResolvedValue([]);
    const res = await post(BOB, { ciphertext: 'x', messageIv: 'y' });
    expect(res.status).toBe(201);
    expect(Message.create.mock.calls[0][0].attachments).toEqual([]);
});
