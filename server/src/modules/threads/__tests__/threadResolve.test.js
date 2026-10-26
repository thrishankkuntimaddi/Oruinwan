'use strict';

/**
 * Resolving a thread (POST /api/threads/v2/:id/resolve) uses the central access rule: someone
 * outside the conversation, or a group member who joined after the thread started, is refused,
 * and the live event reaches only people who can see the thread.
 */

const oid = (c) => String(c).repeat(24).slice(0, 24);
const NANI = oid('1');
const NIKIL = oid('4'); // joined the group after the thread
const OUTSIDER = oid('9');
const GROUP = oid('a');
const ROOT = oid('b');
const WS = oid('d');

const mockRoot = { _id: ROOT, dm: GROUP, workspace: WS, createdAt: new Date('2026-07-01T00:00:00Z'), resolvedThreadAt: null, resolvedBy: null };
const mockGroup = {
    _id: GROUP, isGroup: true, workspace: WS, participants: [NANI, NIKIL],
    memberSince: [{ user: NIKIL, at: new Date('2026-08-01T00:00:00Z') }],
};
const mockLean = (v) => {
    const c = { select: () => c, lean: () => c, populate: () => c, then: (res, rej) => Promise.resolve(v).then(res, rej) };
    return c;
};

jest.mock('../../messages/message.model.js', () => ({
    findById: jest.fn(() => {
        const doc = { ...mockRoot, save: jest.fn(async function save() { Object.assign(mockRoot, { resolvedThreadAt: this.resolvedThreadAt, resolvedBy: this.resolvedBy }); }) };
        const c = { select: () => c, lean: () => c, populate: () => c, then: (res, rej) => Promise.resolve(doc).then(res, rej) };
        return c;
    }),
}));
jest.mock('../../../../models/DMSession', () => ({ findById: jest.fn(() => mockLean(mockGroup)) }));
jest.mock('../../../features/channels/channel.model.js', () => ({ findById: jest.fn(() => mockLean(null)) }));
jest.mock('../../../identity', () => ({
    workspaces: { findById: jest.fn(async () => ({ _id: mockGroup.workspace, members: mockGroup.participants.map((user) => ({ user, status: 'active' })) })) },
    users: { findById: jest.fn(async () => null) },
}));
jest.mock('../../../shared/middleware/auth', () => (req, _res, next) => next());

const router = require('../threadsV2.routes');
const handler = router.stack.find((l) => l.route?.path === '/:messageId/resolve').route.stack.slice(-1)[0].handle;

function call(userId) {
    const sent = [];
    const io = { to: (rooms) => ({ emit: (event, payload) => sent.push({ rooms: [].concat(rooms), event, payload }) }) };
    const res = { code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    return handler({ user: { sub: userId }, params: { messageId: ROOT }, app: { get: () => io } }, res).then(() => ({ res, sent }));
}

beforeEach(() => { mockRoot.resolvedThreadAt = null; });

test('someone outside the conversation is refused', async () => {
    const { res } = await call(OUTSIDER);
    expect(res.code).toBe(404);
    expect(mockRoot.resolvedThreadAt).toBeNull();
});

test('a group member who joined after the thread started is refused (as if it did not exist)', async () => {
    const { res } = await call(NIKIL);
    expect(res.code).toBe(404);
    expect(mockRoot.resolvedThreadAt).toBeNull();
});

test('a member resolves it; the event goes only to people who can see the thread', async () => {
    const { res, sent } = await call(NANI);
    expect(res.code).toBe(200);
    expect(res.body.isResolved).toBe(true);
    const ev = sent.find((e) => e.event === 'thread-resolved');
    expect(ev.rooms).toEqual(expect.arrayContaining([`user:${NANI}`]));
    expect(ev.rooms.some((r) => r.includes(NIKIL) || r === `dm:${GROUP}`)).toBe(false);
});
