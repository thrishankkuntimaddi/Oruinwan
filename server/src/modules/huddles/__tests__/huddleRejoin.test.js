'use strict';

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

jest.mock('../../../features/push/push.service', () => ({ sendCallToUser: jest.fn(async () => {}), sendToUser: jest.fn(async () => {}) }));
jest.mock('../../notifications/notificationService', () => ({ missedCall: jest.fn(async () => []), huddleStarted: jest.fn(async () => []) }));

const registerHuddleHandlers = require('../huddles.socket');
const { HuddleRegistry } = require('../huddleRegistry');

// An app that reconnects mid-call rejoins it; a call that ended while it was offline stays ended.
describe('rejoining after a reconnect', () => {
    let io, httpServer, url, registry, ended;
    const clients = [];

    beforeEach((done) => {
        registry = new HuddleRegistry({ maxParticipants: 10 });
        ended = new Set();
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
                history: { started: async () => null, joined() {}, left() {}, ended() {}, hasEnded: async (id) => ended.has(id) },
                meetings: { huddleEnded: async () => [] },
                planLimits: async () => null,
                verify: async () => ({ ok: true, scope: { channelId: 'c1', workspaceId: 'w1' }, channelName: 'general', recipientIds: ['alice', 'bob'] }),
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

    test('a call that ended while I was offline is not brought back', async () => {
        ended.add('h1');
        const alice = await connect('alice');
        const answer = next(alice, 'huddle:ended');
        alice.emit('huddle:join', { huddleId: 'h1', channelId: 'c1', rejoin: true });
        expect(await answer).toEqual({ huddleId: 'h1', reason: 'ended' });
        expect(registry.get('h1')).toBeNull();
    });

    test('a call the server lost (restart) can be rejoined', async () => {
        const alice = await connect('alice');
        const roster = next(alice, 'huddle:roster');
        alice.emit('huddle:join', { huddleId: 'h2', channelId: 'c1', rejoin: true });
        expect(await roster).toMatchObject({ huddleId: 'h2' });
        expect(registry.participant('h2', 'alice')).toBeTruthy();
    });
});
