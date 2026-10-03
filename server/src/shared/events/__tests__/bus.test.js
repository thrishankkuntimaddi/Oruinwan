'use strict';

const { createFakeRedisHub } = require('../../__tests__/fakeRedis');
const postgres = require('../../postgres');
const bus = require('../bus');
const { relayOnce } = require('../outboxRelay');

const flush = (ms = 20) => new Promise((r) => setTimeout(r, ms));

/** Fake pool: records statements; SELECT on the outbox returns `unpublished`. */
function fakePool(unpublished = []) {
    const statements = [];
    const handle = async (text, params = []) => {
        statements.push({ text, params });
        if (/FROM event_outbox/.test(text)) return { rows: unpublished.splice(0, params[0]) };
        if (/DELETE FROM event_outbox/.test(text)) return { rowCount: 0 };
        return { rows: [], rowCount: 0 };
    };
    return { statements, query: handle, connect: async () => ({ query: handle, release: () => {} }) };
}

describe('event bus', () => {
    afterEach(() => {
        bus._setRedisForTests(undefined);
        postgres._setPoolForTests(undefined);
        delete process.env.DATABASE_URL;
        bus._local.removeAllListeners('event');
    });

    test('mode follows what is configured', () => {
        bus._setRedisForTests(null);
        expect(bus.mode()).toBe('local');
        bus._setRedisForTests(createFakeRedisHub().client());
        expect(bus.mode()).toBe('stream');
        process.env.DATABASE_URL = 'postgres://x';
        expect(bus.mode()).toBe('outbox');
    });

    test('local mode delivers in-process to matching subscribers', async () => {
        bus._setRedisForTests(null);
        const got = [];
        const stop = await bus.subscribe('test', (env) => got.push(env), { events: ['task.created'] });
        const id = await bus.publish('task.created', { taskId: 't1' }, { workspaceId: 'w1', actorId: 'u1' });
        await bus.publish('member.joined', { userId: 'u2' }, { workspaceId: 'w1' });
        await flush();
        expect(got).toHaveLength(1);
        expect(got[0]).toMatchObject({ id, name: 'task.created', workspaceId: 'w1', actorId: 'u1', payload: { taskId: 't1' } });
        stop();
        await bus.publish('task.created', { taskId: 't2' });
        await flush();
        expect(got).toHaveLength(1);
    });

    test('publish rejects unknown events and bad payloads before touching any store', async () => {
        bus._setRedisForTests(null);
        await expect(bus.publish('nope.event', {})).rejects.toThrow(/Unknown event/);
        await expect(bus.publish('task.created', {})).rejects.toThrow(/missing: taskId/);
    });

    test('outbox mode inserts a row (inside the caller transaction when given)', async () => {
        bus._setRedisForTests(createFakeRedisHub().client());
        process.env.DATABASE_URL = 'postgres://x';
        const pool = fakePool();
        postgres._setPoolForTests(pool);
        const id = await bus.publish('file.uploaded', { objectPath: 'channels/a.png' }, { companyId: 'c1', actorId: 'u1' });
        const ins = pool.statements.find((s) => /INSERT INTO event_outbox/.test(s.text));
        expect(ins.params.slice(0, 5)).toEqual([id, 'file.uploaded', 'c1', null, 'u1']);
        expect(JSON.parse(ins.params[5])).toEqual({ objectPath: 'channels/a.png' });

        const txStatements = [];
        const tx = { query: async (text, params) => { txStatements.push({ text, params }); return { rows: [] }; } };
        await bus.publish('task.deleted', { taskId: 't9' }, { workspaceId: 'w1', tx });
        expect(txStatements).toHaveLength(1);
        expect(txStatements[0].params[1]).toBe('task.deleted');
    });

    test('stream mode XADDs straight to the stream', async () => {
        const hub = createFakeRedisHub();
        bus._setRedisForTests(hub.client());
        await bus.publish('huddle.started', { huddleId: 'h1' }, { workspaceId: 'w1' });
        const entries = await hub.client().xrange(bus.STREAM);
        expect(entries).toHaveLength(1);
        expect(JSON.parse(entries[0][1][1]).name).toBe('huddle.started');
    });

    test('relayOnce copies outbox rows to the stream and marks them published', async () => {
        const hub = createFakeRedisHub();
        const redis = hub.client();
        process.env.DATABASE_URL = 'postgres://x';
        const rows = [
            { id: '1', event_id: 'e1', name: 'task.created', company_id: 'c1', workspace_id: 'w1', actor_id: 'u1', payload: { taskId: 't1' }, created_at: new Date() },
            { id: '2', event_id: 'e2', name: 'task.updated', company_id: 'c1', workspace_id: 'w1', actor_id: 'u1', payload: '{"taskId":"t1"}', created_at: new Date() },
        ];
        const pool = fakePool(rows);
        postgres._setPoolForTests(pool);
        expect(await relayOnce({ redis })).toBe(2);
        expect(await redis.xlen(bus.STREAM)).toBe(2);
        const upd = pool.statements.find((s) => /UPDATE event_outbox SET published_at/.test(s.text));
        expect(upd.params[0]).toEqual(['1', '2']);
        expect(pool.statements.map((s) => s.text)).toEqual(expect.arrayContaining(['BEGIN', 'COMMIT']));
        const [, fields] = (await redis.xrange(bus.STREAM))[1];
        expect(JSON.parse(fields[1])).toMatchObject({ id: 'e2', name: 'task.updated', payload: { taskId: 't1' } });
        expect(await relayOnce({ redis })).toBe(0);
    });

    test('subscribe reads, acks on success, leaves failures pending and reclaims them', async () => {
        const hub = createFakeRedisHub();
        const redis = hub.client();
        bus._setRedisForTests(redis);
        const seen = [];
        let fail = true;
        const stop = await bus.subscribe('wh', async (env) => {
            seen.push(env.name);
            if (fail && env.name === 'task.updated') throw new Error('receiver down');
        }, { consumer: 'c1', events: ['task.created', 'task.updated'], blockMs: 50, reclaimEveryMs: 60_000 });

        await bus.publish('task.created', { taskId: 't1' });
        await bus.publish('task.updated', { taskId: 't1' });
        await bus.publish('member.joined', { userId: 'u1' }); // not subscribed: acked and skipped
        await flush(100);
        expect(seen).toEqual(['task.created', 'task.updated']);
        expect((await redis.xpending(bus.STREAM, 'wh'))[0]).toBe(1); // the failed one

        fail = false;
        const redelivered = await bus.reclaimPending(redis, 'wh', 'c2', async (env) => seen.push(`again:${env.name}`), ['*'], { idleMs: 0 });
        expect(redelivered).toBe(1);
        expect(seen).toEqual(['task.created', 'task.updated', 'again:task.updated']);
        expect((await redis.xpending(bus.STREAM, 'wh'))[0]).toBe(0);
        await stop();
    });

    test('a second subscribe to the same group tolerates BUSYGROUP', async () => {
        const hub = createFakeRedisHub();
        bus._setRedisForTests(hub.client());
        const a = await bus.subscribe('dup', () => {}, { blockMs: 20 });
        const b = await bus.subscribe('dup', () => {}, { blockMs: 20 });
        await a(); await b();
    });
});
