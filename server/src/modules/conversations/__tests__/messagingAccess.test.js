'use strict';

/**
 * The access fixes of the communication audit, end to end through the messages module:
 *   - GET /v2/messages/missed: outsiders get nothing; a group member gets nothing from before they joined;
 *   - reactions check the conversation (and no longer hand any message to anyone);
 *   - a thread reply is announced to the thread (`thread-reply`), never as a new message.
 */

const express = require('express');
const http = require('http');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => { req.user = { sub: req.headers['x-user'] }; next(); });

const oid = (c) => String(c).repeat(24).slice(0, 24);
const ANA = oid('a');
const BEN = oid('b');
const OUTSIDER = oid('c');
const WS = oid('d');
const CH = oid('e');
const DM = oid('f');
const MSG = oid('1');

const q = (value) => {
    const chain = {
        select: () => chain, sort: () => chain, limit: () => chain, lean: () => chain, populate: () => chain,
        then: (res, rej) => Promise.resolve(typeof value === 'function' ? value() : value).then(res, rej),
    };
    return chain;
};

jest.mock('../../messages/message.model.js', () => ({
    find: jest.fn(), findById: jest.fn(), create: jest.fn(), findByIdAndUpdate: jest.fn(), updateOne: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../features/channels/channel.model.js', () => ({ findById: jest.fn(), updateOne: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../../models/DMSession', () => ({ findById: jest.fn(), updateOne: jest.fn().mockReturnValue({ catch: () => {} }) }));
jest.mock('../../../identity', () => ({
    workspaces: { findById: jest.fn(), membership: jest.fn().mockResolvedValue(null) },
    users: { findById: jest.fn().mockResolvedValue({ username: 'ana' }), findManyByIds: jest.fn(async () => new Map()) },
}));
jest.mock('../../../identity/hydrate', () => ({ hydrate: jest.fn(async (d) => d) }));
jest.mock('../../notifications/notificationService', () => ({ reaction: jest.fn().mockResolvedValue(), emitToUser: jest.fn() }));

const Message = require('../../messages/message.model.js');
const Channel = require('../../../features/channels/channel.model.js');
const DMSession = require('../../../../models/DMSession');
const identity = require('../../../identity');

const activeWs = { _id: WS, members: [ANA, BEN].map((user) => ({ user, status: 'active' })) };

function post(path, userId, body) {
    const app = express();
    app.use(express.json());
    app.use('/api/v2/messages', require('../../messages/messages.routes'));
    return new Promise((resolve, reject) => {
        const server = app.listen(0, () => {
            const data = JSON.stringify(body);
            const req = http.request({ port: server.address().port, path, method: 'POST', headers: { 'x-user': userId, 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, (res) => {
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

function get(path, userId) {
    const app = express();
    app.use('/api/v2/messages', require('../../messages/messages.routes'));
    return new Promise((resolve, reject) => {
        const server = app.listen(0, () => {
            http.get({ port: server.address().port, path, headers: { 'x-user': userId } }, (res) => {
                let text = '';
                res.on('data', (c) => { text += c; });
                res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); });
            }).on('error', (e) => { server.close(); reject(e); });
        });
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    identity.workspaces.findById.mockResolvedValue(activeWs);
    Message.find.mockReturnValue(q([]));
});

describe('GET /v2/messages/missed', () => {
    test('a public channel of another workspace returns nothing to an outsider', async () => {
        Channel.findById.mockReturnValue(q({ _id: CH, workspace: WS, isPrivate: false, members: [{ user: ANA }] }));
        const res = await get(`/api/v2/messages/missed?type=channel&conversationId=${CH}`, OUTSIDER);
        expect(res.status).toBe(404);
        expect(Message.find).not.toHaveBeenCalled();
    });

    test('a channel member gets the missed messages', async () => {
        Channel.findById.mockReturnValue(q({ _id: CH, workspace: WS, members: [{ user: ANA }] }));
        const res = await get(`/api/v2/messages/missed?type=channel&conversationId=${CH}`, ANA);
        expect(res.status).toBe(200);
        expect(Message.find).toHaveBeenCalledWith(expect.objectContaining({ channel: CH }));
    });

    test('a group member only gets messages from when they joined', async () => {
        const joined = new Date('2026-05-01T00:00:00Z');
        DMSession.findById.mockReturnValue(q({ _id: DM, workspace: WS, isGroup: true, participants: [ANA, BEN], memberSince: [{ user: BEN, at: joined }] }));
        const res = await get(`/api/v2/messages/missed?type=dm&conversationId=${DM}`, BEN);
        expect(res.status).toBe(200);
        expect(Message.find).toHaveBeenCalledWith(expect.objectContaining({ dm: DM, createdAt: { $gte: joined } }));
    });

    test('a DM participant who left the workspace gets nothing', async () => {
        identity.workspaces.findById.mockResolvedValue({ _id: WS, members: [{ user: ANA, status: 'active' }, { user: BEN, status: 'removed' }] });
        DMSession.findById.mockReturnValue(q({ _id: DM, workspace: WS, participants: [ANA, BEN] }));
        const res = await get(`/api/v2/messages/missed?type=dm&conversationId=${DM}`, BEN);
        expect(res.status).toBe(403);
        expect(Message.find).not.toHaveBeenCalled();
    });
});

describe('reactions', () => {
    const svc = () => require('../../messages/messages.service');

    test('someone outside the conversation cannot react, and gets no message back', async () => {
        const doc = { _id: MSG, channel: CH, reactions: [], save: jest.fn() };
        Message.findById.mockReturnValue(q(doc));
        Channel.findById.mockReturnValue(q({ _id: CH, workspace: WS, isPrivate: true, members: [{ user: ANA }] }));
        await expect(svc().addReaction(MSG, OUTSIDER, '👍', null)).rejects.toMatchObject({ status: 404 });
        await expect(svc().removeReaction(MSG, OUTSIDER, '👍', null)).rejects.toMatchObject({ status: 404 });
        expect(doc.save).not.toHaveBeenCalled();
    });

    test('a member reacts, several emojis each; removing without an emoji clears mine', async () => {
        const doc = { _id: MSG, channel: CH, reactions: [], save: jest.fn() };
        Message.findById.mockReturnValue(q(doc));
        Channel.findById.mockReturnValue(q({ _id: CH, workspace: WS, members: [{ user: ANA }] }));
        await svc().addReaction(MSG, ANA, '👍', null);
        await svc().addReaction(MSG, ANA, '🎉', null);
        expect(doc.reactions.map((r) => r.emoji)).toEqual(['👍', '🎉']);
        await svc().removeReaction(MSG, ANA, null, null);
        expect(doc.reactions).toEqual([]);
    });
});

describe('createMessage announcements', () => {
    test('a thread reply goes to the thread, not the main conversation', async () => {
        const created = { _id: MSG, createdAt: new Date(), toObject() { return { _id: MSG, sender: ANA, parentId: oid('2') }; } };
        Message.create.mockResolvedValue(created);
        Message.findByIdAndUpdate.mockReturnValue(q({ replyCount: 1, lastReplyAt: new Date() }));
        const emitted = [];
        const io = { to: (rooms) => ({ emit: (event, payload) => emitted.push({ rooms, event, payload }) }) };
        await require('../../messages/messages.service').createMessage({
            type: 'message', sender: ANA, dm: DM, workspace: WS, participants: [ANA, BEN], parentId: oid('2'), parent: { _id: oid('2'), dm: DM },
            ciphertext: 'c', messageIv: 'i', clientTempId: 'tmp1',
        }, io);
        expect(emitted.some((e) => e.event === 'new-message')).toBe(false);
        const reply = emitted.find((e) => e.event === 'thread-reply');
        expect(reply.rooms).toEqual([`dm:${DM}`, `user:${ANA}`, `user:${BEN}`]);
        expect(reply.payload).toMatchObject({ parentId: oid('2'), clientTempId: 'tmp1' });
    });
});

describe('REST sends follow the same rules as the socket', () => {
    const body = { ciphertext: 'c', messageIv: 'i', isEncrypted: true };

    test('a blocked DM refuses the message with BLOCKED', async () => {
        DMSession.findById.mockReturnValue(q({ _id: DM, workspace: WS, participants: [ANA, BEN], blockedBy: [{ user: BEN }] }));
        const res = await post('/api/v2/messages/direct', ANA, { ...body, dmSessionId: DM });
        expect(res).toMatchObject({ status: 403, body: { code: 'BLOCKED' } });
        expect(Message.create).not.toHaveBeenCalled();
    });

    test('a public channel needs joining before posting at the top level', async () => {
        Channel.findById.mockReturnValue(q({ _id: CH, workspace: WS, isPrivate: false, members: [{ user: ANA }] }));
        const res = await post('/api/v2/messages/channel', BEN, { ...body, channelId: CH });
        expect(res).toMatchObject({ status: 403, body: { code: 'NOT_A_CHANNEL_MEMBER' } });
    });

    test('a quote must come from the same conversation', async () => {
        Channel.findById.mockReturnValue(q({ _id: CH, workspace: WS, members: [{ user: ANA }] }));
        Message.findById.mockReturnValue(q({ _id: MSG, channel: oid('9') }));
        const res = await post('/api/v2/messages/channel', ANA, { ...body, channelId: CH, quotedMessageId: MSG });
        expect(res).toMatchObject({ status: 404, body: { code: 'INVALID_QUOTE' } });
    });

    test('a DM can only be started with an active member of the workspace', async () => {
        const messagesService = require('../../messages/messages.service');
        await expect(messagesService.findOrCreateDMSession(ANA, OUTSIDER, WS)).rejects.toMatchObject({ status: 403 });
    });
});
