'use strict';

/**
 * conversationRooms.rotateWithout: a private channel or a group that loses someone who held its
 * key gets a new key for the people still in it; public channels, 1:1 DMs and people who never
 * held the key don't trigger one. evictFromChannel does it before taking their key copies.
 */

const U = (c) => String(c).repeat(24);
const [ANA, BEN, CAL] = [U('a'), U('b'), U('c')];
const CH = U('1');
const DM = U('2');

const mockDocs = new Map();
const mockLean = (v) => ({ select: () => ({ lean: async () => v }) });
const mockChannels = new Map();
const mockDms = new Map();
jest.mock('../../../features/channels/channel.model.js', () => ({ findById: (id) => mockLean(mockChannels.get(String(id)) || null) }));
jest.mock('../../../../models/DMSession', () => ({ findById: (id) => mockLean(mockDms.get(String(id)) || null) }));
jest.mock('../../../identity/queries/auth', () => ({ conversationKeyDocs: { findByConversation: async (id) => mockDocs.get(String(id)) || null } }));
jest.mock('../keyEpochs', () => ({ rotate: jest.fn(async () => ({ status: 'ROTATED', version: 2 })), announce: jest.fn() }));
jest.mock('../conversationKeys.service', () => ({ removeParticipant: jest.fn(async () => true) }));

const epochs = require('../keyEpochs');
const keys = require('../conversationKeys.service');
const rooms = require('../conversationRooms');

const io = { in: () => ({ socketsLeave: jest.fn() }), to: () => ({ emit: jest.fn() }) };
const holders = (...ids) => ({ encryptedKeys: ids.map((userId) => ({ userId })) });

beforeEach(() => {
    jest.clearAllMocks();
    mockChannels.clear();
    mockDms.clear();
    mockDocs.clear();
});

test('a private channel: new key for the members left, announced', async () => {
    mockChannels.set(CH, { isPrivate: true, members: [{ user: ANA }, { user: BEN }] });
    mockDocs.set(CH, holders(ANA, BEN, CAL));
    await expect(rooms.rotateWithout(io, CH, 'channel', CAL)).resolves.toBe(2);
    expect(epochs.rotate).toHaveBeenCalledWith(CH, 'channel', { memberIds: [ANA, BEN], keepOld: [ANA, BEN] });
    expect(epochs.announce).toHaveBeenCalledWith(io, CH, 'channel', 2);
});

test('a public channel: no new key (anyone in the workspace may join and read it)', async () => {
    mockChannels.set(CH, { isPrivate: false, members: [{ user: ANA }] });
    mockDocs.set(CH, holders(ANA, CAL));
    await expect(rooms.rotateWithout(io, CH, 'channel', CAL)).resolves.toBeNull();
    expect(epochs.rotate).not.toHaveBeenCalled();
});

test('a group: new key; a 1:1 DM or someone who never held the key: none', async () => {
    mockDms.set(DM, { isGroup: true, participants: [ANA, BEN] });
    mockDocs.set(DM, holders(ANA, BEN));
    await expect(rooms.rotateWithout(io, DM, 'dm', CAL)).resolves.toBeNull(); // Cal never held it
    mockDocs.set(DM, holders(ANA, BEN, CAL));
    await expect(rooms.rotateWithout(io, DM, 'dm', CAL)).resolves.toBe(2);
    mockDms.set(DM, { isGroup: false, participants: [ANA, CAL] });
    epochs.rotate.mockClear();
    await expect(rooms.rotateWithout(io, DM, 'dm', CAL)).resolves.toBeNull();
    expect(epochs.rotate).not.toHaveBeenCalled();
});

test('a failure to rotate never blocks the removal', async () => {
    mockChannels.set(CH, { isPrivate: true, members: [{ user: ANA }] });
    mockDocs.set(CH, holders(ANA, CAL));
    epochs.rotate.mockRejectedValueOnce(new Error('postgres down'));
    await rooms.evictFromChannel(io, CH, CAL);
    expect(keys.removeParticipant).toHaveBeenCalledWith(CH, 'channel', CAL);
});

test('evictFromChannel rotates before taking the key copies', async () => {
    mockChannels.set(CH, { isPrivate: true, members: [{ user: ANA }] });
    mockDocs.set(CH, holders(ANA, CAL));
    const order = [];
    epochs.rotate.mockImplementationOnce(async () => { order.push('rotate'); return { status: 'ROTATED', version: 2 }; });
    keys.removeParticipant.mockImplementationOnce(async () => { order.push('remove'); return true; });
    await rooms.evictFromChannel(io, CH, CAL);
    expect(order).toEqual(['rotate', 'remove']);
});
