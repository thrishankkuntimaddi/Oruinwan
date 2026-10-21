'use strict';

/**
 * Tasks becoming active again (restore, reopen) or moving from "for myself" to
 * "assigned to others" count against the free plan's task limits; tasks that are
 * already active and stay so are never refused (grandfathering).
 */

jest.mock('../../../identity', () => ({ users: { findById: jest.fn() }, workspaces: { findById: jest.fn() } }));
jest.mock('../../../identity/queries/workspaces', () => ({ planWorkspaceCounts: jest.fn(), countSeats: jest.fn(), countPendingEmailInvites: jest.fn() }));
jest.mock('../../../identity/queries/auth', () => ({ invites: { findByTokenHash: jest.fn() } }));
jest.mock('../../../features/channels/channel.model', () => ({ countDocuments: jest.fn() }));
jest.mock('../../../../models/Note', () => ({ countDocuments: jest.fn() }));
jest.mock('../../../features/tasks/tasks.query', () => ({ countDocuments: jest.fn(), findById: jest.fn() }));

const identity = require('../../../identity');
const tasksQuery = require('../../../features/tasks/tasks.query');
const planService = require('../planService');
const guards = require('../planGuards');

function run(mw, { body = {}, params = {}, userId = 'u1' } = {}) {
    return new Promise((resolve) => {
        const res = {
            statusCode: 200, body: null,
            status(c) { this.statusCode = c; return this; },
            json(b) { this.body = b; resolve({ res: this, passed: false }); return this; },
        };
        mw({ body, params, user: { sub: userId }, app: { get: () => null } }, res, () => resolve({ res, passed: true }));
    });
}

/** countDocuments answers: workspace-wide, "for myself", all mine. */
function counts({ workspace = 0, self = 0, mine = 0 }) {
    tasksQuery.countDocuments.mockImplementation(async (f) => {
        if (f.createdBy && f.assignedTo) return self;
        if (f.createdBy) return mine;
        return workspace;
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    planService._clearCache();
    planService.deps.mongoReady = () => true;
    planService.deps.tasksOnPg = () => false;
    identity.workspaces.findById.mockResolvedValue({ _id: 'w1', company: null, members: [] });
});

describe('taskChangeAdds', () => {
    const mine = { createdBy: 'u1', assignedTo: ['u1'], status: 'todo', deleted: false };
    test('restore and reopen make a task active again', () => {
        expect(planService.taskChangeAdds({ ...mine, deleted: true }, { restore: true })).toEqual({ self: 1, others: 0, workspace: 1 });
        expect(planService.taskChangeAdds({ ...mine, status: 'done' }, { status: 'in-progress' })).toEqual({ self: 1, others: 0, workspace: 1 });
        expect(planService.taskChangeAdds({ ...mine, status: 'cancelled', assignedTo: ['u2'] }, { status: 'todo' })).toEqual({ self: 0, others: 1, workspace: 1 });
    });
    test('a restored task that is done, or a task that stays closed, adds nothing', () => {
        expect(planService.taskChangeAdds({ ...mine, deleted: true, status: 'done' }, { restore: true })).toBeNull();
        expect(planService.taskChangeAdds({ ...mine, status: 'done' }, { status: 'cancelled' })).toBeNull();
    });
    test('reassigning from myself to someone else moves it to "assigned to others"', () => {
        expect(planService.taskChangeAdds(mine, { assignedTo: ['u2'] })).toEqual({ self: 0, others: 1, workspace: 0 });
        expect(planService.taskChangeAdds({ ...mine, assignedTo: ['u2'] }, { assignedTo: ['u3'] })).toBeNull();
        expect(planService.taskChangeAdds({ ...mine, assignedTo: ['u2'] }, { assignedTo: ['u1'] })).toBeNull();
        expect(planService.taskChangeAdds(mine, { status: 'in-progress' })).toBeNull(); // active stays active
    });
});

describe('guards', () => {
    test('POST /:id/restore is refused when the workspace is at 300 active tasks', async () => {
        tasksQuery.findById.mockResolvedValue({ _id: 't1', workspace: 'w1', createdBy: 'u1', assignedTo: ['u1'], status: 'todo', deleted: true });
        counts({ workspace: 300, self: 1, mine: 1 });
        const { res, passed } = await run(guards.taskRestore, { params: { id: 't1' } });
        expect(passed).toBe(false);
        expect(res.body).toMatchObject({ code: 'PLAN_LIMIT', limit: 'tasks.perWorkspace', max: 300, used: 300 });
        counts({ workspace: 12, self: 1, mine: 1 });
        expect((await run(guards.taskRestore, { params: { id: 't1' } })).passed).toBe(true);
    });

    test('reopening a done task counts against the creator\'s own limit', async () => {
        tasksQuery.findById.mockResolvedValue({ _id: 't1', workspace: 'w1', createdBy: { _id: 'u9' }, assignedTo: ['u9'], status: 'done' });
        counts({ workspace: 40, self: 30, mine: 30 });
        const { res } = await run(guards.taskUpdate, { params: { id: 't1' }, body: { status: 'todo' } });
        expect(res.body).toMatchObject({ limit: 'tasks.selfCreated', max: 30 });
        expect(tasksQuery.countDocuments).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'u9' }));
    });

    test('reassigning to someone else is refused at 30 assigned to others; other edits pass', async () => {
        tasksQuery.findById.mockResolvedValue({ _id: 't1', workspace: 'w1', createdBy: 'u1', assignedTo: ['u1'], status: 'todo' });
        counts({ workspace: 299, self: 5, mine: 35 }); // 30 assigned to others
        const refused = await run(guards.taskUpdate, { params: { id: 't1' }, body: { assignedTo: ['u2'] } });
        expect(refused.res.body).toMatchObject({ limit: 'tasks.assignedToOthers', max: 30, used: 30 });
        expect((await run(guards.taskUpdate, { params: { id: 't1' }, body: { title: 'Renamed' } })).passed).toBe(true);
        expect((await run(guards.taskUpdate, { params: { id: 't1' }, body: { status: 'in-progress' } })).passed).toBe(true);
    });

    test('company workspaces and counting problems never block', async () => {
        tasksQuery.findById.mockResolvedValue({ _id: 't1', workspace: 'w2', createdBy: 'u1', assignedTo: ['u1'], status: 'done' });
        identity.workspaces.findById.mockResolvedValue({ _id: 'w2', company: 'c1', members: [] });
        counts({ workspace: 999, self: 999, mine: 999 });
        expect((await run(guards.taskUpdate, { params: { id: 't1' }, body: { status: 'todo' } })).passed).toBe(true);
        identity.workspaces.findById.mockResolvedValue({ _id: 'w1', company: null, members: [] });
        planService._clearCache();
        tasksQuery.countDocuments.mockRejectedValue(new Error('db down'));
        expect((await run(guards.taskUpdate, { params: { id: 't1' }, body: { status: 'todo' } })).passed).toBe(true);
    });
});
