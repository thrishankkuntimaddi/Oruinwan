'use strict';

/**
 * Live collaborative documents held by this server instance.
 *
 * One entry per open document (`<docType>:<docId>`): a Y.Doc, a y-protocols
 * Awareness, and the sockets connected to it. The server is a full Yjs peer:
 * it answers sync step 1 with the missing updates, applies client updates,
 * relays them to the other sockets in the room, and saves the merged state
 * (debounced) to MongoDB together with the plain content of the owning record.
 *
 * Multi-instance: every local change is handed to `publish` (Redis pub/sub in
 * collab.replication.js); peers apply it to their copy and relay it to their
 * own sockets. A freshly loaded copy asks peers for their state so edits that
 * are not saved yet are never lost.
 */

const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const { SCHEMAS, SERVER_ORIGIN } = require('./collab.schemas');

const REMOTE_ORIGIN = 'remote';
const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
const MAX_DOC_BYTES = 8 * 1024 * 1024;

const keyOf = (docType, docId) => `${docType}:${docId}`;
const roomOf = (docType, docId) => `collab:${docType}:${docId}`;

function toUint8(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (Array.isArray(data)) return Uint8Array.from(data);
    if (data && data.type === 'Buffer' && Array.isArray(data.data)) return Uint8Array.from(data.data);
    return null;
}

/** Bytes of a stored Buffer / BSON Binary as a Uint8Array. */
function bytesOf(v) {
    if (!v) return null;
    if (Buffer.isBuffer(v)) return new Uint8Array(v);
    if (v._bsontype === 'Binary' || (v.buffer && typeof v.position === 'number')) {
        return new Uint8Array(v.buffer.subarray(0, v.position));
    }
    return toUint8(v);
}

function defaultStore() {
    const CollabDoc = () => require('./collabDoc.model');
    return {
        async load(docType, docId) {
            const row = await CollabDoc().findOne({ docType, docId }).select('state').lean();
            return row ? bytesOf(row.state) : null;
        },
        /** Insert-if-absent; returns the state that won (ours, or one another instance stored first). */
        async create(docType, docId, workspaceId, state) {
            try {
                const row = await CollabDoc().findOneAndUpdate(
                    { docType, docId },
                    { $setOnInsert: { docType, docId, workspaceId, state: Buffer.from(state), rev: 0 } },
                    { upsert: true, new: true }
                ).select('state').lean();
                return (row && bytesOf(row.state)) || state;
            } catch (err) {
                if (err && err.code === 11000) return this.load(docType, docId);
                throw err;
            }
        },
        async save(docType, docId, workspaceId, state) {
            await CollabDoc().updateOne(
                { docType, docId },
                { $set: { state: Buffer.from(state), workspaceId }, $inc: { rev: 1 } },
                { upsert: true }
            );
        },
        async remove(docType, docId) {
            await CollabDoc().deleteOne({ docType, docId });
        },
    };
}

class CollabRegistry {
    /**
     * @param {object} deps
     * @param {object} [deps.adapters]  collab.adapters ADAPTERS
     * @param {object} [deps.store]     persistence of Yjs state
     * @param {(room:string, event:string, payload:object, exceptSocketId?:string) => void} [deps.emit]  emit to LOCAL sockets
     * @param {(message:object) => void} [deps.publish]  replicate to peer instances
     */
    constructor(deps = {}) {
        this.adapters = deps.adapters || require('./collab.adapters').ADAPTERS;
        this.store = deps.store || defaultStore();
        this.emit = deps.emit || (() => {});
        this.publish = deps.publish || null;
        this.logger = deps.logger || require('../../../utils/logger');
        this.debounceMs = deps.debounceMs ?? 2000;
        this.maxWaitMs = deps.maxWaitMs ?? 10000;
        this.docs = new Map();
        this.loading = new Map();
    }

    get(docType, docId) {
        return this.docs.get(keyOf(docType, docId)) || null;
    }

    /** Load (or return) the live entry for a document. */
    async open(docType, docId, workspaceId) {
        const key = keyOf(docType, docId);
        if (this.docs.has(key)) return this.docs.get(key);
        if (this.loading.has(key)) return this.loading.get(key);
        const p = this._load(docType, docId, workspaceId).finally(() => this.loading.delete(key));
        this.loading.set(key, p);
        return p;
    }

    async _load(docType, docId, workspaceId) {
        const schema = SCHEMAS[docType];
        const adapter = this.adapters[docType];
        if (!schema || !adapter) throw new Error(`Unknown collab doc type: ${docType}`);
        const ydoc = new Y.Doc({ gc: true });
        let state = await this.store.load(docType, docId);
        if (!state) {
            // Seed once from the record's plain content and store it before anyone
            // edits, so every instance and client starts from the same Yjs items.
            const seedDoc = new Y.Doc();
            schema.seed(seedDoc, await adapter.loadContent(docId));
            state = await this.store.create(docType, docId, workspaceId || null, Y.encodeStateAsUpdate(seedDoc));
            seedDoc.destroy();
        }
        if (state && state.length) Y.applyUpdate(ydoc, state, SERVER_ORIGIN);
        const sizeBytes = state ? state.length : 0;

        const awareness = new awarenessProtocol.Awareness(ydoc);
        awareness.setLocalState(null);
        const entry = {
            key: keyOf(docType, docId),
            room: roomOf(docType, docId),
            docType,
            docId: String(docId),
            workspaceId: workspaceId || null,
            ydoc,
            awareness,
            conns: new Map(),
            timer: null,
            dirtySince: 0,
            lastEditor: null,
            saving: null,
            sizeBytes,
        };

        ydoc.on('update', (update, origin) => this._onDocUpdate(entry, update, origin));
        awareness.on('update', ({ added, updated, removed }, origin) => this._onAwarenessUpdate(entry, { added, updated, removed }, origin));

        this.docs.set(entry.key, entry);
        if (this.publish) this.publish({ type: 'state-request', key: entry.key });
        return entry;
    }

    // ── connections ──────────────────────────────────────────────────────────

    addConn(entry, { socketId, userId, canWrite }) {
        const conn = { socketId, userId: String(userId), canWrite: !!canWrite, clientIds: new Set(), checkedAt: Date.now() };
        entry.conns.set(socketId, conn);
        return conn;
    }

    /** Messages the server sends right after a join: its sync step 1 and the current awareness. */
    joinMessages(entry) {
        const enc = encoding.createEncoder();
        syncProtocol.writeSyncStep1(enc, entry.ydoc);
        const out = { sync: encoding.toUint8Array(enc), awareness: null };
        const clients = Array.from(entry.awareness.getStates().keys());
        if (clients.length) out.awareness = awarenessProtocol.encodeAwarenessUpdate(entry.awareness, clients);
        return out;
    }

    async removeConn(entry, socketId) {
        const conn = entry.conns.get(socketId);
        if (!conn) return;
        entry.conns.delete(socketId);
        if (conn.clientIds.size) {
            awarenessProtocol.removeAwarenessStates(entry.awareness, Array.from(conn.clientIds), conn);
        }
        if (entry.conns.size === 0) {
            await this.flush(entry);
            // Someone may have re-joined while saving.
            if (entry.conns.size === 0 && this.docs.get(entry.key) === entry) this._unload(entry);
        }
    }

    _unload(entry) {
        clearTimeout(entry.timer);
        entry.timer = null;
        this.docs.delete(entry.key);
        entry.awareness.destroy();
        entry.ydoc.destroy();
    }

    // ── protocol ─────────────────────────────────────────────────────────────

    /**
     * Handle one y-protocols sync message from a socket. Returns the reply
     * (Uint8Array) to send back to that socket, or null. Read-only connections
     * may only ask for state (step 1); their step 2 / updates are dropped.
     * Throws { code } on bad input.
     */
    handleSync(entry, conn, data) {
        const msg = toUint8(data);
        if (!msg || !msg.length) throw Object.assign(new Error('Empty message'), { code: 'BAD_MESSAGE' });
        if (msg.length > MAX_MESSAGE_BYTES) throw Object.assign(new Error('Message too large'), { code: 'TOO_LARGE' });
        const decoder = decoding.createDecoder(msg);
        const type = decoding.peekVarUint(decoder);
        if (type !== syncProtocol.messageYjsSyncStep1 && !conn.canWrite) {
            throw Object.assign(new Error('Read-only access'), { code: 'READ_ONLY' });
        }
        if (type !== syncProtocol.messageYjsSyncStep1 && entry.sizeBytes + msg.length > MAX_DOC_BYTES) {
            throw Object.assign(new Error('Document too large'), { code: 'DOC_TOO_LARGE' });
        }
        const encoder = encoding.createEncoder();
        if (type !== syncProtocol.messageYjsSyncStep1) entry.lastEditor = conn.userId;
        try {
            syncProtocol.readSyncMessage(decoder, encoder, entry.ydoc, conn);
        } catch (err) {
            throw Object.assign(new Error(`Malformed sync message: ${err.message}`), { code: 'BAD_MESSAGE' });
        }
        if (type !== syncProtocol.messageYjsSyncStep1) entry.sizeBytes += msg.length;
        return encoding.length(encoder) > 0 ? encoding.toUint8Array(encoder) : null;
    }

    /**
     * Apply an awareness update from a socket. Each state's `user.id` is forced
     * to the authenticated user so nobody can show up as someone else.
     */
    handleAwareness(entry, conn, data) {
        const msg = toUint8(data);
        if (!msg || !msg.length) throw Object.assign(new Error('Empty message'), { code: 'BAD_MESSAGE' });
        if (msg.length > 64 * 1024) throw Object.assign(new Error('Message too large'), { code: 'TOO_LARGE' });
        let stamped;
        try {
            stamped = awarenessProtocol.modifyAwarenessUpdate(msg, (state) => {
                if (state === null || typeof state !== 'object') return state;
                const user = state.user && typeof state.user === 'object' ? state.user : {};
                return { ...state, user: { ...user, id: conn.userId } };
            });
            awarenessProtocol.applyAwarenessUpdate(entry.awareness, stamped, conn);
        } catch (err) {
            throw Object.assign(new Error(`Malformed awareness message: ${err.message}`), { code: 'BAD_MESSAGE' });
        }
    }

    _onDocUpdate(entry, update, origin) {
        const enc = encoding.createEncoder();
        syncProtocol.writeUpdate(enc, update);
        const msg = encoding.toUint8Array(enc);
        const except = origin && origin.socketId ? origin.socketId : undefined;
        this.emit(entry.room, 'collab:sync', { docType: entry.docType, docId: entry.docId, msg }, except);
        if (origin !== REMOTE_ORIGIN && this.publish) {
            this.publish({ type: 'update', key: entry.key, data: Buffer.from(update).toString('base64') });
        }
        // Remote updates are saved by the instance that received them; saving
        // here too is harmless (same merged state) and covers its crash.
        this._schedulePersist(entry);
    }

    _onAwarenessUpdate(entry, { added, updated, removed }, origin) {
        const changed = added.concat(updated, removed);
        if (origin && origin.clientIds) {
            added.concat(updated).forEach(id => origin.clientIds.add(id));
            removed.forEach(id => origin.clientIds.delete(id));
        }
        if (!changed.length) return;
        const msg = awarenessProtocol.encodeAwarenessUpdate(entry.awareness, changed);
        const except = origin && origin.socketId ? origin.socketId : undefined;
        this.emit(entry.room, 'collab:awareness', { docType: entry.docType, docId: entry.docId, msg }, except);
        if (origin !== REMOTE_ORIGIN && this.publish) {
            this.publish({ type: 'awareness', key: entry.key, data: Buffer.from(msg).toString('base64') });
        }
    }

    // ── persistence ──────────────────────────────────────────────────────────

    _schedulePersist(entry) {
        const now = Date.now();
        if (!entry.dirtySince) entry.dirtySince = now;
        clearTimeout(entry.timer);
        const wait = Math.max(0, Math.min(this.debounceMs, entry.dirtySince + this.maxWaitMs - now));
        entry.timer = setTimeout(() => { this.flush(entry).catch(() => {}); }, wait);
        if (entry.timer.unref) entry.timer.unref();
    }

    /** Save now if there are unsaved changes. Resolves when written. */
    async flush(entry) {
        if (entry.saving) await entry.saving.catch(() => {});
        if (!entry.dirtySince) return;
        clearTimeout(entry.timer);
        entry.timer = null;
        entry.dirtySince = 0;
        entry.saving = this._persist(entry).finally(() => { entry.saving = null; });
        return entry.saving;
    }

    async _persist(entry) {
        const schema = SCHEMAS[entry.docType];
        const adapter = this.adapters[entry.docType];
        try {
            const state = Y.encodeStateAsUpdate(entry.ydoc);
            entry.sizeBytes = state.length;
            await this.store.save(entry.docType, entry.docId, entry.workspaceId, state);
            await adapter.persist(entry.docId, schema.read(entry.ydoc), { userId: entry.lastEditor, workspaceId: entry.workspaceId });
            this.emit(entry.room, 'collab:saved', { docType: entry.docType, docId: entry.docId, savedAt: new Date().toISOString() });
        } catch (err) {
            this.logger.warn(`[COLLAB] save failed for ${entry.key}: ${err.message}`);
            // Retry on the next change, or now if nothing else comes.
            this._schedulePersist(entry);
            throw err;
        }
    }

    async flushAll() {
        await Promise.all(Array.from(this.docs.values()).map(e => this.flush(e).catch(() => {})));
    }

    /**
     * The owning record's content was changed outside the live editor (REST PUT).
     * Edits the Yjs document in place (a minimal diff, so open editors keep their
     * caret) and saves the Yjs state. Plain content is already written by the caller.
     */
    async externalChange(docType, docId, value, { workspaceId } = {}) {
        docId = String(docId);
        // Never opened live: nothing to reconcile, the next open seeds from the new content.
        if (!this.get(docType, docId) && !this.loading.has(keyOf(docType, docId)) && !(await this.store.load(docType, docId))) return;
        const entry = await this.open(docType, docId, workspaceId);
        SCHEMAS[docType].replace(entry.ydoc, value);
        clearTimeout(entry.timer);
        entry.timer = null;
        entry.dirtySince = 0;
        await this.store.save(entry.docType, entry.docId, entry.workspaceId, Y.encodeStateAsUpdate(entry.ydoc));
        if (entry.conns.size === 0 && this.docs.get(entry.key) === entry) this._unload(entry);
    }

    /** The owning record was deleted: drop the live copy and the stored state. */
    async forget(docType, docId) {
        const entry = this.get(docType, String(docId));
        if (entry) {
            this.emit(entry.room, 'collab:closed', { docType, docId: String(docId), reason: 'deleted' });
            this._unload(entry);
        }
        if (this.store.remove) await this.store.remove(docType, String(docId));
    }

    // ── replication ──────────────────────────────────────────────────────────

    /** A message published by another instance. */
    applyPeer(message) {
        if (!message || typeof message.key !== 'string') return;
        const entry = this.docs.get(message.key);
        if (!entry) return;
        if (message.type === 'update') {
            Y.applyUpdate(entry.ydoc, Buffer.from(message.data, 'base64'), REMOTE_ORIGIN);
        } else if (message.type === 'awareness') {
            awarenessProtocol.applyAwarenessUpdate(entry.awareness, Buffer.from(message.data, 'base64'), REMOTE_ORIGIN);
        } else if (message.type === 'state-request' && this.publish) {
            this.publish({ type: 'update', key: entry.key, data: Buffer.from(Y.encodeStateAsUpdate(entry.ydoc)).toString('base64') });
        }
    }
}

module.exports = { CollabRegistry, bytesOf, keyOf, roomOf, toUint8, REMOTE_ORIGIN, MAX_MESSAGE_BYTES, MAX_DOC_BYTES };
