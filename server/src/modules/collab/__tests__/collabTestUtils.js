'use strict';

/** Shared fakes for collab tests (not a test file: no `.test.js`). */

const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');

function memoryStore() {
    const rows = new Map();
    return {
        rows,
        saves: 0,
        async load(t, id) { return rows.get(`${t}:${id}`) || null; },
        async create(t, id, ws, state) {
            const k = `${t}:${id}`;
            if (!rows.has(k)) rows.set(k, state);
            return rows.get(k);
        },
        async save(t, id, ws, state) { this.saves++; rows.set(`${t}:${id}`, state); },
        async remove(t, id) { rows.delete(`${t}:${id}`); },
    };
}

/** Adapters backed by a plain object: records[docType][docId] = { content, readers, writers }. */
function fakeAdapters(records) {
    const persisted = [];
    const make = (docType) => ({
        async authorize(docId, userId) {
            const r = records[docType] && records[docType][docId];
            if (!r) throw Object.assign(new Error('Not found'), { status: 404 });
            const canRead = r.readers.includes(userId) || r.writers.includes(userId);
            if (!canRead) throw Object.assign(new Error('Not authorized'), { status: 403 });
            return { workspaceId: 'w1', canWrite: r.writers.includes(userId) };
        },
        async loadContent(docId) { return records[docType][docId].content; },
        async persist(docId, value, ctx) {
            records[docType][docId].content = value;
            persisted.push({ docType, docId, value, ctx });
        },
    });
    return { adapters: { note: make('note'), knowledge: make('knowledge'), whiteboard: make('whiteboard') }, persisted };
}

/** A minimal Yjs peer speaking the same sync messages as docs/api/collab-provider.js. */
function peer() {
    const doc = new Y.Doc();
    return {
        doc,
        step1() {
            const enc = encoding.createEncoder();
            syncProtocol.writeSyncStep1(enc, doc);
            return encoding.toUint8Array(enc);
        },
        /** Apply a server message; returns the reply bytes or null. */
        receive(msg) {
            const enc = encoding.createEncoder();
            syncProtocol.readSyncMessage(decoding.createDecoder(new Uint8Array(msg)), enc, doc, 'server');
            return encoding.length(enc) ? encoding.toUint8Array(enc) : null;
        },
        /** Capture local updates as sync 'update' messages. */
        captureUpdates() {
            const out = [];
            doc.on('update', (u, origin) => {
                if (origin === 'server') return;
                const enc = encoding.createEncoder();
                syncProtocol.writeUpdate(enc, u);
                out.push(encoding.toUint8Array(enc));
            });
            return out;
        },
    };
}

module.exports = { memoryStore, fakeAdapters, peer };
