'use strict';

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const registerCollabSocket = require('../collab.socket');
const { CollabRegistry } = require('../collab.registry');
const { memoryStore, fakeAdapters } = require('./collabTestUtils');

const PAGE = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const silent = { warn() {}, error() {}, info() {} };

/** CommonJS twin of docs/api/collab-provider.js (same messages, same order). */
function provider(socket, docType, docId) {
    const doc = new Y.Doc();
    const state = { doc, readOnly: false, joined: false, synced: false, errors: [] };
    let onSynced;
    state.syncedP = new Promise(r => { onSynced = r; });
    const send = (event, msg) => socket.emit(event, { docType, docId, msg });
    socket.on('collab:sync', (p) => {
        if (p.docType !== docType || p.docId !== docId || !state.joined) return;
        const dec = decoding.createDecoder(new Uint8Array(p.msg));
        const enc = encoding.createEncoder();
        const type = syncProtocol.readSyncMessage(dec, enc, doc, 'provider');
        if (encoding.length(enc) && !state.readOnly) send('collab:sync', encoding.toUint8Array(enc));
        if (type === syncProtocol.messageYjsSyncStep2 && !state.synced) { state.synced = true; onSynced(); }
    });
    socket.on('collab:error', (p) => state.errors.push(p));
    doc.on('update', (u, origin) => {
        if (origin === 'provider' || !state.joined || state.readOnly) return;
        const enc = encoding.createEncoder();
        syncProtocol.writeUpdate(enc, u);
        send('collab:sync', encoding.toUint8Array(enc));
    });
    state.join = () => new Promise((resolve) => {
        socket.emit('collab:join', { docType, docId }, (res) => {
            state.ack = res;
            if (res.ok) {
                state.readOnly = res.readOnly;
                state.joined = true;
                const enc = encoding.createEncoder();
                syncProtocol.writeSyncStep1(enc, doc);
                send('collab:sync', encoding.toUint8Array(enc));
            }
            resolve(res);
        });
    });
    return state;
}

const waitFor = async (fn, ms = 2000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        if (fn()) return;
        await new Promise(r => setTimeout(r, 10));
    }
    throw new Error('condition not met');
};

describe('collab socket handlers', () => {
    let io, httpServer, url, registry, records, persisted;
    const clients = [];

    beforeEach((done) => {
        records = {
            knowledge: { [PAGE]: { content: 'start', readers: ['reader'], writers: ['alice', 'bob'] } },
            note: {}, whiteboard: {},
        };
        const fakes = fakeAdapters(records);
        persisted = fakes.persisted;
        httpServer = http.createServer();
        io = new Server(httpServer);
        registry = new CollabRegistry({
            adapters: fakes.adapters, store: memoryStore(), logger: silent, debounceMs: 20, maxWaitMs: 50,
            emit: (room, event, payload, except) => {
                let t = io.to(room);
                if (except) t = t.except(except);
                t.emit(event, payload);
            },
        });
        io.use((socket, next) => { socket.user = { id: socket.handshake.auth.userId }; next(); });
        io.on('connection', (socket) => registerCollabSocket(io, socket, { registry, adapters: fakes.adapters }));
        httpServer.listen(0, () => {
            url = `http://localhost:${httpServer.address().port}`;
            done();
        });
    });

    afterEach(async () => {
        clients.splice(0).forEach((c) => c.close());
        await registry.flushAll();
        Array.from(registry.docs.values()).forEach(e => registry._unload(e));
        io.close();
        httpServer.close();
    });

    function connect(userId) {
        return new Promise((resolve) => {
            const c = Client(url, { auth: { userId }, transports: ['websocket'], forceNew: true });
            clients.push(c);
            c.on('connect', () => resolve(c));
        });
    }

    test('two editors converge in real time and the result is saved', async () => {
        const a = provider(await connect('alice'), 'knowledge', PAGE);
        const b = provider(await connect('bob'), 'knowledge', PAGE);
        expect(await a.join()).toEqual({ ok: true, docType: 'knowledge', docId: PAGE, readOnly: false });
        await b.join();
        await Promise.all([a.syncedP, b.syncedP]);
        expect(a.doc.getText('content').toString()).toBe('start');

        a.doc.getText('content').insert(5, ' A');
        b.doc.getText('content').insert(0, 'B ');
        await waitFor(() => a.doc.getText('content').toString() === b.doc.getText('content').toString()
            && a.doc.getText('content').toString().length === 9);
        expect(a.doc.getText('content').toString()).toBe('B start A');
        await waitFor(() => records.knowledge[PAGE].content === 'B start A');
        expect(persisted.at(-1).ctx.userId).toEqual(expect.any(String));
    });

    test('offline edits made before joining are merged on join', async () => {
        const a = provider(await connect('alice'), 'knowledge', PAGE);
        await a.join();
        await a.syncedP;
        const s = await connect('bob');
        const b = provider(s, 'knowledge', PAGE);
        // b has a stale copy from an earlier session plus a local edit.
        Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
        b.doc.getText('content').insert(5, '!');
        await b.join();
        await waitFor(() => a.doc.getText('content').toString() === 'start!');
    });

    test('readers receive changes but cannot write', async () => {
        const a = provider(await connect('alice'), 'knowledge', PAGE);
        const r = provider(await connect('reader'), 'knowledge', PAGE);
        await a.join();
        expect((await r.join()).readOnly).toBe(true);
        await Promise.all([a.syncedP, r.syncedP]);
        a.doc.getText('content').insert(0, '>');
        await waitFor(() => r.doc.getText('content').toString() === '>start');

        // A misbehaving reader sending an update directly is refused.
        const rogue = new Y.Doc();
        Y.applyUpdate(rogue, Y.encodeStateAsUpdate(r.doc));
        let upd;
        rogue.on('update', (u) => { upd = u; });
        rogue.getText('content').insert(0, 'X');
        const enc = encoding.createEncoder();
        syncProtocol.writeUpdate(enc, upd);
        clients[1].emit('collab:sync', { docType: 'knowledge', docId: PAGE, msg: encoding.toUint8Array(enc) });
        await waitFor(() => r.errors.length > 0);
        expect(r.errors[0]).toEqual(expect.objectContaining({ code: 'READ_ONLY', docType: 'knowledge', docId: PAGE }));
        expect(a.doc.getText('content').toString()).toBe('>start');
    });

    test('join is refused for outsiders, unknown docs and bad input', async () => {
        const s = await connect('mallory');
        const ask = (p) => new Promise(r => s.emit('collab:join', p, r));
        expect(await ask({ docType: 'knowledge', docId: PAGE })).toEqual(expect.objectContaining({ ok: false, code: 'FORBIDDEN' }));
        expect(await ask({ docType: 'knowledge', docId: 'cccccccccccccccccccccccc' })).toEqual(expect.objectContaining({ ok: false, code: 'NOT_FOUND' }));
        expect(await ask({ docType: 'spreadsheet', docId: PAGE })).toEqual(expect.objectContaining({ ok: false, code: 'BAD_REQUEST' }));
        expect(await ask({ docType: 'knowledge', docId: '../x' })).toEqual(expect.objectContaining({ ok: false, code: 'BAD_REQUEST' }));
    });

    test('sync messages for a doc the socket has not joined are ignored', async () => {
        const s = await connect('alice');
        const enc = encoding.createEncoder();
        syncProtocol.writeSyncStep1(enc, new Y.Doc());
        s.emit('collab:sync', { docType: 'knowledge', docId: PAGE, msg: encoding.toUint8Array(enc) });
        await new Promise(r => setTimeout(r, 100));
        expect(registry.get('knowledge', PAGE)).toBeNull();
    });

    test('disconnecting the last editor saves and unloads the doc', async () => {
        const s = await connect('alice');
        const a = provider(s, 'knowledge', PAGE);
        await a.join();
        await a.syncedP;
        a.doc.getText('content').insert(0, 'x');
        await waitFor(() => registry.get('knowledge', PAGE).ydoc.getText('content').toString() === 'xstart');
        s.close();
        await waitFor(() => registry.get('knowledge', PAGE) === null);
        expect(records.knowledge[PAGE].content).toBe('xstart');
    });

    test('access is re-checked on a live connection after a minute', async () => {
        const s = await connect('bob');
        const b = provider(s, 'knowledge', PAGE);
        await b.join();
        await b.syncedP;
        records.knowledge[PAGE].writers = ['alice'];
        const conn = registry.get('knowledge', PAGE).conns.get(s.id);
        conn.checkedAt = Date.now() - 61 * 1000;
        const closed = new Promise(r => s.once('collab:closed', r));
        b.doc.getText('content').insert(0, 'z');
        expect(await closed).toEqual({ docType: 'knowledge', docId: PAGE, reason: 'revoked' });
        expect(records.knowledge[PAGE].content).toBe('start');
    });
});
