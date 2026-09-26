const Notification = require('../notification.model');
const prefService = require('../notificationPreferenceService');
const pushService = require('../../../features/push/push.service');

jest.mock('../notification.model');
jest.mock('../notificationPreferenceService', () => ({ getUserPreferences: jest.fn() }));
jest.mock('../../../features/push/push.service', () => ({ sendToUser: jest.fn().mockResolvedValue(undefined) }));

const notificationService = require('../notificationService');

function fakeIo() {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    return { to, emit };
}

describe('notificationService.create', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Notification.create.mockImplementation(async (doc) => ({
            ...doc,
            _id: 'n1',
            toObject: () => ({ ...doc, _id: 'n1' }),
        }));
        prefService.getUserPreferences.mockResolvedValue({ message: true, task: true, push: true });
    });

    it('stores, emits to the recipient room and pushes', async () => {
        const io = fakeIo();
        const notif = await notificationService.dmReceived(io, {
            recipientId: 'u2', senderUsername: 'nani', workspaceId: 'ws1', dmSessionId: 'dm1',
        });
        expect(notif.type).toBe('dm');
        expect(io.to).toHaveBeenCalledWith('user:u2');
        expect(io.emit).toHaveBeenCalledWith('notification:new', expect.objectContaining({ notification: expect.objectContaining({ type: 'dm' }) }));
        expect(pushService.sendToUser).toHaveBeenCalledWith('u2', expect.any(String), expect.any(String), expect.objectContaining({ dmSessionId: 'dm1' }));
    });

    it('respects the per-category preference', async () => {
        prefService.getUserPreferences.mockResolvedValue({ message: false, push: true });
        const io = fakeIo();
        const notif = await notificationService.mention(io, {
            mentionedUserId: 'u2', senderUsername: 'nani', workspaceId: 'ws1', channelName: 'general', channelId: 'c1',
        });
        expect(notif).toBeNull();
        expect(Notification.create).not.toHaveBeenCalled();
        expect(io.emit).not.toHaveBeenCalled();
    });

    it('skips push when the recipient turned it off or the type opts out', async () => {
        prefService.getUserPreferences.mockResolvedValue({ message: true, push: false });
        const io = fakeIo();
        await notificationService.dmReceived(io, { recipientId: 'u2', senderUsername: 'nani', workspaceId: 'ws1', dmSessionId: 'dm1' });
        expect(pushService.sendToUser).not.toHaveBeenCalled();

        prefService.getUserPreferences.mockResolvedValue({ message: true, push: true });
        await notificationService.reaction(io, { recipientId: 'u2', reactorUsername: 'x', emoji: '👍', workspaceId: 'ws1', channelId: 'c1' });
        expect(pushService.sendToUser).not.toHaveBeenCalled();
    });

    it('delivers always-on types even when preferences fail to load', async () => {
        prefService.getUserPreferences.mockRejectedValue(new Error('db down'));
        const io = fakeIo();
        const notif = await notificationService.create(io, { recipient: 'u2', workspaceId: 'ws1', type: 'digest', title: 'Daily digest' });
        expect(notif).not.toBeNull();
        expect(io.emit).toHaveBeenCalled();
    });

    it('createMany de-duplicates recipients', async () => {
        const io = fakeIo();
        const out = await notificationService.memberJoined(io, {
            newUserId: 'u9', newUsername: 'new', workspaceId: 'ws1', recipientIds: ['u1', 'u1', 'u2', null],
        });
        expect(out).toHaveLength(2);
        expect(Notification.create).toHaveBeenCalledTimes(2);
    });
});
