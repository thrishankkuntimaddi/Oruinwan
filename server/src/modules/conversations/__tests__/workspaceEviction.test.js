'use strict';

/**
 * Leaving or being removed from a workspace (any path: admin removal, leaving, suspension) takes
 * the person's devices out of every channel, DM and workspace room there at once.
 */

jest.mock('../../../shared/postgres', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }) }), { virtual: false });
jest.mock('../../../socket/getIO', () => ({ getIO: jest.fn() }));
jest.mock('../../../features/channels/channel.model.js', () => ({ find: jest.fn() }));
jest.mock('../../../../models/DMSession', () => ({ find: jest.fn() }));
jest.mock('../conversationKeys.service', () => ({ removeParticipant: jest.fn().mockResolvedValue(true) }));

const { getIO } = require('../../../socket/getIO');
const Channel = require('../../../features/channels/channel.model.js');
const DMSession = require('../../../../models/DMSession');
const keys = require('../conversationKeys.service');

const lean = (v) => ({ select: () => ({ lean: async () => v }) });
const WS = 'd'.repeat(24);
const BEN = 'b'.repeat(24);

function fakeIo() {
    const left = [];
    return { left, in: (room) => ({ socketsLeave: (rooms) => left.push([room, rooms]) }) };
}

const flush = () => new Promise((r) => setTimeout(r, 10));

beforeEach(() => {
    jest.clearAllMocks();
    Channel.find.mockReturnValue(lean([{ _id: 'c1' }, { _id: 'c2' }]));
    DMSession.find.mockReturnValue(lean([{ _id: 'd1' }]));
});

test('removeMember: out of every room of the workspace, channel key copies removed', async () => {
    const io = fakeIo();
    getIO.mockReturnValue(io);
    const repo = require('../../../identity/workspaces.repo');
    await repo.removeMember(WS, BEN, { by: 'x' });
    await flush();
    const rooms = io.left.find(([room]) => room === `user:${BEN}`)[1];
    expect(rooms).toEqual(expect.arrayContaining(['channel:c1', 'channel:c2', 'dm:d1', `workspace:${WS}`, `workspace_${WS}`]));
    expect(keys.removeParticipant).toHaveBeenCalledWith('c1', 'channel', BEN);
    expect(DMSession.find).toHaveBeenCalledWith({ workspace: WS, participants: BEN });
});

test('suspending someone (status no longer active) does the same; a role change does not', async () => {
    const io = fakeIo();
    getIO.mockReturnValue(io);
    const repo = require('../../../identity/workspaces.repo');
    await repo.updateMember(WS, BEN, { role: 'admin' });
    await flush();
    expect(io.left).toEqual([]);
    await repo.updateMember(WS, BEN, { status: 'suspended' });
    await flush();
    expect(io.left.length).toBeGreaterThan(0);
});
