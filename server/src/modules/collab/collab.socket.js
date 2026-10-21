'use strict';

/**
 * Socket.IO handlers for realtime collaborative documents (Yjs over Socket.IO).
 * Wire format and client flow: docs/api/collab.md.
 *
 *   collab:join       { docType, docId }        ack -> { ok, readOnly } | { ok:false, code, message }
 *   collab:sync       { docType, docId, msg }   y-protocols sync message (binary)
 *   collab:awareness  { docType, docId, msg }   y-protocols awareness update (binary)
 *   collab:leave      { docType, docId }
 *
 * Server -> client: collab:sync, collab:awareness, collab:saved, collab:error, collab:closed.
 */

const logger = require('../../../utils/logger');
const { ADAPTERS } = require('./collab.adapters');

const DOC_TYPES = new Set(['note', 'knowledge', 'whiteboard']);
const REAUTH_AFTER_MS = 60 * 1000;
const MAX_DOCS_PER_SOCKET = 20;

function validTarget(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const { docType, docId } = payload;
    if (!DOC_TYPES.has(docType) || typeof docId !== 'string' || !/^[a-f0-9]{24}$/i.test(docId)) return null;
    return { docType, docId };
}

function errorPayload(err) {
    const status = err && (err.status || err.statusCode);
    const code = err && err.code && typeof err.code === 'string' ? err.code
        : status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : status === 400 ? 'BAD_REQUEST' : 'SERVER_ERROR';
    return { code, message: (err && err.message) || 'Something went wrong' };
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {{ registry?: object, adapters?: object }} [deps]  test injection
 */
function registerCollabSocket(io, socket, deps = {}) {
    const service = require('./collab.service');
    const registry = deps.registry || service.registry;
    const adapters = deps.adapters || ADAPTERS;
    if (!deps.registry) service.bindIO(io);
    const userId = String(socket.user && (socket.user.id || socket.user.sub));
    /** key -> { entry, conn, queue } for the documents this socket has open */
    const open = new Map();

    const fail = (target, err) => socket.emit('collab:error', { ...target, ...errorPayload(err) });

    /** Run per-document work in arrival order (updates must not overtake each other). */
    function enqueue(key, fn) {
        const slot = open.get(key);
        if (!slot) return Promise.resolve();
        slot.queue = slot.queue.then(fn).catch(() => {});
        return slot.queue;
    }

    /** Re-check access every minute so revoked sharing takes effect on a live connection. */
    async function recheck(target, slot) {
        if (Date.now() - slot.conn.checkedAt < REAUTH_AFTER_MS) return true;
        try {
            const access = await adapters[target.docType].authorize(target.docId, userId);
            slot.conn.canWrite = !!access.canWrite;
            slot.conn.checkedAt = Date.now();
            return true;
        } catch (err) {
            fail(target, err);
            await leave(target, 'revoked');
            return false;
        }
    }

    async function leave(target, reason) {
        const key = `${target.docType}:${target.docId}`;
        const slot = open.get(key);
        if (!slot) return;
        open.delete(key);
        socket.leave(slot.entry.room);
        if (reason) socket.emit('collab:closed', { ...target, reason });
        await registry.removeConn(slot.entry, socket.id).catch((err) => logger.warn(`[COLLAB] leave failed: ${err.message}`));
    }

    socket.on('collab:join', async (payload, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        const target = validTarget(payload);
        if (!target) return reply({ ok: false, code: 'BAD_REQUEST', message: 'docType and docId are required' });
        const key = `${target.docType}:${target.docId}`;
        try {
            if (!open.has(key) && open.size >= MAX_DOCS_PER_SOCKET) {
                return reply({ ok: false, code: 'TOO_MANY_DOCS', message: 'Too many open documents on this connection' });
            }
            const access = await adapters[target.docType].authorize(target.docId, userId);
            if (open.has(key)) await leave(target);
            const entry = await registry.open(target.docType, target.docId, access.workspaceId);
            const conn = registry.addConn(entry, { socketId: socket.id, userId, canWrite: access.canWrite });
            if (socket.connected === false) {
                // Gone while the document loaded: release it so it can unload.
                await registry.removeConn(entry, socket.id);
                return undefined;
            }
            open.set(key, { entry, conn, queue: Promise.resolve() });
            socket.join(entry.room);
            reply({ ok: true, ...target, readOnly: !access.canWrite });
            const first = registry.joinMessages(entry);
            socket.emit('collab:sync', { ...target, msg: first.sync });
            if (first.awareness) socket.emit('collab:awareness', { ...target, msg: first.awareness });
        } catch (err) {
            if (!err.status && !err.statusCode) logger.error(`[COLLAB] join ${key} failed: ${err.message}`);
            reply({ ok: false, ...errorPayload(err) });
        }
        return undefined;
    });

    socket.on('collab:sync', (payload) => {
        const target = validTarget(payload);
        if (!target) return;
        const key = `${target.docType}:${target.docId}`;
        enqueue(key, async () => {
            const slot = open.get(key);
            if (!slot || !(await recheck(target, slot))) return;
            try {
                const replyMsg = registry.handleSync(slot.entry, slot.conn, payload.msg);
                if (replyMsg) socket.emit('collab:sync', { ...target, msg: replyMsg });
            } catch (err) {
                fail(target, err);
            }
        });
    });

    socket.on('collab:awareness', (payload) => {
        const target = validTarget(payload);
        if (!target) return;
        const key = `${target.docType}:${target.docId}`;
        enqueue(key, async () => {
            const slot = open.get(key);
            if (!slot) return;
            try {
                registry.handleAwareness(slot.entry, slot.conn, payload.msg);
            } catch (err) {
                fail(target, err);
            }
        });
    });

    socket.on('collab:leave', (payload) => {
        const target = validTarget(payload);
        if (!target) return;
        const key = `${target.docType}:${target.docId}`;
        enqueue(key, () => leave(target));
    });

    socket.on('disconnect', () => {
        for (const key of Array.from(open.keys())) {
            const [docType, docId] = key.split(':');
            leave({ docType, docId });
        }
    });
}

module.exports = registerCollabSocket;
module.exports.DOC_TYPES = DOC_TYPES;
