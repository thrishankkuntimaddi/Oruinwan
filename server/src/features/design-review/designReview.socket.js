'use strict';

/**
 * Design review rooms over Socket.IO.
 *
 *   client -> server
 *     design-review:join    { reviewId }            ack({ ok, viewers } | { ok:false, message })
 *     design-review:leave   { reviewId }
 *     design-review:pointer { reviewId, page?, x, y, timeMs? }   live pointer, relayed to the room only
 *
 *   server -> client (room design-review:<reviewId>)
 *     design-review:presence    { reviewId, userId, action: 'joined'|'left' }
 *     design-review:pointer     { reviewId, userId, page, x, y, timeMs }
 *     design-review:annotation  { reviewId, action, annotation, reply? }   (emitted by the REST routes)
 *     design-review:updated     { reviewId, review }
 *     design-review:deleted     { reviewId }
 *
 * Joining checks the same access as GET /api/v2/design-reviews/:id.
 */

const logger = require('../../../utils/logger');
const { roomOf, loadReview } = require('./designReview.service');

function clamp01(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

function registerDesignReviewSocket(io, socket, deps = {}) {
    const load = deps.loadReview || loadReview;
    const userId = String(socket.user?.id || socket.user?.sub || '');
    const joined = new Set();

    socket.on('design-review:join', async (payload = {}, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        const reviewId = String(payload?.reviewId || '');
        try {
            await load(reviewId, userId);
            const room = roomOf(reviewId);
            socket.join(room);
            joined.add(reviewId);
            socket.to(room).emit('design-review:presence', { reviewId, userId, action: 'joined' });
            let viewers = [];
            try {
                const sockets = await io.in(room).fetchSockets();
                viewers = [...new Set(sockets.map((s) => String(s.user?.id || s.user?.sub || '')).filter(Boolean))];
            } catch { /* adapter without fetchSockets */ }
            reply({ ok: true, viewers });
        } catch (err) {
            if (!err.statusCode) logger.warn(`[design-review:join] ${err.message}`);
            reply({ ok: false, message: err.statusCode ? err.message : 'Could not join review' });
        }
    });

    const leave = (reviewId) => {
        if (!joined.has(reviewId)) return;
        joined.delete(reviewId);
        const room = roomOf(reviewId);
        socket.leave(room);
        socket.to(room).emit('design-review:presence', { reviewId, userId, action: 'left' });
    };

    socket.on('design-review:leave', (payload = {}) => leave(String(payload?.reviewId || '')));

    socket.on('design-review:pointer', (payload = {}) => {
        const reviewId = String(payload?.reviewId || '');
        if (!joined.has(reviewId)) return;
        const x = clamp01(payload.x);
        const y = clamp01(payload.y);
        if (x === null || y === null) return;
        const page = Number.isInteger(payload.page) && payload.page > 0 ? payload.page : 1;
        const timeMs = Number.isFinite(Number(payload.timeMs)) && payload.timeMs !== null ? Math.max(0, Math.round(Number(payload.timeMs))) : null;
        socket.to(roomOf(reviewId)).volatile.emit('design-review:pointer', { reviewId, userId, page, x, y, timeMs });
    });

    socket.on('disconnect', () => {
        for (const reviewId of [...joined]) leave(reviewId);
    });
}

module.exports = { registerDesignReviewSocket };
