'use strict';

/**
 * Home → Activity endpoint: access control, unread grouping, E2EE-safe
 * previews (ciphertext only, never plaintext), muted/mention flags, ordering.
 * Models are mocked; the aggregation results are what Mongo would return.
 */

const Message = require('../message.model.js');
const Channel = require('../../../features/channels/channel.model.js');
const DMSession = require('../../../../models/DMSession');
// Users and workspaces live in PostgreSQL: the identity repositories are mocked.
const identity = require('../../../identity');

jest.mock('../message.model.js');
jest.mock('../../../features/channels/channel.model.js');
jest.mock('../../../../models/DMSession');
jest.mock('../../../identity', () => ({
    workspaces: { findById: jest.fn() },
    users: { findManyByIds: jest.fn(), findById: jest.fn() },
}));

const { getWorkspaceActivity } = require('../activity.service');
const messagesController = require('../messages.controller');

const oid = (n) => n.toString(16).padStart(24, '0');
const ME = oid(1);
const BOB = oid(2);
const CAROL = oid(3);
const WS = oid(30);
const DM1 = oid(40);
const DM2 = oid(41);
const CH1 = oid(50);
const CH2 = oid(51);

/** Mongoose-ish chainable query resolving to `value`. */
function query(value) {
    const q = {
        select: jest.fn(() => q),
        populate: jest.fn(() => q),
        lean: jest.fn(() => q),
        sort: jest.fn(() => q),
        then: (res, rej) => Promise.resolve(value).then(res, rej),
    };
    return q;
}

function workspace(members) {
    // Member entries are subdocuments with their own _id, like the real model.
    identity.workspaces.findById.mockResolvedValue({ _id: WS, members: members.map((m, i) => ({ _id: oid(800 + i), ...m })) });
}

function row(conv, { unread = 1, mentions = 0, type = 'message', cipher = 'CIPHER', at = '2026-09-28T10:00:00Z', sender = BOB, text, gone = false, hiddenFor = [] } = {}) {
    return {
        _id: conv, unread, mentions,
        lastId: oid(900 + unread), lastType: type, lastSender: sender, lastCreatedAt: new Date(at),
        lastCiphertext: cipher, lastIv: cipher ? 'IV' : undefined, lastGone: gone, lastHiddenFor: hiddenFor,
        // A plaintext field the service must never pass through.
        text,
    };
}

/** The PostgreSQL users the repository knows about (everyone else is "not found"). */
function setUsers(list) {
    const byId = new Map(list.map(u => [u._id, u]));
    identity.users.findManyByIds.mockImplementation(async (ids) => new Map(ids.filter(id => byId.has(String(id))).map(id => [String(id), byId.get(String(id))])));
}

beforeEach(() => {
    jest.resetAllMocks();
    workspace([{ user: ME, status: 'active' }, { user: BOB, status: 'active' }]);
    DMSession.find.mockReturnValue(query([]));
    Channel.find.mockReturnValue(query([]));
    setUsers([]);
    Message.aggregate.mockResolvedValue([]);
});

describe('access control', () => {
    test('404 for a missing workspace', async () => {
        identity.workspaces.findById.mockResolvedValue(null);
        await expect(getWorkspaceActivity(ME, WS)).rejects.toMatchObject({ status: 404 });
    });

    test('403 for a non-member', async () => {
        workspace([{ user: BOB, status: 'active' }]);
        await expect(getWorkspaceActivity(ME, WS)).rejects.toMatchObject({ status: 403 });
        expect(DMSession.find).not.toHaveBeenCalled();
        expect(Message.aggregate).not.toHaveBeenCalled();
    });

    test('403 for a suspended or removed member', async () => {
        workspace([{ user: ME, status: 'removed' }]);
        await expect(getWorkspaceActivity(ME, WS)).rejects.toMatchObject({ status: 403 });
        workspace([{ user: ME, status: 'suspended' }]);
        await expect(getWorkspaceActivity(ME, WS)).rejects.toMatchObject({ status: 403 });
    });

    test('400 for a malformed workspace id', async () => {
        await expect(getWorkspaceActivity(ME, 'nope')).rejects.toMatchObject({ status: 400 });
    });

    test('only my own DM sessions and channels I belong to are queried', async () => {
        await getWorkspaceActivity(ME, WS);
        expect(DMSession.find).toHaveBeenCalledWith(expect.objectContaining({ workspace: WS, participants: { $in: [ME] } }));
        expect(Channel.find).toHaveBeenCalledWith(expect.objectContaining({ workspace: WS, 'members.user': ME }));
    });

    test('controller maps service errors to their status', async () => {
        workspace([{ user: BOB }]);
        const res = { status: jest.fn(() => res), json: jest.fn(() => res), set: jest.fn(() => res) };
        await messagesController.getWorkspaceActivity({ user: { sub: ME }, params: { workspaceId: WS } }, res);
        expect(res.status).toHaveBeenCalledWith(403);
    });
});

describe('items', () => {
    beforeEach(() => {
        // DM sessions hold participant ids; the users come from PostgreSQL.
        DMSession.find.mockReturnValue(query([
            { _id: DM1, participants: [ME, BOB], mutedBy: [] },
            { _id: DM2, participants: [ME, CAROL], mutedBy: [{ user: ME }] },
        ]));
        Channel.find.mockReturnValue(query([
            { _id: CH1, name: 'general', members: [{ _id: oid(700), user: ME, joinedAt: new Date('2026-01-01') }], mutedBy: [] },
            { _id: CH2, name: 'random', isPrivate: true, members: [{ _id: oid(701), user: ME }], mutedBy: [{ _id: oid(702), user: ME }] },
        ]));
        setUsers([
            { _id: ME, username: 'alice' },
            { _id: BOB, username: 'bob', profilePicture: 'b.png', isOnline: true },
            { _id: CAROL, username: 'carol', profilePicture: 'c.png' },
        ]);
        Message.aggregate.mockImplementation(async (pipeline) => {
            const match = pipeline[0].$match;
            if (match.dm) {
                return [
                    row(DM1, { unread: 2, at: '2026-09-28T10:00:00Z', text: 'secret plaintext' }),
                    row(DM2, { unread: 1, at: '2026-09-28T08:00:00Z', type: 'image', cipher: null }),
                ];
            }
            return [
                row(CH1, { unread: 3, mentions: 1, at: '2026-09-28T11:00:00Z', sender: CAROL }),
                row(CH2, { unread: 1, at: '2026-09-28T09:00:00Z', sender: CAROL, gone: true }),
            ];
        });
    });

    test('merges DMs and channels, newest first', async () => {
        const { items } = await getWorkspaceActivity(ME, WS);
        expect(items.map(i => `${i.type}:${i.id}`)).toEqual([`channel:${CH1}`, `dm:${DM1}`, `channel:${CH2}`, `dm:${DM2}`]);
    });

    test('DM rows carry the other person, count and a ciphertext preview only', async () => {
        const { items } = await getWorkspaceActivity(ME, WS);
        const dm = items.find(i => i.id === DM1);
        expect(dm).toMatchObject({ type: 'dm', unread: 2, muted: false, otherUser: { id: BOB, username: 'bob', profilePicture: 'b.png', status: 'active' } });
        expect(dm.lastMessage.preview).toEqual({ ciphertext: 'CIPHER', messageIv: 'IV' });
        expect(JSON.stringify(items)).not.toContain('secret plaintext');
    });

    test('attachments come back as a kind label, muted DMs are flagged', async () => {
        const { items } = await getWorkspaceActivity(ME, WS);
        const dm = items.find(i => i.id === DM2);
        expect(dm.muted).toBe(true);
        expect(dm.lastMessage).toMatchObject({ kindLabel: '📷 Photo', preview: null });
    });

    test('channel rows carry name, mention flag, muted flag and sender name', async () => {
        const { items } = await getWorkspaceActivity(ME, WS);
        const general = items.find(i => i.id === CH1);
        expect(general).toMatchObject({ type: 'channel', name: 'general', unread: 3, mentioned: true, muted: false });
        expect(general.lastMessage).toMatchObject({ senderId: CAROL, senderUsername: 'carol', senderAvatar: 'c.png' });
        const random = items.find(i => i.id === CH2);
        expect(random).toMatchObject({ isPrivate: true, mentioned: false, muted: true });
        // Deleted-for-everyone newest message: no preview.
        expect(random.lastMessage.preview).toBeNull();
    });

    test('unread rules: not mine, not read, top level, no system lines, not deleted, since I joined', async () => {
        await getWorkspaceActivity(ME, WS);
        const channelMatch = Message.aggregate.mock.calls.map(c => c[0][0].$match).find(m => m.$or);
        expect(String(channelMatch.sender.$ne)).toBe(ME);
        expect(String(channelMatch.readBy.$ne)).toBe(ME);
        expect(channelMatch.parentId).toBeNull();
        expect(channelMatch.type).toEqual({ $ne: 'system' });
        expect(channelMatch.isDeleted).toEqual({ $ne: true });
        const general = channelMatch.$or.find(c => String(c.channel) === CH1);
        expect(general.createdAt.$gte).toEqual(new Date('2026-01-01'));
    });

    test('a message hidden for me does not leak its preview', async () => {
        Message.aggregate.mockImplementation(async (pipeline) => (
            pipeline[0].$match.dm ? [row(DM1, { hiddenFor: [ME] })] : []
        ));
        const { items } = await getWorkspaceActivity(ME, WS);
        expect(items[0].lastMessage.preview).toBeNull();
    });
});
