'use strict';

/**
 * Every free-plan limit, grandfathering (only additions are refused) and the
 * company exemption, with the stores mocked.
 */

jest.mock('../../../identity', () => ({
    users: { findById: jest.fn() },
    workspaces: { findById: jest.fn() },
}));
jest.mock('../../../identity/queries/workspaces', () => ({
    planWorkspaceCounts: jest.fn(), countSeats: jest.fn(), countPendingEmailInvites: jest.fn(),
}));
jest.mock('../../../features/channels/channel.model', () => ({ countDocuments: jest.fn() }));
jest.mock('../../../../models/Note', () => ({ countDocuments: jest.fn(), aggregate: jest.fn() }));
jest.mock('../../../features/tasks/tasks.query', () => ({ countDocuments: jest.fn() }));

const identity = require('../../../identity');
const wsq = require('../../../identity/queries/workspaces');
const Channel = require('../../../features/channels/channel.model');
const Note = require('../../../../models/Note');
const tasksQuery = require('../../../features/tasks/tasks.query');
const svc = require('../planService');

const FREE_USER = { _id: 'u1', companyId: null, userType: 'personal' };
const COMPANY_USER = { _id: 'u2', companyId: 'c1', userType: 'company' };
const FREE_WS = { _id: 'w1', company: null, name: 'Acme', members: [] };
const COMPANY_WS = { _id: 'w2', company: 'c1', name: 'Corp', members: [] };

async function refusal(promise) {
    try { await promise; } catch (err) { return err; }
    return null;
}

beforeEach(() => {
    jest.clearAllMocks();
    svc._clearCache();
    svc.deps.mongoReady = () => true;
    svc.deps.tasksOnPg = () => false;
    identity.users.findById.mockImplementation(async (id) => (id === 'u2' ? COMPANY_USER : { ...FREE_USER, _id: id }));
    identity.workspaces.findById.mockImplementation(async (id) => (id === 'w2' ? COMPANY_WS : { ...FREE_WS, _id: id }));
});

describe('workspaces', () => {
    test('a third created workspace is refused, the second is fine', async () => {
        wsq.planWorkspaceCounts.mockResolvedValue({ owned: 1, joined: 0 });
        await expect(svc.assertCanCreateWorkspace('u1')).resolves.toBeUndefined();
        wsq.planWorkspaceCounts.mockResolvedValue({ owned: 2, joined: 0 });
        const err = await refusal(svc.assertCanCreateWorkspace('u1'));
        expect(err.body).toMatchObject({ code: 'PLAN_LIMIT', limit: 'workspaces.create', max: 2, used: 2, upgradeUrl: '/pricing' });
    });

    test('grandfathered: someone already over the limit keeps everything, only adding is refused', async () => {
        wsq.planWorkspaceCounts.mockResolvedValue({ owned: 5, joined: 4 });
        expect((await refusal(svc.assertCanCreateWorkspace('u1'))).body.used).toBe(5);
        expect((await refusal(svc.assertCanJoinWorkspace('u1', 'w1'))).body).toMatchObject({ limit: 'workspaces.join', used: 4, max: 2 });
    });

    test('a third joined workspace is refused', async () => {
        wsq.planWorkspaceCounts.mockResolvedValue({ owned: 2, joined: 2 });
        expect((await refusal(svc.assertCanJoinWorkspace('u1', 'w1'))).body.limit).toBe('workspaces.join');
        wsq.planWorkspaceCounts.mockResolvedValue({ owned: 2, joined: 1 });
        await expect(svc.assertCanJoinWorkspace('u1', 'w1')).resolves.toBeUndefined();
    });

    test('company accounts and company workspaces are exempt', async () => {
        wsq.planWorkspaceCounts.mockResolvedValue({ owned: 9, joined: 9 });
        await expect(svc.assertCanCreateWorkspace('u2')).resolves.toBeUndefined();
        await expect(svc.assertCanJoinWorkspace('u1', 'w2')).resolves.toBeUndefined();
        expect(wsq.planWorkspaceCounts).not.toHaveBeenCalled();
    });
});

describe('members', () => {
    test('owner + 10 others; pending invites count', async () => {
        wsq.countSeats.mockResolvedValue(8);
        wsq.countPendingEmailInvites.mockResolvedValue(2);
        await expect(svc.assertMemberCapacity('w1', 1)).resolves.toBeUndefined(); // 10 + 1 = 11
        const err = await refusal(svc.assertMemberCapacity('w1', 2));
        expect(err.body).toMatchObject({ limit: 'members.perWorkspace', max: 11, used: 10 });
    });

    test('accepting your own pending invite does not need a new seat', async () => {
        wsq.countSeats.mockResolvedValue(10);
        wsq.countPendingEmailInvites.mockResolvedValue(1);
        await expect(svc.assertMemberCapacity('w1', 1, { inviteHoldsSeat: true })).resolves.toBeUndefined();
        expect((await refusal(svc.assertMemberCapacity('w1', 1))).body.limit).toBe('members.perWorkspace');
    });

    test('company workspaces have no member cap', async () => {
        wsq.countSeats.mockResolvedValue(500);
        wsq.countPendingEmailInvites.mockResolvedValue(0);
        await expect(svc.assertMemberCapacity('w2', 5)).resolves.toBeUndefined();
    });
});

describe('channels', () => {
    test('10 besides #general and #random', async () => {
        Channel.countDocuments.mockResolvedValue(9);
        await expect(svc.assertCanCreateChannel('w1')).resolves.toBeUndefined();
        expect(Channel.countDocuments.mock.calls[0][0]).toMatchObject({ workspace: 'w1', name: { $nin: ['general', 'random'] } });
        Channel.countDocuments.mockResolvedValue(10);
        expect((await refusal(svc.assertCanCreateChannel('w1'))).body).toMatchObject({ limit: 'channels.perWorkspace', max: 10, used: 10 });
        await expect(svc.assertCanCreateChannel('w2')).resolves.toBeUndefined();
    });
});

describe('notes', () => {
    test('template keys from the web and phone pickers', () => {
        expect(svc.templateKeyFor('spec')).toBe('projectspec');
        expect(svc.templateKeyFor('projectspec')).toBe('projectspec');
        expect(svc.templateKeyFor('tech')).toBe('techdesign');
        expect(svc.templateKeyFor('meeting')).toBe('meeting');
        expect(svc.templateKeyFor('blank')).toBeNull();
        expect(svc.templateKeyFor(undefined)).toBeNull();
    });

    test('2 notes per template per person; blank notes are unlimited', async () => {
        Note.countDocuments.mockResolvedValue(1);
        await expect(svc.assertCanCreateNote('w1', 'u1', 'meeting')).resolves.toBeUndefined();
        Note.countDocuments.mockResolvedValue(2);
        expect((await refusal(svc.assertCanCreateNote('w1', 'u1', 'meeting'))).body).toMatchObject({ limit: 'notes.perTemplate', max: 2 });
        expect(Note.countDocuments).toHaveBeenLastCalledWith({ workspace: 'w1', owner: 'u1', templateKey: 'meeting' });
        await expect(svc.assertCanCreateNote('w1', 'u1', null)).resolves.toBeUndefined();
        await expect(svc.assertCanCreateNote('w2', 'u1', 'meeting')).resolves.toBeUndefined();
    });
});

describe('tasks', () => {
    function counts({ workspace = 0, self = 0, mine = 0 }) {
        tasksQuery.countDocuments.mockImplementation(async (f) => {
            if (f.assignedTo) return self;
            if (f.createdBy) return mine;
            return workspace;
        });
    }

    test('300 active per workspace', async () => {
        counts({ workspace: 300 });
        expect((await refusal(svc.assertCanCreateTasks('w1', 'u1', { self: 1, others: 0 }))).body.limit).toBe('tasks.perWorkspace');
        const filter = tasksQuery.countDocuments.mock.calls[0][0];
        expect(filter).toMatchObject({ workspace: 'w1', deleted: { $ne: true }, status: { $nin: ['done', 'cancelled'] } });
    });

    test('30 for yourself, 30 for others; tasks assigned to you are unlimited', async () => {
        counts({ workspace: 100, self: 30, mine: 40 });
        expect((await refusal(svc.assertCanCreateTasks('w1', 'u1', { self: 1, others: 0 }))).body.limit).toBe('tasks.selfCreated');
        await expect(svc.assertCanCreateTasks('w1', 'u1', { self: 0, others: 1 })).resolves.toBeUndefined(); // 10 for others
        counts({ workspace: 100, self: 0, mine: 30 });
        expect((await refusal(svc.assertCanCreateTasks('w1', 'u1', { self: 0, others: 1 }))).body.limit).toBe('tasks.assignedToOthers');
        // Only tasks the person created are counted: no filter by assignee alone.
        expect(tasksQuery.countDocuments.mock.calls.every(([f]) => !f.assignedTo || f.createdBy)).toBe(true);
    });

    test('splitting a task across people counts each new task', () => {
        expect(svc.taskAddsForBody({ assignmentType: 'self' }, 'u1')).toEqual({ self: 1, others: 0 });
        expect(svc.taskAddsForBody({ assignmentType: 'individual', assignedToIds: ['u1', 'a', 'b'] }, 'u1')).toEqual({ self: 1, others: 2 });
        expect(svc.taskAddsForBody({ assignmentType: 'individual', assignedToIds: ['a', 'b'], taskMode: 'shared' }, 'u1')).toEqual({ self: 0, others: 1 });
        expect(svc.taskAddsForBody({ assignmentType: 'individual', assignedToIds: ['u1'] }, 'u1')).toEqual({ self: 1, others: 0 });
        expect(svc.taskAddsForBody({ assignmentType: 'channel' }, 'u1')).toEqual({ self: 0, others: 1 });
    });

    test('company workspaces have no task limits', async () => {
        counts({ workspace: 9999, self: 999, mine: 999 });
        await expect(svc.assertCanCreateTasks('w2', 'u1', { self: 1, others: 1 })).resolves.toBeUndefined();
    });
});

describe('robustness', () => {
    test('without a database connection the check is skipped, not failed closed', async () => {
        svc.deps.mongoReady = () => false;
        await expect(svc.enforce(svc.assertCanCreateChannel('w1'))).resolves.toBeUndefined();
        expect(Channel.countDocuments).not.toHaveBeenCalled();
    });

    test('enforce still passes refusals through', async () => {
        Channel.countDocuments.mockResolvedValue(10);
        await expect(svc.enforce(svc.assertCanCreateChannel('w1'))).rejects.toMatchObject({ code: 'PLAN_LIMIT' });
    });

    test('call limits: 10 people and 30 minutes on free, none for companies', async () => {
        await expect(svc.huddleLimits('w1')).resolves.toMatchObject({ participants: 10, minutes: 30, exempt: false });
        await expect(svc.huddleLimits('w2')).resolves.toMatchObject({ participants: null, minutes: null, exempt: true });
    });
});
