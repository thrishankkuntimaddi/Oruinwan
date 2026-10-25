'use strict';

const oid = (n) => n.toString(16).padStart(24, '0');
const ME = oid(1);
const WS = oid(50);
const CH = oid(10);

jest.mock('../../../../models/ConversationPref', () => ({
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));
jest.mock('../../channels/channel.model.js', () => ({ exists: jest.fn() }));
jest.mock('../../../../models/DMSession', () => ({ exists: jest.fn() }));

const ConversationPref = require('../../../../models/ConversationPref');
const Channel = require('../../channels/channel.model.js');
const DMSession = require('../../../../models/DMSession');
const { setPref, listPrefs } = require('../conversationPrefs.service');

const lean = (v) => ({ lean: async () => v });

beforeEach(() => {
    jest.clearAllMocks();
    Channel.exists.mockResolvedValue({ _id: CH });
    DMSession.exists.mockResolvedValue(null);
});

test('pins a channel I am in, un-archiving it', async () => {
    ConversationPref.countDocuments.mockResolvedValue(2);
    ConversationPref.findOneAndUpdate.mockReturnValue(lean({ kind: 'channel', conversation: CH, pinnedAt: new Date(), archivedAt: null }));
    const pref = await setPref(ME, { workspaceId: WS, kind: 'channel', id: CH, pinned: true });
    expect(pref).toMatchObject({ kind: 'channel', id: CH });
    const update = ConversationPref.findOneAndUpdate.mock.calls[0][1].$set;
    expect(update.pinnedAt).toBeInstanceOf(Date);
    expect(update.archivedAt).toBeNull();
});

test('refuses a fourth pin', async () => {
    ConversationPref.countDocuments.mockResolvedValue(3);
    await expect(setPref(ME, { workspaceId: WS, kind: 'channel', id: CH, pinned: true })).rejects.toMatchObject({ statusCode: 409, code: 'PIN_LIMIT' });
    expect(ConversationPref.findOneAndUpdate).not.toHaveBeenCalled();
});

test('archiving unpins', async () => {
    ConversationPref.findOneAndUpdate.mockReturnValue(lean({ kind: 'channel', conversation: CH, pinnedAt: null, archivedAt: new Date() }));
    await setPref(ME, { workspaceId: WS, kind: 'channel', id: CH, archived: true });
    const update = ConversationPref.findOneAndUpdate.mock.calls[0][1].$set;
    expect(update.pinnedAt).toBeNull();
    expect(update.archivedAt).toBeInstanceOf(Date);
});

test('a conversation I am not in is not found', async () => {
    Channel.exists.mockResolvedValue(null);
    await expect(setPref(ME, { workspaceId: WS, kind: 'channel', id: CH, pinned: true })).rejects.toMatchObject({ statusCode: 404 });
});

test('bad input is rejected', async () => {
    await expect(setPref(ME, { workspaceId: WS, kind: 'note', id: CH, pinned: true })).rejects.toMatchObject({ statusCode: 400 });
    await expect(setPref(ME, { workspaceId: WS, kind: 'dm', id: CH })).rejects.toMatchObject({ statusCode: 400 });
});

test('lists only pinned or archived chats', async () => {
    ConversationPref.find.mockReturnValue(lean([{ kind: 'dm', conversation: oid(20), pinnedAt: new Date('2026-10-25'), archivedAt: null }]));
    const list = await listPrefs(ME, WS);
    expect(list).toEqual([{ kind: 'dm', id: oid(20), pinnedAt: new Date('2026-10-25'), archivedAt: null }]);
    expect(ConversationPref.find.mock.calls[0][0].$or).toBeTruthy();
});
