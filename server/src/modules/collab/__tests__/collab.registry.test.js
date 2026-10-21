'use strict';

const Y = require('yjs');
const awarenessProtocol = require('y-protocols/awareness');
const { CollabRegistry, bytesOf } = require('../collab.registry');
const { SCHEMAS } = require('../collab.schemas');
const { memoryStore, fakeAdapters, peer } = require('./collabTestUtils');

const DOC = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const silent = { warn() {}, error() {}, info() {} };

const live = [];
afterEach(() => {
    live.splice(0).forEach(r => Array.from(r.docs.values()).forEach(e => r._unload(e)));
});

function setup(extra = {}) {
    const records = {
        knowledge: { [DOC]: { content: '# Hello', readers: ['reader'], writers: ['alice', 'bob'] } },
        note: { [DOC]: { content: JSON.stringify([{ id: 'b1', type: 'text', content: 'hi' }]), readers: [], writers: ['alice'] } },
        whiteboard: {},
    };
    const { adapters, persisted } = fakeAdapters(records);
    const store = extra.store || memoryStore();
    const emitted = [];
    const registry = new CollabRegistry({
        adapters, store, logger: silent, debounceMs: 20, maxWaitMs: 50,
        emit: (room, event, payload, except) => emitted.push({ room, event, payload, except }),
        ...extra,
    });
    live.push(registry);
    return { registry, store, records, persisted, emitted };
}

/** Run the join handshake for a peer and return it synced. */
function handshake(registry, entry, conn) {
    const p = peer();
    const { sync } = registry.joinMessages(entry);
    const reply = p.receive(sync); // server step1 -> our step2
    if (reply && conn.canWrite) registry.handleSync(entry, conn, reply);
    const step2 = registry.handleSync(entry, conn, p.step1()); // our step1 -> server step2
    p.receive(step2);
    return p;
}

afterEach(() => jest.useRealTimers());

describe('CollabRegistry', () => {
    test('first open seeds the doc from stored content and stores the seed state once', async () => {
        const { registry, store } = setup();
        const entry = await registry.open('knowledge', DOC, 'w1');
        expect(SCHEMAS.knowledge.read(entry.ydoc)).toBe('# Hello');
        expect(store.rows.has(`knowledge:${DOC}`)).toBe(true);
        // A second registry (another instance) loads the same stored items instead of re-seeding.
        const other = new CollabRegistry({ adapters: registry.adapters, store, logger: silent });
        live.push(other);
        const e2 = await other.open('knowledge', DOC, 'w1');
        e2.ydoc.getText('content').insert(7, '!');
        Y.applyUpdate(entry.ydoc, Y.encodeStateAsUpdate(e2.ydoc));
        expect(SCHEMAS.knowledge.read(entry.ydoc)).toBe('# Hello!');
    });

    test('concurrent opens share one load', async () => {
        const { registry } = setup();
        const [a, b] = await Promise.all([registry.open('knowledge', DOC), registry.open('knowledge', DOC)]);
        expect(a).toBe(b);
    });

    test('two writers converge; updates are relayed to the room except the sender', async () => {
        const { registry, emitted } = setup();
        const entry = await registry.open('knowledge', DOC, 'w1');
        const ca = registry.addConn(entry, { socketId: 'sa', userId: 'alice', canWrite: true });
        const cb = registry.addConn(entry, { socketId: 'sb', userId: 'bob', canWrite: true });
        const a = handshake(registry, entry, ca);
        const b = handshake(registry, entry, cb);
        expect(a.doc.getText('content').toString()).toBe('# Hello');

        const outA = a.captureUpdates();
        a.doc.getText('content').insert(7, ' world');
        registry.handleSync(entry, ca, outA[0]);
        const relayed = emitted.filter(e => e.event === 'collab:sync' && e.except === 'sa');
        expect(relayed).toHaveLength(1);
        b.receive(relayed[0].payload.msg);
        expect(b.doc.getText('content').toString()).toBe('# Hello world');
        expect(SCHEMAS.knowledge.read(entry.ydoc)).toBe('# Hello world');
    });

    test('read-only connections may sync down but not write', async () => {
        const { registry } = setup();
        const entry = await registry.open('knowledge', DOC, 'w1');
        const conn = registry.addConn(entry, { socketId: 'sr', userId: 'reader', canWrite: false });
        const r = handshake(registry, entry, conn);
        expect(r.doc.getText('content').toString()).toBe('# Hello');
        const out = r.captureUpdates();
        r.doc.getText('content').insert(0, 'X');
        expect(() => registry.handleSync(entry, conn, out[0])).toThrow(expect.objectContaining({ code: 'READ_ONLY' }));
        expect(SCHEMAS.knowledge.read(entry.ydoc)).toBe('# Hello');
    });

    test('rejects malformed and oversized messages', async () => {
        const { registry } = setup();
        const entry = await registry.open('knowledge', DOC, 'w1');
        const conn = registry.addConn(entry, { socketId: 's', userId: 'alice', canWrite: true });
        expect(() => registry.handleSync(entry, conn, null)).toThrow(expect.objectContaining({ code: 'BAD_MESSAGE' }));
        expect(() => registry.handleSync(entry, conn, Uint8Array.from([7, 1, 2]))).toThrow(expect.objectContaining({ code: 'BAD_MESSAGE' }));
        expect(() => registry.handleSync(entry, conn, new Uint8Array(3 * 1024 * 1024))).toThrow(expect.objectContaining({ code: 'TOO_LARGE' }));
    });

    test('changes are saved (debounced) as Yjs state and plain content', async () => {
        const { registry, store, persisted, emitted } = setup();
        const entry = await registry.open('knowledge', DOC, 'w1');
        const conn = registry.addConn(entry, { socketId: 's', userId: 'alice', canWrite: true });
        const a = handshake(registry, entry, conn);
        const out = a.captureUpdates();
        a.doc.getText('content').insert(7, ' A');
        a.doc.getText('content').insert(9, 'B');
        out.forEach(m => registry.handleSync(entry, conn, m));
        expect(persisted).toHaveLength(0);
        await new Promise(r => setTimeout(r, 60));
        expect(persisted).toEqual([{ docType: 'knowledge', docId: DOC, value: '# Hello AB', ctx: expect.objectContaining({ userId: 'alice' }) }]);
        const restored = new Y.Doc();
        Y.applyUpdate(restored, store.rows.get(`knowledge:${DOC}`));
        expect(restored.getText('content').toString()).toBe('# Hello AB');
        expect(emitted.some(e => e.event === 'collab:saved')).toBe(true);
    });

    test('last connection leaving flushes and unloads', async () => {
        const { registry, persisted } = setup();
        const entry = await registry.open('note', DOC, 'w1');
        const conn = registry.addConn(entry, { socketId: 's', userId: 'alice', canWrite: true });
        const a = handshake(registry, entry, conn);
        const out = a.captureUpdates();
        a.doc.getArray('blocks').get(0).get('content').insert(2, '!');
        registry.handleSync(entry, conn, out[0]);
        await registry.removeConn(entry, 's');
        expect(JSON.parse(persisted[0].value)[0].content).toBe('hi!');
        expect(registry.get('note', DOC)).toBeNull();
    });

    test('awareness is stamped with the authenticated user and cleared on leave', async () => {
        const { registry, emitted } = setup();
        const entry = await registry.open('knowledge', DOC, 'w1');
        const conn = registry.addConn(entry, { socketId: 's', userId: 'alice', canWrite: true });
        registry.addConn(entry, { socketId: 's2', userId: 'bob', canWrite: true });
        const client = new Y.Doc();
        const aw = new awarenessProtocol.Awareness(client);
        aw.setLocalState({ user: { id: 'mallory', name: 'Alice' }, cursor: 3 });
        registry.handleAwareness(entry, conn, awarenessProtocol.encodeAwarenessUpdate(aw, [client.clientID]));
        expect(entry.awareness.getStates().get(client.clientID)).toEqual({ user: { id: 'alice', name: 'Alice' }, cursor: 3 });
        expect(emitted.filter(e => e.event === 'collab:awareness')).toHaveLength(1);
        await registry.removeConn(entry, 's');
        expect(entry.awareness.getStates().has(client.clientID)).toBe(false);
        aw.destroy();
    });

    test('externalChange edits a stored doc in place; untouched docs are left alone', async () => {
        const { registry, store } = setup();
        await registry.externalChange('knowledge', DOC, '# New');
        expect(store.rows.size).toBe(0); // never opened live: nothing to reconcile

        const entry = await registry.open('knowledge', DOC, 'w1');
        const conn = registry.addConn(entry, { socketId: 's', userId: 'alice', canWrite: true });
        const a = handshake(registry, entry, conn);
        await registry.externalChange('knowledge', DOC, '# Hello there');
        expect(SCHEMAS.knowledge.read(entry.ydoc)).toBe('# Hello there');
        const restored = new Y.Doc();
        Y.applyUpdate(restored, store.rows.get(`knowledge:${DOC}`));
        expect(restored.getText('content').toString()).toBe('# Hello there');
        expect(a.doc.getText('content').toString()).toBe('# Hello'); // a gets it via the relayed update (socket layer)
    });

    test('forget drops the live copy, tells the room, and removes stored state', async () => {
        const { registry, store, emitted } = setup();
        await registry.open('knowledge', DOC, 'w1');
        await registry.forget('knowledge', DOC);
        expect(registry.get('knowledge', DOC)).toBeNull();
        expect(store.rows.size).toBe(0);
        expect(emitted.find(e => e.event === 'collab:closed').payload).toEqual({ docType: 'knowledge', docId: DOC, reason: 'deleted' });
    });

    test('replication: peers apply each other\'s updates and answer state requests', async () => {
        const store = memoryStore();
        const bus = [];
        const one = setup({ store, publish: (m) => bus.push({ from: 1, m }) }).registry;
        const two = setup({ store, publish: (m) => bus.push({ from: 2, m }) }).registry;
        const deliver = () => {
            while (bus.length) {
                const { from, m } = bus.shift();
                (from === 1 ? two : one).applyPeer(m);
            }
        };
        const e1 = await one.open('knowledge', DOC, 'w1');
        e1.ydoc.getText('content').insert(0, 'unsaved ');
        const e2 = await two.open('knowledge', DOC, 'w1');
        deliver();
        expect(SCHEMAS.knowledge.read(e2.ydoc)).toBe('unsaved # Hello');
        e2.ydoc.getText('content').insert(0, '>');
        deliver();
        expect(SCHEMAS.knowledge.read(e1.ydoc)).toBe('>unsaved # Hello');
    });

    test('bytesOf reads Buffers and BSON Binary values', () => {
        expect(Array.from(bytesOf(Buffer.from([1, 2])))).toEqual([1, 2]);
        const { Binary } = require('mongodb');
        expect(Array.from(bytesOf(new Binary(Buffer.from([3, 4, 5]))))).toEqual([3, 4, 5]);
    });
});
