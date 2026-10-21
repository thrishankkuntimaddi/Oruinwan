'use strict';

/**
 * Channels made with the workspace (#general, #random, the wizard's project
 * channel) never count; calls outside any workspace follow the caller's plan.
 */

jest.mock('../../../identity', () => ({ users: { findById: jest.fn() }, workspaces: { findById: jest.fn() } }));
jest.mock('../../../identity/queries/workspaces', () => ({ planWorkspaceCounts: jest.fn(), countSeats: jest.fn(), countPendingEmailInvites: jest.fn() }));
jest.mock('../../../features/channels/channel.model', () => ({ countDocuments: jest.fn(), find: jest.fn() }));
jest.mock('../../../../models/Note', () => ({ countDocuments: jest.fn() }));
jest.mock('../../../features/tasks/tasks.query', () => ({ countDocuments: jest.fn() }));

const identity = require('../../../identity');
const Channel = require('../../../features/channels/channel.model');
const svc = require('../planService');

const at = (s) => new Date(Date.parse('2026-10-01T10:00:00Z') + s * 1000);
const found = (rows) => Channel.find.mockReturnValue({ select: () => ({ lean: async () => rows }) });

beforeEach(() => {
    jest.clearAllMocks();
    svc._clearCache();
    svc.deps.mongoReady = () => true;
    identity.workspaces.findById.mockImplementation(async (id) => ({ _id: id, company: id === 'corp' ? 'c1' : null, members: [] }));
    identity.users.findById.mockImplementation(async (id) => (id === 'boss'
        ? { _id: id, companyId: 'c1', userType: 'company' }
        : { _id: id, companyId: null, userType: 'personal' }));
    found([]);
});

describe('channel count', () => {
    test('channels marked autoCreated are excluded in the query', async () => {
        Channel.countDocuments.mockResolvedValue(4);
        expect(await svc.channelCount('w1')).toBe(4);
        expect(Channel.countDocuments.mock.calls[0][0]).toMatchObject({ workspace: 'w1', autoCreated: { $ne: true }, name: { $nin: ['general', 'random'] } });
    });

    test('older workspaces: the wizard project channel (default, no admins, made with #general) does not count', async () => {
        Channel.countDocuments.mockResolvedValue(10);
        found([
            { name: 'general', createdAt: at(0), createdBy: 'owner' },
            { name: 'launch', createdAt: at(1), createdBy: 'owner' },
        ]);
        expect(await svc.channelCount('w1')).toBe(9);
        await expect(svc.assertCanCreateChannel('w1')).resolves.toBeUndefined();
    });

    test('a default channel made later, or by someone else, still counts', async () => {
        Channel.countDocuments.mockResolvedValue(10);
        found([
            { name: 'general', createdAt: at(0), createdBy: 'owner' },
            { name: 'later', createdAt: at(3600), createdBy: 'owner' },
            { name: 'theirs', createdAt: at(2), createdBy: 'someone' },
        ]);
        expect(await svc.channelCount('w1')).toBe(10);
    });
});

describe('fitChannels', () => {
    test('defaults are free, the rest fill the allowance in order', async () => {
        Channel.countDocuments.mockResolvedValue(9);
        const r = await svc.fitChannels('w1', [{ name: 'general' }, { name: 'a' }, { name: 'b' }, { name: 'random' }]);
        expect(r.allowed.map((c) => c.name)).toEqual(['general', 'a', 'random']);
        expect(r.skipped).toEqual(['b']);
        expect(r.max).toBe(10);
        expect(svc.channelsSkippedMessage(r.skipped, r.max)).toBe('1 channel skipped: free plan allows 10 channels');
    });

    test('company workspaces fit everything', async () => {
        const r = await svc.fitChannels('corp', Array.from({ length: 20 }, (_, i) => ({ name: `c${i}` })));
        expect(r.allowed).toHaveLength(20);
        expect(r.skipped).toEqual([]);
        expect(r.max).toBeNull();
    });
});

describe('call limits', () => {
    test('a call in a workspace follows the workspace', async () => {
        await expect(svc.huddleLimits('w1')).resolves.toMatchObject({ participants: 10, minutes: 30, exempt: false });
        await expect(svc.huddleLimits('corp', { userId: 'u1' })).resolves.toMatchObject({ participants: null, minutes: null, exempt: true });
    });

    test('outside any workspace the caller\'s own plan applies: free -> 10 people / 30 minutes, company account -> none', async () => {
        await expect(svc.huddleLimits(null, { userId: 'u1' })).resolves.toMatchObject({ plan: 'free', participants: 10, minutes: 30 });
        await expect(svc.huddleLimits(null, { userId: 'boss' })).resolves.toMatchObject({ plan: 'company', participants: null, minutes: null });
    });
});
