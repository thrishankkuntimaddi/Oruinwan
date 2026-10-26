'use strict';

/**
 * Lists and live events made before someone lost access, or about messages from before they
 * joined a group:
 *   - saved messages (bookmarks) and both reminder lists keep only messages they can still read;
 *   - the reminder job doesn't deliver a message they can no longer read;
 *   - live events about a group message don't reach people who joined after it was written.
 */

const oid = (c) => String(c).repeat(24).slice(0, 24);
const ANA = oid('a');
const BEN = oid('b');
const CARL = oid('c'); // joined the group later
const WS = oid('d');
const CH = oid('e');
const GROUP = oid('f');
const LEFT_CH = oid('9'); // a channel Ana left

const q = (value) => {
    const chain = {
        select: () => chain, sort: () => chain, skip: () => chain, limit: () => chain, lean: () => chain, populate: () => chain,
        then: (res, rej) => Promise.resolve(typeof value === 'function' ? value() : value).then(res, rej),
    };
    return chain;
};

jest.mock('../../../features/channels/channel.model.js', () => ({ findById: jest.fn() }));
jest.mock('../../../../models/DMSession', () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock('../../../identity', () => ({ workspaces: { findById: jest.fn() } }));

const Channel = require('../../../features/channels/channel.model.js');
const DMSession = require('../../../../models/DMSession');
const identity = require('../../../identity');
const { filterReadable } = require('../conversationAccess');
const { messageAudience, emitAboutMessage } = require('../conversationRooms');

const joined = new Date('2026-10-10T10:00:00Z');
const before = new Date('2026-10-01T10:00:00Z');
const after = new Date('2026-10-20T10:00:00Z');

beforeEach(() => {
    identity.workspaces.findById.mockResolvedValue({ _id: WS, members: [ANA, BEN, CARL].map((user) => ({ user, status: 'active' })) });
    Channel.findById.mockImplementation((id) => q(String(id) === CH
        ? { _id: CH, workspace: WS, members: [{ user: ANA }, { user: BEN }], isPrivate: true }
        : String(id) === LEFT_CH ? { _id: LEFT_CH, workspace: WS, members: [{ user: BEN }], isPrivate: true } : null));
    DMSession.findById.mockImplementation((id) => q(String(id) === GROUP
        ? { _id: GROUP, workspace: WS, isGroup: true, participants: [ANA, BEN, CARL], memberSince: [{ user: CARL, at: joined }] }
        : null));
});

describe('lists keep only what someone can still read', () => {
    it('drops messages from a channel they left, and group messages from before they joined', async () => {
        const items = [
            { _id: '1', channel: CH, createdAt: before },
            { _id: '2', channel: { _id: LEFT_CH, name: 'secret' }, createdAt: before },
            { _id: '3', dm: GROUP, createdAt: before },
            { _id: '4', dm: GROUP, createdAt: after },
        ];
        expect((await filterReadable(items, ANA)).map((m) => m._id)).toEqual(['1', '3', '4']);
        expect((await filterReadable(items, CARL)).map((m) => m._id)).toEqual(['4']);
    });

    it('nothing at all once they left the workspace', async () => {
        identity.workspaces.findById.mockResolvedValue({ _id: WS, members: [{ user: ANA, status: 'removed' }] });
        expect(await filterReadable([{ _id: '1', channel: CH, createdAt: before }], ANA)).toEqual([]);
    });

    it('reminders: by their message', async () => {
        const reminders = [{ _id: 'r1', messageId: { _id: '1', channel: LEFT_CH, createdAt: before } }, { _id: 'r2', messageId: { _id: '2', channel: CH, createdAt: before } }, { _id: 'r3', messageId: null }];
        expect((await filterReadable(reminders, ANA, (r) => r.messageId)).map((r) => r._id)).toEqual(['r2']);
    });
});

describe('the reminder job', () => {
    it("doesn't deliver a message they can no longer read", async () => {
        jest.resetModules();
        jest.doMock('../../../features/channels/channel.model.js', () => Channel);
        jest.doMock('../../../../models/DMSession', () => DMSession);
        jest.doMock('../../../identity', () => identity);
        const due = [
            { _id: 'r1', userId: ANA, note: 'x', remindAt: before, messageId: { _id: '1', channel: LEFT_CH, createdAt: before } },
            { _id: 'r2', userId: ANA, note: 'y', remindAt: before, messageId: { _id: '2', channel: CH, createdAt: before } },
        ];
        jest.doMock('../../messages/messageReminder.model', () => ({ find: jest.fn(() => q(due)), updateMany: jest.fn().mockResolvedValue({}) }));
        jest.doMock('../../messages/message.model', () => ({}));
        jest.doMock('../../../identity/hydrate', () => ({ hydrate: jest.fn(async (d) => d), USER_MIN: {} }));
        const { checkDueReminders } = require('../../../features/reminders/reminders.cron');
        const emitted = [];
        await checkDueReminders({ to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) });
        expect(emitted.map((e) => e.payload.reminderId)).toEqual(['r2']);
    });
});

describe('live events about a group message', () => {
    const io = () => {
        const sent = [];
        return { sent, to: (rooms) => ({ emit: (event, payload) => sent.push({ rooms: [].concat(rooms), event, payload }) }) };
    };

    it('a message written after everyone joined goes to the group room', async () => {
        const target = io();
        await emitAboutMessage(target, { _id: 'm', dm: GROUP, createdAt: after }, 'message:edited', { x: 1 });
        expect(target.sent).toEqual([{ rooms: [`dm:${GROUP}`], event: 'message:edited', payload: { x: 1 } }]);
    });

    it('a message from before someone joined: only the others, never them', async () => {
        const target = io();
        await emitAboutMessage(target, { _id: 'm', dm: GROUP, createdAt: before }, 'message-pinned', { ciphertext: 'c' });
        expect(target.sent).toHaveLength(1);
        const rooms = target.sent[0].rooms;
        expect(rooms).toEqual(expect.arrayContaining([`user:${ANA}`, `user:${BEN}`]));
        expect(rooms.some((r) => r.includes(CARL))).toBe(false);
        expect(rooms).not.toContain(`dm:${GROUP}`);
    });

    it('a thread reply follows its parent: written now, but in a thread from before they joined', async () => {
        const target = await messageAudience(io(), { _id: 'reply', dm: GROUP, createdAt: after }, { anchor: { _id: 'parent', dm: GROUP, createdAt: before } });
        expect(target).not.toBeNull();
        // Resolved to members' own rooms, not the group room.
        const probe = io();
        await emitAboutMessage(probe, { _id: 'parent', dm: GROUP, createdAt: before }, 'thread-reply', {});
        expect(probe.sent[0].rooms.some((r) => r.includes(CARL))).toBe(false);
    });

    it('channels and missing conversations', async () => {
        const target = io();
        await emitAboutMessage(target, { _id: 'm', channel: CH, createdAt: before }, 'message:edited', {});
        expect(target.sent[0].rooms).toEqual([`channel:${CH}`]);
        const none = io();
        await emitAboutMessage(none, { _id: 'm', dm: oid('7'), createdAt: before }, 'message:edited', {});
        expect(none.sent).toEqual([]);
    });
});
