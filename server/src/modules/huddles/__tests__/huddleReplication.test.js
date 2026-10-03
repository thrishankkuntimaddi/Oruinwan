'use strict';

const { createFakeRedisHub } = require('../../../shared/__tests__/fakeRedis');
const { HuddleRegistry } = require('../huddleRegistry');
const { attachHuddleReplication, SNAPSHOT_KEY } = require('../huddleReplication');

// Two "instances" share one fake Redis; each skips its own messages and applies the other's.
describe('huddle replication', () => {
    let hub, a, b, detachA, detachB;

    beforeEach(async () => {
        hub = createFakeRedisHub();
        a = new HuddleRegistry();
        b = new HuddleRegistry();
        detachA = await attachHuddleReplication(a, { redis: hub.client(), subscriber: hub.client(), instanceId: 'A' });
        detachB = await attachHuddleReplication(b, { redis: hub.client(), subscriber: hub.client(), instanceId: 'B' });
    });
    afterEach(async () => { await detachA(); await detachB(); });

    const flush = () => new Promise((r) => setTimeout(r, 5));

    test('mutations on A appear on B and in the snapshot', async () => {
        a.ensure('h1', { channelId: 'c1' }, { channelName: 'general', workspaceId: 'w1', video: true });
        a.join('h1', { userId: 'alice', username: 'Alice', socketId: 'sockA' });
        await flush();
        const onB = b.get('h1');
        expect(onB).toBeTruthy();
        expect(onB.workspaceId).toBe('w1');
        expect(onB.video).toBe(true);
        expect(b.participant('h1', 'alice').socketId).toBe('sockA');
        const snap = await hub.client().hgetall(SNAPSHOT_KEY);
        expect(Object.keys(snap)).toEqual(['h1']);
        expect(JSON.parse(snap.h1).participants[0].userId).toBe('alice');
    });

    test('leave, audio toggle and end propagate; empty huddles disappear', async () => {
        a.ensure('h2', { dmId: 'd1' }, {});
        a.join('h2', { userId: 'u1', socketId: 's1' });
        a.join('h2', { userId: 'u2', socketId: 's2' });
        await flush();
        a.setAudio('h2', 'u1', false);
        await flush();
        expect(b.participant('h2', 'u1').audioEnabled).toBe(false);
        a.leave('h2', 'u2');
        await flush();
        expect(b.participant('h2', 'u2')).toBeNull();
        a.leave('h2', 'u1');
        await flush();
        expect(b.get('h2')).toBeNull();
        expect(await hub.client().hgetall(SNAPSHOT_KEY)).toEqual({});
    });

    test('a fresh instance restores live huddles from the snapshot', async () => {
        a.ensure('h3', { workspaceId: 'w9' }, {});
        a.join('h3', { userId: 'z', socketId: 'sz' });
        await flush();
        const c = new HuddleRegistry();
        const detachC = await attachHuddleReplication(c, { redis: hub.client(), subscriber: hub.client(), instanceId: 'C' });
        expect(c.get('h3')).toBeTruthy();
        expect(c.participant('h3', 'z').socketId).toBe('sz');
        expect(c.huddlesForSocket('sz')).toEqual(['h3']);
        await detachC();
    });

    test('applyRemote never re-publishes', async () => {
        const published = [];
        const r = new HuddleRegistry();
        r.onMutation = (op) => published.push(op.type);
        r.applyRemote({ type: 'ensure', huddle: { huddleId: 'x', scopeKey: 'channel:c', channelId: 'c' } });
        r.applyRemote({ type: 'join', huddleId: 'x', participant: { userId: 'u', socketId: 's' } });
        expect(published).toEqual([]);
        r.join('x', { userId: 'v', socketId: 't' });
        expect(published).toEqual(['join']);
    });
});
