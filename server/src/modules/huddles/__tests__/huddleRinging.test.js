'use strict';

// Signed decline links need a server secret.
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-secret-for-decline-links';
const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

const pushed = [];
jest.mock('../../../features/push/push.service', () => ({
    sendCallToUser: jest.fn(async (userId, type, payload) => { pushed.push({ userId, type, payload }); }),
    sendToUser: jest.fn(async () => {}),
}));
const missed = [];
const started = [];
jest.mock('../../notifications/notificationService', () => ({
    missedCall: jest.fn(async (io, args) => { missed.push(args); return []; }),
    huddleStarted: jest.fn(async (io, args) => { started.push(args); return []; }),
}));
jest.mock('../../../identity', () => ({
    users: { findById: async (id) => ({ _id: id, profilePicture: `https://img.test/${id}.png`, profile: { name: String(id).toUpperCase() } }) },
}));

const registerHuddleHandlers = require('../huddles.socket');
const { declineCall } = require('../huddles.socket');
const { HuddleRegistry } = require('../huddleRegistry');
const ringing = require('../huddleRinging');

// DM, group-DM and channel calls: who rings, and every way a ring stops.
describe('call ringing', () => {
    let io, httpServer, url, registry;
    const clients = [];
    const DMS = { d1: ['alice', 'bob'], g1: ['alice', 'bob', 'carol'] };
    const CHANNELS = { c1: ['alice', 'bob', 'carol'] };

    beforeEach((done) => {
        pushed.length = 0; missed.length = 0; started.length = 0;
        ringing._reset();
        registry = new HuddleRegistry({ maxParticipants: 10 });
        httpServer = http.createServer();
        io = new Server(httpServer);
        io.use((socket, next) => {
            socket.user = { id: socket.handshake.auth.userId };
            socket.data.username = socket.user.id.toUpperCase();
            next();
        });
        io.on('connection', (socket) => {
            socket.join(`user:${socket.user.id}`);
            registerHuddleHandlers(io, socket, {
                registry,
                ringTimeoutMs: 1200,
                history: { started: async () => null, joined() {}, left() {}, ended() {} },
                meetings: { huddleEnded: async () => [] },
                planLimits: async () => null,
                verify: async (s, { dmId, channelId }) => {
                    const uid = String(s.user.id);
                    if (dmId && (DMS[dmId] || []).includes(uid)) {
                        return { ok: true, scope: { dmId, workspaceId: 'w1' }, recipientIds: DMS[dmId], groupDm: DMS[dmId].length > 2, dmName: dmId === 'g1' ? 'Launch crew' : null };
                    }
                    if (channelId && (CHANNELS[channelId] || []).includes(uid)) {
                        return { ok: true, scope: { channelId, workspaceId: 'w1' }, recipientIds: CHANNELS[channelId], channelName: 'design' };
                    }
                    return { ok: false, message: 'Not a member' };
                },
            });
        });
        httpServer.listen(0, () => { url = `http://localhost:${httpServer.address().port}`; done(); });
    });

    afterEach(() => {
        clients.splice(0).forEach((c) => c.close());
        ringing._reset();
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
    const none = (socket, event, ms = 400) => new Promise((resolve, reject) => {
        const h = (p) => { socket.off(event, h); reject(new Error(`unexpected ${event}: ${JSON.stringify(p)}`)); };
        socket.on(event, h);
        setTimeout(() => { socket.off(event, h); resolve(); }, ms);
    });
    /** Start a call and join it (as the apps do). */
    const call = async (socket, huddleId, scope, extra = {}) => {
        const roster = next(socket, 'huddle:roster', (p) => p.huddleId === huddleId);
        socket.emit('huddle:start', { huddleId, ...scope, ...extra });
        socket.emit('huddle:join', { huddleId, ...scope, ...extra });
        return roster;
    };
    const join = (socket, huddleId, scope) => {
        const roster = next(socket, 'huddle:roster', (p) => p.huddleId === huddleId);
        socket.emit('huddle:join', { huddleId, ...scope });
        return roster;
    };

    test('a DM call rings the other person on every device, with a phone push', async () => {
        const alice = await connect('alice');
        const bobLaptop = await connect('bob');
        const bobPhone = await connect('bob');
        const r1 = next(bobLaptop, 'huddle:ring');
        const r2 = next(bobPhone, 'huddle:ring');
        const quiet = none(alice, 'huddle:ring');
        await call(alice, 'h1', { dmId: 'd1' }, { video: true });
        const ring = await r1;
        await r2;
        await quiet;
        expect(ring).toMatchObject({
            huddleId: 'h1', kind: 'dm', dmId: 'd1', workspaceId: 'w1', title: 'ALICE', video: true, ring: true,
            from: { id: 'alice', name: 'ALICE', avatar: 'https://img.test/alice.png' },
        });
        expect(typeof ring.expiresAt).toBe('number');
        expect(ring.expiresAt).toBeGreaterThan(Date.now());
        // Bob's own decline link, which works without signing in.
        expect(ring.declineUrl).toMatch(/^http:\/\/localhost:\d+\/api\/v2\/huddles\/h1\/decline-ring\?token=bob\./);
        expect(pushed.filter((p) => p.type === 'call')).toEqual([expect.objectContaining({ userId: 'bob', type: 'call', payload: expect.objectContaining({ huddleId: 'h1', ring: true }) })]);
        // A DM call leaves no "huddle started" notification (the ring and a missed call replace it).
        expect(started).toHaveLength(0);
    });

    test('answering on one device stops the ring on the others', async () => {
        const alice = await connect('alice');
        const bobLaptop = await connect('bob');
        const bobPhone = await connect('bob');
        const ringed = next(bobPhone, 'huddle:ring');
        await call(alice, 'h1', { dmId: 'd1' });
        await ringed;
        const cancel = next(bobPhone, 'huddle:ring_cancel');
        await join(bobLaptop, 'h1', { dmId: 'd1' });
        expect(await cancel).toEqual({ huddleId: 'h1', reason: 'answered_elsewhere' });
        expect(pushed.some((p) => p.type === 'call_cancel' && p.userId === 'bob')).toBe(true);
        expect(ringing.isRinging('h1', 'bob')).toBe(false);
        // Answered: no missed call when it ends later.
        alice.emit('huddle:end', { huddleId: 'h1' });
        await next(bobLaptop, 'huddle:ended');
        expect(missed).toHaveLength(0);
    });

    test('declining a 1:1 call tells the caller and hangs up', async () => {
        const alice = await connect('alice');
        const bob = await connect('bob');
        const ringed = next(bob, 'huddle:ring');
        await call(alice, 'h1', { dmId: 'd1' });
        await ringed;
        const declined = next(alice, 'huddle:declined');
        const ended = next(alice, 'huddle:ended');
        const cancel = next(bob, 'huddle:ring_cancel');
        bob.emit('huddle:decline', { huddleId: 'h1' });
        expect(await declined).toEqual({ huddleId: 'h1', userId: 'bob', name: 'BOB' });
        expect(await cancel).toEqual({ huddleId: 'h1', reason: 'declined' });
        expect(await ended).toMatchObject({ huddleId: 'h1', reason: 'declined' });
        expect(registry.get('h1')).toBeNull();
        expect(missed).toHaveLength(0);
    });

    test('the HTTP decline works the same way; a second decline finds nothing ringing', async () => {
        const alice = await connect('alice');
        const bob = await connect('bob');
        const ringed = next(bob, 'huddle:ring');
        await call(alice, 'h1', { dmId: 'd1' });
        await ringed;
        const declined = next(alice, 'huddle:declined');
        expect(await declineCall(io, 'h1', 'bob', { registry, history: { ended() {} }, meetings: { huddleEnded: async () => [] } })).toBe(true);
        expect(await declined).toMatchObject({ userId: 'bob', name: 'BOB' });
        expect(await declineCall(io, 'h1', 'bob', { registry })).toBe(false);
    });

    test('nobody answers: the ring times out, the callee gets a missed call, the caller "No answer"', async () => {
        const alice = await connect('alice');
        const bob = await connect('bob');
        const ringed = next(bob, 'huddle:ring');
        await call(alice, 'h1', { dmId: 'd1' });
        await ringed;
        const cancel = next(bob, 'huddle:ring_cancel', () => true, 4000);
        const noAnswer = next(alice, 'huddle:no_answer', () => true, 4000);
        const ended = next(alice, 'huddle:ended', () => true, 4000);
        expect(await cancel).toEqual({ huddleId: 'h1', reason: 'timeout' });
        expect(await noAnswer).toEqual({ huddleId: 'h1' });
        expect(await ended).toMatchObject({ reason: 'no_answer' });
        expect(missed).toEqual([expect.objectContaining({ recipientIds: ['bob'], workspaceId: 'w1', dmSessionId: 'd1', callerName: 'ALICE' })]);
    });

    test('the caller hangs up before an answer: the ring stops and it counts as missed', async () => {
        const alice = await connect('alice');
        const bob = await connect('bob');
        const ringed = next(bob, 'huddle:ring');
        await call(alice, 'h1', { dmId: 'd1' });
        await ringed;
        const cancel = next(bob, 'huddle:ring_cancel');
        alice.emit('huddle:leave', { huddleId: 'h1' });
        expect(await cancel).toEqual({ huddleId: 'h1', reason: 'ended' });
        expect(missed).toHaveLength(1);
    });

    test('a group DM call rings everyone else; one decline keeps ringing the rest', async () => {
        const alice = await connect('alice');
        const bob = await connect('bob');
        const carol = await connect('carol');
        const rb = next(bob, 'huddle:ring');
        const rc = next(carol, 'huddle:ring');
        await call(alice, 'g-call', { dmId: 'g1' });
        expect(await rb).toMatchObject({ kind: 'group_dm', title: 'Launch crew', ring: true });
        await rc;
        const declined = next(alice, 'huddle:declined');
        bob.emit('huddle:decline', { huddleId: 'g-call' });
        await declined;
        expect(ringing.isRinging('g-call', 'carol')).toBe(true);
        expect(registry.get('g-call')).not.toBeNull();
        await join(carol, 'g-call', { dmId: 'g1' });
        expect(ringing.isRinging('g-call', 'carol')).toBe(false);
    });

    test('someone already in a call is not rung', async () => {
        const alice = await connect('alice');
        const bob = await connect('bob');
        const carol = await connect('carol');
        await call(bob, 'busy', { channelId: 'c1' });
        const quiet = none(bob, 'huddle:ring', 300);
        const rc = next(carol, 'huddle:ring', (p) => p.huddleId === 'g-call');
        await call(alice, 'g-call', { dmId: 'g1' });
        await rc;
        await quiet;
        expect(pushed.filter((p) => p.type === 'call').map((p) => p.userId)).toEqual(['carol']);
    });

    test('a channel huddle never rings: a Join banner and the "huddle started" notification', async () => {
        const alice = await connect('alice');
        const bob = await connect('bob');
        const banner = next(bob, 'huddle:ring');
        await call(alice, 'c-call', { channelId: 'c1' });
        expect(await banner).toMatchObject({ huddleId: 'c-call', kind: 'channel', channelId: 'c1', title: '#design', ring: false });
        expect(pushed).toHaveLength(0);
        await new Promise((r) => setTimeout(r, 50));
        expect(started).toEqual([expect.objectContaining({ channelId: 'c1', channelName: 'design' })]);
    });
});
