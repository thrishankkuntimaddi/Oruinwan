'use strict';

const oid = (n) => n.toString(16).padStart(24, '0');
const ME = oid(1);
const WS = oid(50);
const CH = oid(10);

const store = new Map();
jest.mock('../../../../models/ScheduledMessage', () => ({
    countDocuments: jest.fn(async () => 0),
    create: jest.fn(async (doc) => ({ _id: '0000000000000000000000aa', ...doc, status: 'scheduled' })),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));
jest.mock('../../channels/channel.model.js', () => ({ exists: jest.fn(async () => ({ _id: 'x' })) }));
jest.mock('../../../../models/DMSession', () => ({ exists: jest.fn(async () => null) }));
const mockSendChannel = jest.fn(async (req, res) => res.status(201).json({ message: { _id: '0000000000000000000000bb' } }));
jest.mock('../../../modules/messages/messages.controller', () => ({ sendChannelMessage: (...a) => mockSendChannel(...a), sendDirectMessage: jest.fn() }));

const ScheduledMessage = require('../../../../models/ScheduledMessage');
const Channel = require('../../channels/channel.model.js');
const service = require('../scheduledMessages.service');

const enc = { ciphertext: 'Y2lwaGVy', messageIv: 'aXY=', isEncrypted: true };
const inAnHour = () => new Date(Date.now() + 3600_000).toISOString();

beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
});

test('schedules an encrypted message in a channel I am in, keeping only send fields', async () => {
    const s = await service.create(ME, { workspaceId: WS, kind: 'channel', conversationId: CH, sendAt: inAnHour(), body: { ...enc, channelId: 'other', senderId: 'evil' } });
    expect(s).toMatchObject({ kind: 'channel', conversationId: CH, status: 'scheduled' });
    const saved = ScheduledMessage.create.mock.calls[0][0];
    expect(saved.body).toEqual({ ...enc, type: 'message' });
});

test('refuses plain text, past times and conversations I am not in', async () => {
    await expect(service.create(ME, { workspaceId: WS, kind: 'channel', conversationId: CH, sendAt: inAnHour(), body: { text: 'hi' } })).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.create(ME, { workspaceId: WS, kind: 'channel', conversationId: CH, sendAt: new Date().toISOString(), body: enc })).rejects.toMatchObject({ statusCode: 400 });
    Channel.exists.mockResolvedValueOnce(null);
    await expect(service.create(ME, { workspaceId: WS, kind: 'channel', conversationId: CH, sendAt: inAnHour(), body: enc })).rejects.toMatchObject({ statusCode: 404 });
});

test('the job sends due messages through the normal send path, as their author, once', async () => {
    const doc = { _id: oid(99), user: ME, workspace: WS, kind: 'channel', conversation: CH, body: { ...enc, type: 'message' }, status: 'scheduled', save: jest.fn() };
    ScheduledMessage.find.mockReturnValue({ sort: () => ({ limit: async () => [doc] }) });
    ScheduledMessage.findOneAndUpdate.mockResolvedValueOnce({ ...doc, status: 'sending', save: doc.save });
    const room = { emit: jest.fn() };
    room.to = jest.fn(() => room);
    const io = { to: jest.fn(() => room) };
    const n = await service.sendDue(io);
    expect(n).toBe(1);
    // The author's apps hear it was sent (web and phone rooms), so their lists update live.
    expect(io.to).toHaveBeenCalledWith(`user_${ME}`);
    expect(room.to).toHaveBeenCalledWith(`user:${ME}`);
    expect(room.emit).toHaveBeenCalledWith('scheduled-message:sent', expect.objectContaining({ id: String(oid(99)) }));
    const req = mockSendChannel.mock.calls[0][0];
    expect(req.user.sub).toBe(ME);
    expect(req.body).toMatchObject({ ...enc, channelId: CH, clientMessageId: `sched-${oid(99)}` });
    // Claimed atomically before sending, so a second instance can't send it again.
    expect(ScheduledMessage.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ _id: oid(99), status: { $in: ['scheduled', 'failed'] } });
});

test('a send the server refuses is marked failed with the reason', async () => {
    mockSendChannel.mockImplementationOnce(async (req, res) => res.status(403).json({ message: 'Not a channel member' }));
    const saved = jest.fn();
    const claimed = { _id: oid(98), user: ME, workspace: WS, kind: 'channel', conversation: CH, body: enc, status: 'sending', save: saved };
    ScheduledMessage.find.mockReturnValue({ sort: () => ({ limit: async () => [claimed] }) });
    ScheduledMessage.findOneAndUpdate.mockResolvedValueOnce(claimed);
    const room = { emit: jest.fn() };
    room.to = () => room;
    await service.sendDue({ to: () => room });
    expect(room.emit).toHaveBeenCalledWith('scheduled-message:failed', expect.objectContaining({ error: 'Not a channel member' }));
    expect(claimed.status).toBe('failed');
    expect(claimed.error).toBe('Not a channel member');
});
