'use strict';

/**
 * Unread totals per workspace (the workspace switcher's badges, GET /api/workspaces/my): the
 * channel counts the channel list shows (muted channels left out) plus the DM counts.
 */

const oid = (n) => n.toString(16).padStart(24, '0');
const ME = oid(1);
const WS_A = oid(50);
const WS_B = oid(51);

const lean = (value) => ({ select: () => ({ lean: async () => value }) });

jest.mock('../message.model.js', () => ({ aggregate: jest.fn() }));
jest.mock('../../../../models/DMSession', () => ({ find: jest.fn() }));
jest.mock('../../../features/channels/channel.model.js', () => ({ find: jest.fn() }));
jest.mock('../../../identity', () => ({ workspaces: {}, users: {} }));
jest.mock('../../conversations/conversationKeys.service', () => ({}));

const Message = require('../message.model.js');
const DMSession = require('../../../../models/DMSession');
const Channel = require('../../../features/channels/channel.model.js');
const { getWorkspaceUnreadCounts } = require('../messages.service');

beforeEach(() => jest.clearAllMocks());

test('adds channel and DM unread counts per workspace', async () => {
    Channel.find.mockReturnValue(lean([
        { _id: oid(10), workspace: WS_A, members: [{ user: ME, joinedAt: new Date('2026-01-01') }] },
        { _id: oid(11), workspace: WS_B, members: [{ user: ME }] },
    ]));
    DMSession.find.mockReturnValue(lean([{ _id: oid(20), workspace: WS_A }, { _id: oid(21), workspace: WS_B }]));
    Message.aggregate
        .mockResolvedValueOnce([{ _id: oid(10), n: 3 }, { _id: oid(11), n: 1 }]) // channels
        .mockResolvedValueOnce([{ _id: oid(20), n: 2 }]); // DMs

    const totals = await getWorkspaceUnreadCounts(ME, [WS_A, WS_B]);

    expect(Object.fromEntries(totals)).toEqual({ [WS_A]: 5, [WS_B]: 1 });
    // Only channels I'm in and haven't muted; only DMs I haven't hidden.
    expect(Channel.find.mock.calls[0][0]).toEqual({ workspace: { $in: [WS_A, WS_B] }, 'members.user': ME, 'mutedBy.user': { $ne: ME } });
    expect(DMSession.find.mock.calls[0][0]).toEqual({ workspace: { $in: [WS_A, WS_B] }, participants: ME, 'hiddenFor.user': { $ne: ME } });
    // The same rules as the DM list: top-level, not system, not deleted, not mine, unread by me.
    const dmMatch = Message.aggregate.mock.calls[1][0][0].$match;
    expect(String(dmMatch.sender.$ne)).toBe(ME);
    expect(String(dmMatch.readBy.$ne)).toBe(ME);
    expect(dmMatch).toMatchObject({ parentId: null, type: { $ne: 'system' }, isDeleted: { $ne: true } });
});

test('no workspaces, no queries', async () => {
    const totals = await getWorkspaceUnreadCounts(ME, []);
    expect(totals.size).toBe(0);
    expect(Channel.find).not.toHaveBeenCalled();
});
