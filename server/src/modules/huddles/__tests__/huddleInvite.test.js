'use strict';

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

jest.mock('../../../identity', () => ({
    users: { findById: async (id) => ({ _id: id, username: id, profile: { name: id } }) },
    workspaces: { membership: async (ws, id) => ({ member: ['alice', 'bob', 'carol'].includes(id) }) },
}));
jest.mock('../../../features/push/push.service', () => ({ sendCallToUser: jest.fn(async () => null) }));
jest.mock('../../notifications/notificationService', () => ({ missedCall: jest.fn(async () => null) }));

const registerHuddleHandlers = require('../huddles.socket');
const { HuddleRegistry } = require('../huddleRegistry');

// Adding someone to a call already running: they ring and may join, though not in the DM.
describe('add people to a call', () => {
    let io, httpServer, url, registry;
    const clients = [];
    const DMS = { d1: ['alice', 'bob'] };

    beforeEach((done) => {
        registry = new HuddleRegistry({ maxParticipants: 10 });
        httpServer = http.createServer();
        io = new Server(httpServer);
        io.use((socket, next) => {
            socket.user = { id: socket.handshake.auth.userId };
            socket.data.username = socket.user.id;
            next();
        });
        io.on('connection', (socket) => {
            socket.join(`user:${socket.user.id}`);
            registerHuddleHandlers(io, socket, {
                registry,
                history: { started: async () => null, joined() {}, left() {}, ended() {} },
                meetings: { huddleEnded: async () => [] },
                planLimits: async () => null,
                ringTimeoutMs: 5000,
                verify: async (s, { dmId }) => ((DMS[dmId] || []).includes(String(s.user.id))
                    ? { ok: true, scope: { dmId, workspaceId: 'w1' }, recipientIds: DMS[dmId] }
                    : { ok: false, message: 'Not a participant' }),
            });
        });
        httpServer.listen(0, () => { url = `http://localhost:${httpServer.address().port}`; done(); });
    });

    afterEach(() => {
        clients.splice(0).forEach((c) => c.close());
        io.close();
        httpServer.close();
    });

    const connect = (userId) => new Promise((resolve) => {
        const c = Client(url, { auth: { userId }, transports: ['websocket'], forceNew: true });
        clients.push(c);
        c.on('connect', () => resolve(c));
    });
    const next = (socket, event, filter = () => true, ms = 2000) => new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
        const h = (p) => { if (filter(p)) { clearTimeout(t); socket.off(event, h); resolve(p); } };
        socket.on(event, h);
    });
    const join = (socket, huddleId, dmId) => {
        const roster = next(socket, 'huddle:roster', (p) => p.huddleId === huddleId);
        socket.emit('huddle:join', { huddleId, dmId });
        return roster;
    };
    const invite = (socket, data) => new Promise((resolve) => socket.emit('huddle:invite', data, resolve));

    test('someone in the call adds Carol: she rings, then joins although she is not in the DM', async () => {
        const alice = await connect('alice');
        const bob = await connect('bob');
        const carol = await connect('carol');
        await join(alice, 'call-1', 'd1');
        await join(bob, 'call-1', 'd1');

        const ring = next(carol, 'huddle:ring', (p) => p.huddleId === 'call-1');
        expect(await invite(alice, { huddleId: 'call-1', userIds: ['carol'] })).toEqual({ ok: true, invited: 1 });
        expect(await ring).toMatchObject({ huddleId: 'call-1', ring: true, invited: true, dmId: 'd1' });

        const roster = await join(carol, 'call-1', 'd1');
        expect(roster.participants.map((p) => p.userId).sort()).toEqual(['alice', 'bob']);
        expect(registry.get('call-1').participants.size).toBe(3);
    });

    test('without an invite an outsider still cannot join', async () => {
        const alice = await connect('alice');
        const carol = await connect('carol');
        await join(alice, 'call-2', 'd1');
        const err = next(carol, 'huddle:error', (p) => p.huddleId === 'call-2');
        carol.emit('huddle:join', { huddleId: 'call-2', dmId: 'd1' });
        expect(await err).toMatchObject({ code: 'FORBIDDEN' });
    });

    test('only people in the call can invite, and only workspace members can be invited', async () => {
        const alice = await connect('alice');
        const carol = await connect('carol');
        await join(alice, 'call-3', 'd1');
        expect(await invite(carol, { huddleId: 'call-3', userIds: ['bob'] })).toMatchObject({ ok: false });
        expect(await invite(alice, { huddleId: 'call-3', userIds: ['mallory'] })).toMatchObject({ ok: false });
    });
});
