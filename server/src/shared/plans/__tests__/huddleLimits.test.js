'use strict';

/**
 * Calls on the free plan: at most N people at once (the next one is refused
 * with a PLAN_LIMIT huddle:error) and a hard stop at 30 minutes with warnings
 * at 25 and 29, sent once however many instances sweep.
 */

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const registerHuddleHandlers = require('../../../modules/huddles/huddles.socket');
const { HuddleRegistry } = require('../../../modules/huddles/huddleRegistry');
const { sweep, timeLimitFor } = require('../huddleTimer');

describe('people per call', () => {
    let io, httpServer, url, registry;
    const clients = [];
    const FREE = { plan: 'free', exempt: false, participants: 2, minutes: 30 };

    beforeEach((done) => {
        registry = new HuddleRegistry({ maxParticipants: 10 });
        httpServer = http.createServer();
        io = new Server(httpServer);
        io.use((socket, next) => { socket.user = { id: socket.handshake.auth.userId }; socket.data.username = socket.user.id; next(); });
        io.on('connection', (socket) => {
            registerHuddleHandlers(io, socket, {
                registry,
                history: { started: async () => null, joined() {}, left() {}, ended() {} },
                meetings: { huddleEnded: async () => [] },
                verify: async (s, { channelId }) => ({ ok: true, scope: { channelId, workspaceId: channelId === 'corp' ? 'w2' : 'w1' }, channelName: 'general' }),
                planLimits: async (workspaceId) => (workspaceId === 'w2' ? { plan: 'company', exempt: true, participants: null, minutes: null } : FREE),
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
    const next = (socket, event) => new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), 2000);
        socket.once(event, (p) => { clearTimeout(t); resolve(p); });
    });

    test('the next person past the plan limit is refused with a clear message', async () => {
        const a = await connect('a');
        const b = await connect('b');
        const c = await connect('c');
        let roster = next(a, 'huddle:roster');
        a.emit('huddle:join', { huddleId: 'h1', channelId: 'c1' });
        const r = await roster;
        expect(r.timeLimit).toMatchObject({ maxMinutes: 30 });
        expect(Date.parse(r.timeLimit.endsAt) - Date.parse(r.timeLimit.startedAt)).toBe(30 * 60000);
        expect(r.maxParticipants).toBe(2);
        roster = next(b, 'huddle:roster');
        b.emit('huddle:join', { huddleId: 'h1', channelId: 'c1' });
        await roster;
        const refused = next(c, 'huddle:error');
        c.emit('huddle:join', { huddleId: 'h1', channelId: 'c1' });
        expect(await refused).toMatchObject({ huddleId: 'h1', code: 'PLAN_LIMIT', limit: 'huddles.participants', max: 2, used: 2, upgradeUrl: '/pricing' });
        expect(registry.get('h1').participants.size).toBe(2);
    });

    test('someone already in the call can re-join; company calls have no plan cap', async () => {
        const a = await connect('a');
        const b = await connect('b');
        for (const s of [a, b]) {
            const roster = next(s, 'huddle:roster');
            s.emit('huddle:join', { huddleId: 'h1', channelId: 'c1' });
            await roster;
        }
        const a2 = await connect('a');
        const again = next(a2, 'huddle:roster');
        a2.emit('huddle:join', { huddleId: 'h1', channelId: 'c1' });
        await expect(again).resolves.toMatchObject({ huddleId: 'h1' });

        const people = [];
        for (const id of ['x', 'y', 'z']) people.push(await connect(id));
        for (const s of people) {
            const roster = next(s, 'huddle:roster');
            s.emit('huddle:join', { huddleId: 'h2', channelId: 'corp' });
            expect((await roster).timeLimit).toBeNull();
        }
        expect(registry.get('h2').participants.size).toBe(3);
    });
});

describe('30-minute cap', () => {
    const START = Date.parse('2026-10-21T10:00:00Z');
    function setup() {
        const registry = new HuddleRegistry();
        registry.ensure('h1', { channelId: 'c1' }, { workspaceId: 'w1', startedAt: new Date(START) });
        registry.join('h1', { userId: 'a', socketId: 's1' });
        registry.ensure('h2', { channelId: 'c2' }, { workspaceId: 'corp', startedAt: new Date(START) });
        registry.join('h2', { userId: 'b', socketId: 's2' });
        const emitted = [];
        const io = { to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) };
        const claims = new Set();
        const claim = jest.fn(async (key) => { if (claims.has(key)) return false; claims.add(key); return true; });
        const ended = [];
        const endHuddle = jest.fn((_io, id, reason) => { ended.push([id, reason]); registry.end(id); });
        const limitsFor = async (ws) => (ws === 'corp' ? { plan: 'company', minutes: null } : { plan: 'free', minutes: 30, participants: 10 });
        const at = (min) => () => START + min * 60000;
        return { registry, io, claim, endHuddle, limitsFor, emitted, ended, at };
    }

    test('warns at 25 and 29 minutes, once each, then ends at 30', async () => {
        const s = setup();
        const run = (min) => sweep({ io: s.io, registry: s.registry, claim: s.claim, endHuddle: s.endHuddle, limitsFor: s.limitsFor, now: s.at(min) });
        await run(10);
        expect(s.emitted).toHaveLength(0);
        await run(25);
        await run(25.5); // a second instance / the next sweep: no repeat
        expect(s.emitted).toEqual([expect.objectContaining({ room: 'huddle:h1', event: 'huddle:time_warning', payload: expect.objectContaining({ huddleId: 'h1', minutesLeft: 5, maxMinutes: 30, endsAt: '2026-10-21T10:30:00.000Z' }) })]);
        await run(29.2);
        expect(s.emitted[1].payload).toMatchObject({ minutesLeft: 1 });
        expect(s.emitted).toHaveLength(2);
        expect(s.ended).toEqual([]);
        await run(30);
        expect(s.ended).toEqual([['h1', 'time_limit']]);
        await run(30.1);
        expect(s.ended).toHaveLength(1);
        // The company call keeps going.
        expect(s.registry.get('h2')).not.toBeNull();
    });

    test('a call first seen after 29 minutes gets only the last warning', async () => {
        const s = setup();
        await sweep({ io: s.io, registry: s.registry, claim: s.claim, endHuddle: s.endHuddle, limitsFor: s.limitsFor, now: s.at(29.5) });
        expect(s.emitted.map((e) => e.payload.minutesLeft)).toEqual([1]);
    });

    test('timeLimitFor describes the limit for clients', async () => {
        const s = setup();
        await expect(timeLimitFor(s.registry.get('h1'), s.limitsFor)).resolves.toMatchObject({ maxMinutes: 30, endsAt: '2026-10-21T10:30:00.000Z' });
        await expect(timeLimitFor(s.registry.get('h2'), s.limitsFor)).resolves.toBeNull();
    });

    test('ending at the limit tells everyone why and keeps the notes', () => {
        const { announceEnded } = require('../../../modules/huddles/huddles.socket');
        const emitted = [];
        const io = { to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) };
        announceEnded(io, { huddleId: 'h1', channelId: 'c1', workspaceId: 'w1', startedAt: new Date(Date.now() - 30 * 60000) }, 'time_limit', {
            history: { ended() {} }, meetings: { huddleEnded: async () => [] },
        });
        expect(emitted[0]).toMatchObject({ event: 'huddle:ended', payload: { reason: 'time_limit' } });
        expect(emitted[0].payload.message).toMatch(/30-minute limit.*meeting notes/);
    });
});
