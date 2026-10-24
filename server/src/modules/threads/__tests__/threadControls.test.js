'use strict';

/**
 * Slack-style thread controls: who moderates, lock enforcement (REST and socket share
 * lockedError), adding / removing followers, DM auto-follow and unread counts.
 */

jest.mock('../../messages/message.model.js', () => ({
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    countDocuments: jest.fn(),
    find: jest.fn(),
}));
jest.mock('../threadRead.model', () => ({ updateOne: jest.fn(), find: jest.fn() }));
jest.mock('../../../features/channels/channel.model.js', () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock('../../../../models/DMSession', () => ({ findById: jest.fn() }));
jest.mock('../../../features/channels/channelMute.controller', () => ({ canManageChannel: jest.fn() }));
jest.mock('../../notifications/notificationService', () => ({ threadAdded: jest.fn().mockResolvedValue([]), threadReply: jest.fn(), mention: jest.fn() }));
jest.mock('../../../identity', () => ({
    users: {
        findById: jest.fn(async (id) => ({ _id: id, username: `name-${id}` })),
        findManyByIds: jest.fn(async (ids) => new Map(ids.map((id) => [id, { _id: id, username: `name-${id}` }]))),
    },
    workspaces: { membership: jest.fn() },
}));
jest.mock('../threadAccess', () => ({ checkConversationAccess: jest.fn(), checkThreadAccess: jest.fn() }));

const Message = require('../../messages/message.model.js');
const ThreadRead = require('../threadRead.model');
const Channel = require('../../../features/channels/channel.model.js');
const DMSession = require('../../../../models/DMSession');
const { canManageChannel } = require('../../../features/channels/channelMute.controller');
const notificationService = require('../../notifications/notificationService');
const { checkConversationAccess } = require('../threadAccess');
const controls = require('../threadControls');
const { followAndNotify } = require('../threads.service');

const oid = (n) => n.toString(16).padStart(24, '0');
const STARTER = oid(1);
const MEMBER = oid(2);
const ADMIN = oid(3);
const OUTSIDER = oid(4);
const CREATOR = oid(5);
const PARENT = oid(100);
const CHANNEL = oid(10);
const DM = oid(11);

const lean = (v) => ({ select: () => ({ lean: async () => v }), lean: async () => v });

let parent;
let emitted;
const io = { to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) };

beforeEach(() => {
    jest.clearAllMocks();
    emitted = [];
    parent = { _id: PARENT, channel: CHANNEL, workspace: oid(30), sender: STARTER, followers: [STARTER], replyCount: 3 };
    Message.findById.mockImplementation(() => lean(parent));
    Message.findByIdAndUpdate.mockImplementation((id, update) => {
        if (update.$set) parent = { ...parent, ...update.$set };
        if (update.$pull) parent = { ...parent, followers: parent.followers.filter((f) => f !== update.$pull.followers) };
        return lean(parent);
    });
    Message.updateOne.mockResolvedValue({});
    Channel.findById.mockImplementation(() => lean({ _id: CHANNEL, name: 'general', admins: [ADMIN], createdBy: CREATOR, workspace: oid(30) }));
    canManageChannel.mockImplementation(async (ch, uid) => (ch.admins || []).includes(uid));
    // Everybody except OUTSIDER can see the channel.
    checkConversationAccess.mockImplementation(async (_conv, uid) => (uid === OUTSIDER ? { ok: false, status: 404 } : { ok: true }));
});

describe('who moderates a thread', () => {
    test('channel admins, the channel creator and workspace admins moderate; members do not', async () => {
        expect(await controls.canModerateThread(parent, ADMIN)).toBe(true);
        expect(await controls.canModerateThread(parent, CREATOR)).toBe(true);
        expect(await controls.canModerateThread(parent, MEMBER)).toBe(false);
        canManageChannel.mockResolvedValueOnce(true); // a workspace owner/admin
        expect(await controls.canModerateThread(parent, OUTSIDER)).toBe(true);
    });

    test('the starter may lock their own thread but does not moderate it', async () => {
        expect(await controls.threadPermissions(parent, STARTER)).toEqual({ canModerate: false, canLock: true });
        expect(await controls.threadPermissions(parent, MEMBER)).toEqual({ canModerate: false, canLock: false });
        expect(await controls.threadPermissions(parent, ADMIN)).toEqual({ canModerate: true, canLock: true });
    });

    test('in a group DM its creator moderates; in a 1:1 DM nobody does', async () => {
        const dmParent = { ...parent, channel: null, dm: DM };
        DMSession.findById.mockImplementation(() => lean({ isGroup: true, createdBy: MEMBER }));
        expect(await controls.canModerateThread(dmParent, MEMBER)).toBe(true);
        DMSession.findById.mockImplementation(() => lean({ isGroup: false, createdBy: MEMBER }));
        expect(await controls.canModerateThread(dmParent, MEMBER)).toBe(false);
    });
});

describe('locking', () => {
    test('a channel admin locks the thread: "Locked by …" goes to the conversation', async () => {
        const info = await controls.setLock(PARENT, ADMIN, true, io);
        expect(info).toMatchObject({ locked: true, lockedBy: { _id: ADMIN, username: `name-${ADMIN}` } });
        const evt = emitted.find((e) => e.event === 'thread:locked');
        expect(evt.room).toBe(`channel:${CHANNEL}`);
        expect(evt.payload).toMatchObject({ messageId: PARENT, locked: true, channelId: CHANNEL });
    });

    test('the starter can lock and unlock their own thread', async () => {
        await controls.setLock(PARENT, STARTER, true, io);
        expect(parent.threadLockedAt).toBeInstanceOf(Date);
        const info = await controls.setLock(PARENT, STARTER, false, io);
        expect(info.locked).toBe(false);
        expect(parent.threadLockedAt).toBeNull();
    });

    test('a member who did not start the thread cannot lock it', async () => {
        await expect(controls.setLock(PARENT, MEMBER, true, io)).rejects.toMatchObject({ status: 403 });
        expect(Message.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test('someone who cannot see the conversation gets a 404', async () => {
        await expect(controls.setLock(PARENT, OUTSIDER, true, io)).rejects.toMatchObject({ status: 404 });
    });

    test('a locked thread refuses replies with a clear 403 THREAD_LOCKED', () => {
        expect(controls.lockedError({ threadLockedAt: null })).toBeNull();
        const err = controls.lockedError({ threadLockedAt: new Date(), threadLockedByName: 'dana' });
        expect(err).toMatchObject({ status: 403, code: 'THREAD_LOCKED' });
        expect(err.message).toBe('This thread was locked by dana. New replies are turned off.');
    });
});

describe('followers', () => {
    test('adding people adds only those who can see the conversation and notifies them', async () => {
        const res = await controls.addFollowers(PARENT, MEMBER, [ADMIN, OUTSIDER, STARTER, MEMBER], io);
        expect(res.added).toEqual([ADMIN, MEMBER]);
        expect(res.skipped).toEqual([OUTSIDER]);
        expect(Message.updateOne).toHaveBeenCalledWith({ _id: PARENT }, { $addToSet: { followers: { $each: [ADMIN, MEMBER] } } });
        await new Promise((r) => setImmediate(r));
        expect(notificationService.threadAdded).toHaveBeenCalledWith(io, expect.objectContaining({
            recipientIds: [ADMIN], adderUsername: `name-${MEMBER}`, channelId: CHANNEL, channelName: 'general', parentMessageId: PARENT,
        }));
    });

    test('adding nobody is a 400', async () => {
        await expect(controls.addFollowers(PARENT, MEMBER, [], io)).rejects.toMatchObject({ status: 400 });
    });

    test('anyone can remove themselves; only moderators remove others', async () => {
        parent.followers = [STARTER, MEMBER];
        await expect(controls.removeFollower(PARENT, MEMBER, STARTER)).rejects.toMatchObject({ status: 403 });
        await expect(controls.removeFollower(PARENT, MEMBER, MEMBER)).resolves.toMatchObject({ removed: MEMBER });
        await expect(controls.removeFollower(PARENT, ADMIN, STARTER)).resolves.toMatchObject({ removed: STARTER, followerCount: 0 });
    });

    test('the follower list says what the caller may do', async () => {
        parent.followers = [STARTER];
        const res = await controls.listFollowers(PARENT, ADMIN);
        expect(res).toMatchObject({ followers: [{ _id: STARTER, username: `name-${STARTER}` }], canModerate: true, canLock: true });
    });
});

describe('auto-follow and unread', () => {
    test('the first reply in a DM thread makes every participant follow it', async () => {
        DMSession.findById.mockImplementation(() => lean({ participants: [STARTER, MEMBER] }));
        Message.findById.mockImplementation(() => lean({ followers: [STARTER, MEMBER] }));
        const dmParent = { _id: PARENT, dm: DM, sender: STARTER, replyCount: 0, workspace: oid(30) };
        await followAndNotify(null, { parent: dmParent, replierId: MEMBER, senderUsername: 'member' });
        expect(Message.updateOne).toHaveBeenCalledWith({ _id: PARENT }, { $addToSet: { followers: { $each: [MEMBER, STARTER] } } });
        expect(notificationService.threadReply).toHaveBeenCalledWith(null, expect.objectContaining({ followerIds: [STARTER] }));
    });

    test('unread = replies from others since the person last read the thread', async () => {
        const readAt = new Date('2026-10-01T00:00:00Z');
        ThreadRead.find.mockReturnValue({ select: () => ({ lean: async () => [{ thread: PARENT, readAt }] }) });
        Message.countDocuments.mockImplementation(async (q) => (q.createdAt ? 2 : 7));
        const other = oid(101);
        const counts = await controls.unreadCounts(MEMBER, [PARENT, other]);
        expect(counts).toEqual({ [PARENT]: 2, [other]: 7 });
        const [first] = Message.countDocuments.mock.calls[0];
        expect(first).toMatchObject({ parentId: PARENT, sender: { $ne: MEMBER }, createdAt: { $gt: readAt } });
    });

    test('opening or replying marks the thread read (only with a database)', async () => {
        const original = controls._env.dbReady;
        controls._env.dbReady = () => false;
        await controls.markRead(PARENT, MEMBER);
        expect(ThreadRead.updateOne).not.toHaveBeenCalled();
        controls._env.dbReady = () => true;
        await controls.markRead(PARENT, MEMBER, new Date(5));
        expect(ThreadRead.updateOne).toHaveBeenCalledWith({ user: MEMBER, thread: PARENT }, { $max: { readAt: new Date(5) } }, { upsert: true });
        controls._env.dbReady = original;
    });
});
