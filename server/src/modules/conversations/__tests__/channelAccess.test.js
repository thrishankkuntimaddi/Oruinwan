'use strict';

/**
 * Channels: only members of the channel's own workspace can join it, and people who leave or
 * are removed drop out of its live room and lose their copy of its key at once.
 */

const oid = (c) => String(c).repeat(24).slice(0, 24);
const ANA = oid('a');
const BEN = oid('b');
const OUTSIDER = oid('c');
const WS = oid('d');
const CH = oid('e');

jest.mock('../../../features/channels/channel.model.js', () => ({ findById: jest.fn() }));
jest.mock('../../messages/message.model.js', () => ({ create: jest.fn(async (d) => ({ ...d, _id: 'sys' })) }));
jest.mock('../../../identity', () => ({
    workspaces: { findById: jest.fn() },
    users: { findById: jest.fn().mockResolvedValue({ username: 'ana' }) },
}));
jest.mock('../../../identity/hydrate', () => ({ hydrate: jest.fn(async (d) => d) }));
jest.mock('../../../../utils/mongooseRetry', () => ({ saveWithRetry: jest.fn(async (doc) => doc) }));
jest.mock('../conversationKeys.service', () => ({
    hasConversationKeys: jest.fn().mockResolvedValue(true),
    distributeKeyToNewMember: jest.fn().mockResolvedValue(true),
    removeParticipant: jest.fn().mockResolvedValue(true),
}));

const Channel = require('../../../features/channels/channel.model.js');
const identity = require('../../../identity');
const keys = require('../conversationKeys.service');
const { saveWithRetry } = require('../../../../utils/mongooseRetry');
const ctrl = require('../../../features/channels/channel.controller');

function makeRes() {
    const res = { statusCode: 200, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
}

function fakeIo() {
    const left = [];
    const io = {
        left,
        to: () => ({ emit: () => {} }),
        in: (room) => ({ socketsLeave: (rooms) => left.push([room, rooms]), socketsJoin: () => {} }),
    };
    return io;
}

function channel(over = {}) {
    const doc = {
        _id: CH, workspace: WS, name: 'launch', isPrivate: false, isDefault: false, createdAt: new Date(), createdBy: ANA,
        members: [{ user: ANA, joinedAt: new Date() }, { user: BEN, joinedAt: new Date() }], admins: [ANA],
        isAdmin: (u) => String(u) === ANA,
        ...over,
    };
    return doc;
}

beforeEach(() => {
    jest.clearAllMocks();
    identity.workspaces.findById.mockResolvedValue({ _id: WS, members: [ANA, BEN].map((user) => ({ user, status: 'active', role: user === ANA ? 'owner' : 'member' })) });
});

test('someone outside the workspace cannot join its public channel or get its key', async () => {
    const doc = channel({ members: [{ user: ANA }] });
    Channel.findById.mockResolvedValue(doc);
    const res = makeRes();
    await ctrl.joinChannel({ user: { sub: OUTSIDER }, params: { id: CH }, app: { get: () => null } }, res);
    expect(res.statusCode).toBe(404);
    expect(saveWithRetry).not.toHaveBeenCalled();
    expect(keys.distributeKeyToNewMember).not.toHaveBeenCalled();
});

test('a workspace member joins a public channel and gets its key', async () => {
    const doc = channel({ members: [{ user: ANA }] });
    Channel.findById.mockResolvedValue(doc);
    const res = makeRes();
    await ctrl.joinChannel({ user: { sub: BEN }, params: { id: CH }, app: { get: () => null } }, res);
    expect(res.body).toEqual({ channelId: CH, joined: true });
    expect(keys.distributeKeyToNewMember).toHaveBeenCalledWith(CH, 'channel', BEN, WS);
});

test('removing someone takes their devices out of the channel room and removes their key copy', async () => {
    Channel.findById.mockResolvedValue(channel());
    const io = fakeIo();
    const res = makeRes();
    await ctrl.removeChannelMember({ user: { sub: ANA }, params: { id: CH }, body: { userId: BEN }, app: { get: () => io } }, res);
    expect(res.statusCode).toBe(200);
    expect(io.left).toEqual(expect.arrayContaining([[`user:${BEN}`, [`channel:${CH}`]]]));
    expect(keys.removeParticipant).toHaveBeenCalledWith(CH, 'channel', BEN);
});
