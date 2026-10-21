'use strict';

const { registerDesignReviewSocket } = require('../designReview.socket');

function makeSocket(userId) {
    const handlers = {};
    const sent = [];
    const socket = {
        user: { id: userId },
        rooms: new Set(),
        on: (event, fn) => { handlers[event] = fn; },
        join: jest.fn((room) => socket.rooms.add(room)),
        leave: jest.fn((room) => socket.rooms.delete(room)),
        to: (room) => {
            const emitter = { emit: (event, payload) => sent.push({ room, event, payload }) };
            emitter.volatile = emitter;
            return emitter;
        },
    };
    return { socket, handlers, sent };
}

const io = { in: () => ({ fetchSockets: async () => [{ user: { id: 'u1' } }, { user: { id: 'u2' } }] }) };
const REVIEW = 'a'.repeat(24);

test('join checks access, announces presence and returns viewers', async () => {
    const { socket, handlers, sent } = makeSocket('u1');
    const loadReview = jest.fn(async (id) => { if (id !== REVIEW) throw Object.assign(new Error('Review not found'), { statusCode: 404 }); });
    registerDesignReviewSocket(io, socket, { loadReview });

    const denied = jest.fn();
    await handlers['design-review:join']({ reviewId: 'b'.repeat(24) }, denied);
    expect(denied).toHaveBeenCalledWith({ ok: false, message: 'Review not found' });
    expect(socket.join).not.toHaveBeenCalled();

    const ack = jest.fn();
    await handlers['design-review:join']({ reviewId: REVIEW }, ack);
    expect(loadReview).toHaveBeenCalledWith(REVIEW, 'u1');
    expect(socket.rooms.has(`design-review:${REVIEW}`)).toBe(true);
    expect(ack).toHaveBeenCalledWith({ ok: true, viewers: ['u1', 'u2'] });
    expect(sent).toContainEqual({ room: `design-review:${REVIEW}`, event: 'design-review:presence', payload: { reviewId: REVIEW, userId: 'u1', action: 'joined' } });
});

test('pointer is relayed only after joining, clamped; disconnect leaves', async () => {
    const { socket, handlers, sent } = makeSocket('u1');
    registerDesignReviewSocket(io, socket, { loadReview: async () => ({}) });
    handlers['design-review:pointer']({ reviewId: REVIEW, x: 0.5, y: 0.5 });
    expect(sent).toHaveLength(0);
    await handlers['design-review:join']({ reviewId: REVIEW });
    handlers['design-review:pointer']({ reviewId: REVIEW, x: 2, y: 0.25, page: 3, timeMs: 1500.4 });
    expect(sent.pop()).toEqual({ room: `design-review:${REVIEW}`, event: 'design-review:pointer', payload: { reviewId: REVIEW, userId: 'u1', page: 3, x: 1, y: 0.25, timeMs: 1500 } });
    handlers.disconnect();
    expect(socket.leave).toHaveBeenCalledWith(`design-review:${REVIEW}`);
    expect(sent.pop().payload.action).toBe('left');
});
