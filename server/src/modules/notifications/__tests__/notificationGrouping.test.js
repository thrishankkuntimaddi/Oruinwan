'use strict';

// Chat notifications: one grouped row per conversation, nothing for what is on screen,
// reading clears them everywhere, Do not disturb is silent.

jest.mock('../notification.model');
jest.mock('../../../identity', () => ({ workspaces: { findById: jest.fn() }, users: { findById: jest.fn() } }));
jest.mock('../notificationPreferenceService', () => ({ getUserPreferences: jest.fn() }));
jest.mock('../../../features/push/push.service', () => ({ sendToUser: jest.fn().mockResolvedValue(undefined) }));

const Notification = require('../notification.model');
const identity = require('../../../identity');
const prefService = require('../notificationPreferenceService');
const pushService = require('../../../features/push/push.service');
const viewing = require('../viewingPresence');
const svc = require('../notificationService');

const WS = '64b000000000000000000001';
const DM = 'd'.repeat(24);
const CH = 'c'.repeat(24);
const PARENT = 'e'.repeat(24);

function fakeIo() {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    return { to, emit };
}

/** A saved grouped row, as Mongoose would hand it back. */
function savedDoc(doc) {
    const d = { ...doc, _id: 'n1' };
    d.markModified = jest.fn();
    d.save = jest.fn(async () => d);
    d.toObject = () => ({ ...d });
    return d;
}

beforeEach(() => {
    jest.clearAllMocks();
    viewing._reset();
    svc._resetPushDebounce();
    identity.workspaces.findById.mockResolvedValue({ _id: WS, members: ['u1', 'u2'].map((user) => ({ user, status: 'active' })) });
    identity.users.findById.mockResolvedValue({ _id: 'u2', userStatus: 'active' });
    prefService.getUserPreferences.mockResolvedValue({ message: true, threadReply: true, push: true });
    Notification.findOne.mockResolvedValue(null);
    Notification.create.mockImplementation(async (doc) => ({ ...doc, _id: 'n1', toObject: () => ({ ...doc, _id: 'n1' }) }));
});

describe('groupKeyFor', () => {
    test('one key per conversation, per thread for replies and thread mentions', () => {
        expect(svc.groupKeyFor('dm', { dmSessionId: DM })).toBe(`dm:${DM}`);
        expect(svc.groupKeyFor('mention', { channelId: CH })).toBe(`mention:${CH}`);
        expect(svc.groupKeyFor('mention', { channelId: CH, parentMessageId: PARENT })).toBe(`mention:${CH}:${PARENT}`);
        expect(svc.groupKeyFor('thread_reply', { channelId: CH, parentMessageId: PARENT })).toBe(`thread:${PARENT}`);
        expect(svc.groupKeyFor('task_assigned', { taskId: 't1' })).toBeNull();
    });
});

describe('grouping', () => {
    test('the first DM creates a row with count 1', async () => {
        const io = fakeIo();
        await svc.dmReceived(io, { recipientId: 'u2', senderUsername: 'ben', workspaceId: WS, dmSessionId: DM });
        expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({
            groupKey: `dm:${DM}`, meta: expect.objectContaining({ count: 1, senders: ['ben'] }),
        }));
        expect(io.emit).toHaveBeenCalledWith('notification:new', expect.anything());
    });

    test('more DMs while it is unread count up the same row', async () => {
        const existing = savedDoc({ recipient: 'u2', workspaceId: WS, type: 'dm', groupKey: `dm:${DM}`, read: false, meta: { count: 4, senders: ['ben'] } });
        Notification.findOne.mockResolvedValue(existing);
        const io = fakeIo();
        await svc.dmReceived(io, { recipientId: 'u2', senderUsername: 'ben', workspaceId: WS, dmSessionId: DM });
        expect(Notification.create).not.toHaveBeenCalled();
        expect(existing.save).toHaveBeenCalled();
        expect(existing.meta.count).toBe(5);
        expect(existing.title).toBe('ben · 5 new messages');
        expect(io.emit).toHaveBeenCalledWith('notification:updated', expect.objectContaining({ notification: expect.objectContaining({ title: 'ben · 5 new messages' }) }));
        expect(Notification.findOne).toHaveBeenCalledWith({ recipient: 'u2', workspaceId: WS, groupKey: `dm:${DM}`, read: false });
    });

    test('push: once per window for a grouped row, with the count in the title', async () => {
        await svc.dmReceived(fakeIo(), { recipientId: 'u2', senderUsername: 'ben', workspaceId: WS, dmSessionId: DM });
        expect(pushService.sendToUser).toHaveBeenCalledTimes(1);
        const existing = savedDoc({ recipient: 'u2', workspaceId: WS, type: 'dm', groupKey: `dm:${DM}`, read: false, meta: { count: 1 } });
        Notification.findOne.mockResolvedValue(existing);
        await svc.dmReceived(fakeIo(), { recipientId: 'u2', senderUsername: 'ben', workspaceId: WS, dmSessionId: DM });
        expect(pushService.sendToUser).toHaveBeenCalledTimes(1); // within 30s: no second buzz
        svc._resetPushDebounce();
        await svc.dmReceived(fakeIo(), { recipientId: 'u2', senderUsername: 'ben', workspaceId: WS, dmSessionId: DM });
        expect(pushService.sendToUser).toHaveBeenLastCalledWith('u2', expect.stringMatching(/new messages/), expect.any(String), expect.objectContaining({ count: expect.any(String) }));
    });
});

describe('nothing for what is on screen', () => {
    test('a DM the person is reading (any device) stores nothing and pushes nothing', async () => {
        viewing.record('u2', 'phone', { conversationType: 'dm', conversationId: DM, visible: true, focused: true, client: 'mobile' });
        const io = fakeIo();
        const out = await svc.dmReceived(io, { recipientId: 'u2', senderUsername: 'ben', workspaceId: WS, dmSessionId: DM });
        expect(out).toBeNull();
        expect(Notification.create).not.toHaveBeenCalled();
        expect(pushService.sendToUser).not.toHaveBeenCalled();
    });

    test('a conversation open in the split pane counts', async () => {
        viewing.record('u2', 'tab', { conversationType: 'channel', conversationId: CH, conversations: [{ conversationType: 'dm', conversationId: DM }], visible: true, focused: true });
        expect(await svc.dmReceived(fakeIo(), { recipientId: 'u2', senderUsername: 'ben', workspaceId: WS, dmSessionId: DM })).toBeNull();
    });

    test('thread replies are skipped only while that thread is open', async () => {
        viewing.record('u2', 'tab', { conversationType: 'channel', conversationId: CH, visible: true, focused: true });
        const payload = { followerIds: ['u2'], senderUsername: 'ben', workspaceId: WS, channelId: CH, channelName: 'eng', parentMessageId: PARENT };
        await svc.threadReply(fakeIo(), payload);
        expect(Notification.create).toHaveBeenCalledTimes(1);

        Notification.create.mockClear();
        viewing.record('u2', 'tab', { conversationType: 'channel', conversationId: CH, threadId: PARENT, visible: true, focused: true });
        await svc.threadReply(fakeIo(), payload);
        expect(Notification.create).not.toHaveBeenCalled();
    });

    test('an open phone app still gets push for other conversations; an active web tab does not', async () => {
        viewing.record('u2', 'phone', { visible: true, focused: true, client: 'mobile' });
        await svc.dmReceived(fakeIo(), { recipientId: 'u2', senderUsername: 'ben', workspaceId: WS, dmSessionId: DM });
        expect(pushService.sendToUser).toHaveBeenCalledTimes(1);

        pushService.sendToUser.mockClear();
        svc._resetPushDebounce();
        viewing.record('u2', 'tab', { visible: true, focused: true });
        await svc.dmReceived(fakeIo(), { recipientId: 'u2', senderUsername: 'ben', workspaceId: WS, dmSessionId: 'f'.repeat(24) });
        expect(pushService.sendToUser).not.toHaveBeenCalled();
    });
});

describe('Do not disturb', () => {
    test('stored and sent silently, never pushed', async () => {
        identity.users.findById.mockResolvedValue({ _id: 'u2', userStatus: 'dnd' });
        const io = fakeIo();
        await svc.dmReceived(io, { recipientId: 'u2', senderUsername: 'ben', workspaceId: WS, dmSessionId: DM });
        expect(Notification.create).toHaveBeenCalled();
        expect(io.emit).toHaveBeenCalledWith('notification:new', expect.objectContaining({ silent: true }));
        expect(pushService.sendToUser).not.toHaveBeenCalled();
    });
});

describe('markConversationRead', () => {
    test('reads the conversation rows and tells every device', async () => {
        Notification.find.mockReturnValue({ select: () => ({ lean: async () => [{ _id: 'n1', workspaceId: WS }, { _id: 'n2', workspaceId: WS }] }) });
        Notification.updateMany.mockResolvedValue({ modifiedCount: 2 });
        const io = fakeIo();
        const ids = await svc.markConversationRead(io, { userId: 'u2', conversationType: 'dm', conversationId: DM });
        expect(ids).toEqual(['n1', 'n2']);
        expect(Notification.find).toHaveBeenCalledWith(expect.objectContaining({
            recipient: 'u2', read: false, type: { $in: ['dm', 'mention'] }, 'meta.dmSessionId': DM,
        }));
        expect(Notification.updateMany).toHaveBeenCalledWith({ _id: { $in: ['n1', 'n2'] } }, { $set: { read: true } });
        expect(io.to).toHaveBeenCalledWith('user:u2');
        expect(io.emit).toHaveBeenCalledWith('notification:read', { ids: ['n1', 'n2'], workspaceId: WS });
    });

    test('a thread read clears only that thread', async () => {
        Notification.find.mockReturnValue({ select: () => ({ lean: async () => [] }) });
        await svc.markConversationRead(fakeIo(), { userId: 'u2', threadId: PARENT });
        expect(Notification.find).toHaveBeenCalledWith({ recipient: 'u2', read: false, 'meta.parentMessageId': PARENT });
        expect(Notification.updateMany).not.toHaveBeenCalled();
    });
});

describe('merging old one-per-message rows', () => {
    const legacyRows = (rows) => {
        Notification.find.mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => rows }) }) });
    };

    test('unread rows from before grouping become one row per conversation with the total count', async () => {
        legacyRows([
            { _id: 'a3', recipient: 'u2', workspaceId: WS, type: 'dm', title: 'New message from bob', meta: { dmSessionId: DM, senderUsername: 'bob' } },
            { _id: 'a2', recipient: 'u2', workspaceId: WS, type: 'dm', title: 'New message from bob', meta: { dmSessionId: DM, senderUsername: 'bob' } },
            { _id: 'a1', recipient: 'u2', workspaceId: WS, type: 'dm', title: 'New message from bob', meta: { dmSessionId: DM, senderUsername: 'bob' } },
            { _id: 'b1', recipient: 'u2', workspaceId: WS, type: 'mention', title: 'bob mentioned you', meta: { channelId: CH, senderUsername: 'bob' } },
        ]);
        Notification.findOne.mockResolvedValue(null);
        Notification.updateOne = jest.fn().mockResolvedValue({});
        Notification.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 2 });

        const removed = await svc.mergeLegacyChatNotifications();

        expect(removed).toBe(2);
        // The newest DM row keeps the count of all three.
        expect(Notification.updateOne).toHaveBeenCalledWith({ _id: 'a3' }, { $set: expect.objectContaining({
            groupKey: `dm:${DM}`, title: 'bob · 3 new messages', meta: expect.objectContaining({ count: 3 }),
        }) });
        expect(Notification.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['a2', 'a1'] } });
        // A single mention just gets its key.
        expect(Notification.updateOne).toHaveBeenCalledWith({ _id: 'b1' }, { $set: { groupKey: `mention:${CH}`, 'meta.count': 1 } });
    });

    test('old rows fold into a grouped row that already exists', async () => {
        legacyRows([{ _id: 'a1', recipient: 'u2', workspaceId: WS, type: 'dm', title: 'New message from bob', meta: { dmSessionId: DM, senderUsername: 'bob' } }]);
        Notification.findOne.mockResolvedValue({ _id: 'g1', type: 'dm', title: 'bob · 2 new messages', meta: { dmSessionId: DM, senderUsername: 'bob', count: 2 } });
        Notification.updateOne = jest.fn().mockResolvedValue({});
        Notification.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 1 });

        await svc.mergeLegacyChatNotifications();

        expect(Notification.updateOne).toHaveBeenCalledWith({ _id: 'g1' }, { $set: expect.objectContaining({ meta: expect.objectContaining({ count: 3 }), title: 'bob · 3 new messages' }) });
        expect(Notification.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['a1'] } });
    });

    test('nothing to merge does nothing', async () => {
        legacyRows([]);
        Notification.deleteMany = jest.fn();
        expect(await svc.mergeLegacyChatNotifications()).toBe(0);
        expect(Notification.deleteMany).not.toHaveBeenCalled();
    });
});
