'use strict';

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const registerHuddleHandlers = require('../huddles.socket');
const { HuddleRegistry } = require('../huddleRegistry');
const { startedAudience, scopeKind } = registerHuddleHandlers;

describe('huddle:started audience (H5)', () => {
    test('rooms per scope', () => {
        expect(startedAudience({ channelId: 'c1', workspaceId: 'w1' })).toEqual(['channel:c1']);
        expect(startedAudience({ workspaceId: 'w1' })).toEqual(['workspace:w1']);
        expect(startedAudience({ dmId: 'd1', workspaceId: 'w1' }, ['alice', 'bob'])).toEqual(['dm:d1', 'user_alice', 'user_bob']);
        expect(scopeKind({ dmId: 'd1' })).toBe('dm');
        expect(scopeKind({ channelId: 'c' })).toBe('channel');
        expect(scopeKind({ workspaceId: 'w' })).toBe('workspace');
    });

    describe('live sockets', () => {
        let io, httpServer, url;
        const clients = [];
        beforeEach((done) => {
            const registry = new HuddleRegistry({ maxParticipants: 5 });
            httpServer = http.createServer();
            io = new Server(httpServer);
            io.use((socket, next) => { socket.user = { id: socket.handshake.auth.userId }; socket.data.username = socket.user.id; next(); });
            io.on('connection', (socket) => {
                socket.join(`user_${socket.user.id}`);
                socket.join('workspace:w1'); // everyone is in the workspace room
                if (socket.user.id !== 'carol') socket.join('channel:c1');
                registerHuddleHandlers(io, socket, {
                    registry,
                    verify: async (s, { channelId, dmId, workspaceId }) => {
                        if (dmId) return ['alice', 'bob'].includes(s.user.id)
                            ? { ok: true, scope: { dmId, workspaceId: 'w1' }, recipientIds: ['alice', 'bob'] }
                            : { ok: false, message: 'no' };
                        if (channelId) return { ok: true, scope: { channelId, workspaceId: 'w1' }, channelName: 'general', recipientIds: ['alice', 'bob'] };
                        return { ok: true, scope: { workspaceId } };
                    },
                });
            });
            httpServer.listen(0, () => { url = `http://localhost:${httpServer.address().port}`; done(); });
        });
        afterEach(() => { clients.splice(0).forEach(c => c.close()); io.close(); httpServer.close(); });

        const connect = (userId) => new Promise((resolve) => {
            const c = Client(url, { auth: { userId }, transports: ['websocket'], forceNew: true });
            clients.push(c);
            c.on('connect', () => resolve(c));
        });
        const collect = (c) => { const got = []; c.on('huddle:started', p => got.push(p)); return got; };
        // Wait until every expected receiver got something, then a little longer for strays.
        const settle = async (...lists) => {
            const until = Date.now() + 3000;
            while (lists.some(l => l.length === 0) && Date.now() < until) await new Promise(r => setTimeout(r, 20));
            await new Promise(r => setTimeout(r, 150));
        };

        test('DM huddle reaches only the two participants, once each, with scope metadata', async () => {
            const alice = await connect('alice'); const bob = await connect('bob'); const carol = await connect('carol');
            const a = collect(alice); const b = collect(bob); const c = collect(carol);
            alice.emit('huddle:start', { huddleId: 'h-dm', dmId: 'd1' });
            await settle(a, b);
            expect(b).toHaveLength(1);
            expect(a).toHaveLength(1);
            expect(c).toHaveLength(0);
            expect(b[0]).toMatchObject({ huddleId: 'h-dm', scope: 'dm', dmId: 'd1', channelId: null, workspaceId: 'w1', startedBy: { _id: 'alice' } });
        });

        test('channel huddle is not announced to the whole workspace', async () => {
            const alice = await connect('alice'); const carol = await connect('carol'); const bob = await connect('bob');
            const b = collect(bob); const c = collect(carol);
            alice.emit('huddle:start', { huddleId: 'h-ch', channelId: 'c1' });
            await settle(b);
            expect(b).toHaveLength(1);
            expect(b[0]).toMatchObject({ scope: 'channel', channelId: 'c1', dmId: null, workspaceId: 'w1' });
            expect(c).toHaveLength(0);
        });

        test('workspace huddle goes to the workspace room', async () => {
            const alice = await connect('alice'); const carol = await connect('carol');
            const c = collect(carol);
            alice.emit('huddle:start', { huddleId: 'h-ws', workspaceId: 'w1' });
            await settle(c);
            expect(c).toHaveLength(1);
            expect(c[0]).toMatchObject({ scope: 'workspace', workspaceId: 'w1', channelId: null, dmId: null });
        });
    });
});
