'use strict';

jest.mock('../../../../models/User', () => ({ findByIdAndUpdate: jest.fn(() => Promise.resolve()) }));

const { createFakeRedisHub } = require('../../../shared/__tests__/fakeRedis');
const presence = require('../presence.service');

function fakeIo() {
    const emitted = [];
    return { emitted, to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) };
}

describe('presence service', () => {
    afterEach(() => presence._setRedisForTests(undefined));

    test('memory only: online, idle, offline when the last socket goes', async () => {
        presence._setRedisForTests(null);
        const io = fakeIo();
        await presence.setOnline(io, 'u1', 's1', 'co');
        await presence.setOnline(io, 'u1', 's2', 'co');
        expect(presence.getPresence('u1').status).toBe('online');
        await presence.setIdle(io, 'u1', 'co');
        expect(presence.getPresence('u1').status).toBe('idle');
        await presence.setOffline(io, 'u1', 's1', 'co');
        expect(presence.getPresence('u1')).toBeDefined();
        await presence.setOffline(io, 'u1', 's2', 'co');
        expect(presence.getPresence('u1')).toBeUndefined();
        expect(io.emitted.map((e) => e.event)).toEqual(['user:online', 'user:online', 'user:idle', 'user:offline']);
    });

    test('with Redis a user seen on another instance is online here', async () => {
        const hub = createFakeRedisHub();
        presence._setRedisForTests(hub.client());
        const io = fakeIo();
        await presence.setOnline(io, 'u2', 's9', 'co');
        // "Another instance": clear the local map but keep the shared store.
        presence._setRedisForTests(hub.client());
        expect(presence.getPresence('u2')).toBeUndefined();
        const remote = await presence.getPresenceAsync('u2');
        expect(remote.status).toBe('online');
        const bulk = await presence.getBulkPresenceAsync(['u2', 'ghost']);
        expect(bulk.u2.status).toBe('online');
        expect(bulk.ghost.status).toBe('offline');
    });

    test('offline is only announced when no instance holds a socket', async () => {
        const hub = createFakeRedisHub();
        presence._setRedisForTests(hub.client());
        const io = fakeIo();
        await presence.setOnline(io, 'u3', 'a1', 'co');
        // Pretend instance B also holds a socket for u3.
        await hub.client().sadd('presence:sockets:u3', 'other-instance|b1');
        await presence.setOffline(io, 'u3', 'a1', 'co');
        expect(io.emitted.filter((e) => e.event === 'user:offline')).toHaveLength(0);
        expect((await presence.getPresenceAsync('u3')).status).toBe('online');
        await hub.client().srem('presence:sockets:u3', 'other-instance|b1');
        // Now the last socket anywhere goes away on this instance.
        await presence.setOnline(io, 'u3', 'a2', 'co');
        await presence.setOffline(io, 'u3', 'a2', 'co');
        expect(io.emitted.filter((e) => e.event === 'user:offline')).toHaveLength(1);
        expect(await presence.getPresenceAsync('u3')).toBeNull();
    });

    test('releaseAllPresence drops this instance\'s sockets from the shared store', async () => {
        const hub = createFakeRedisHub();
        presence._setRedisForTests(hub.client());
        const io = fakeIo();
        await presence.setOnline(io, 'u4', 'x1', 'co');
        await presence.releaseAllPresence();
        expect(await hub.client().scard('presence:sockets:u4')).toBe(0);
        expect(presence.getPresence('u4')).toBeUndefined();
    });
});
