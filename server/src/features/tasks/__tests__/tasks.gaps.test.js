'use strict';

/**
 * Tasks gaps: dependency blocking, milestone links, recurrence on create/update,
 * per-user time tracking and workload estimated hours. All models are mocked
 * (prelude shared with tasks.service.test.js).
 */

jest.mock('../../../../models/Task', () => {
    const Task = jest.fn(function (data) {
        Object.assign(this, { _id: global.__nextTaskId || 'ffffffffffffffffffffffff', watchers: [], linkedIssues: [], subtasks: [], ...data });
        this.save = jest.fn().mockResolvedValue(this);
        global.__createdTasks = global.__createdTasks || [];
        global.__createdTasks.push(this);
    });
    Task.findById = jest.fn();
    Task.find = jest.fn();
    Task.updateMany = jest.fn().mockResolvedValue({});
    Task.deleteMany = jest.fn().mockResolvedValue({});
    Task.aggregate = jest.fn().mockResolvedValue([]);
    return Task;
});
jest.mock('../../../../models/TaskActivity', () => ({
    create: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({}),
    find: jest.fn(),
    countDocuments: jest.fn().mockResolvedValue(0),
}));
// Users and workspaces live in the PostgreSQL identity store; membership and
// member lists are derived from whatever `workspaces.findById` returns.
jest.mock('../../../identity', () => {
    const api = {
        users: {
            findById: jest.fn(),
            findManyByIds: jest.fn(async () => new Map()),
        },
        workspaces: {
            findById: jest.fn(),
            findManyByIds: jest.fn(async () => []),
        },
    };
    const activeMember = (ws, uid) => (ws?.members || []).find((m) => String(m.user) === String(uid) && (m.status || 'active') === 'active') || null;
    api.workspaces.membership = jest.fn(async (wsId, uid) => {
        const ws = await api.workspaces.findById(wsId);
        if (!ws) return null;
        const member = activeMember(ws, uid);
        return { workspace: ws, member, role: member ? member.role : null, isAdmin: !!member && ['owner', 'admin'].includes(member.role) };
    });
    api.workspaces.listMembers = jest.fn(async (wsId) => {
        const ws = await api.workspaces.findById(wsId);
        return (ws?.members || []).filter((m) => (m.status || 'active') === 'active');
    });
    return api;
});
jest.mock('../../channels/channel.model.js');
jest.mock('../../../modules/messages/message.model.js');
jest.mock('../issue-key-counter.model', () => ({ nextKey: jest.fn().mockResolvedValue('ACME-1') }));
jest.mock('../../../../utils/historyLogger', () => ({ logAction: jest.fn().mockResolvedValue() }));
jest.mock('../../../modules/notifications/notificationEventEmitter', () => ({ emit: jest.fn() }));
jest.mock('../../../modules/notifications/notificationService', () => new Proxy({}, {
    get: () => jest.fn().mockResolvedValue(),
}));
jest.mock('../../../modules/messages/messages.service', () => ({ createMessage: jest.fn().mockResolvedValue({ _id: 'm1' }) }));
jest.mock('../../../modules/conversations/cryptoUtils', () => ({ encryptForConversation: jest.fn() }));

const Task = require('../../../../models/Task');
const identity = require('../../../identity');
// Same names the tests always used; they now stand for the identity repositories.
const User = identity.users;
const Workspace = identity.workspaces;
const Channel = require('../../channels/channel.model.js');
const Message = require('../../../modules/messages/message.model.js');
const { encryptForConversation } = require('../../../modules/conversations/cryptoUtils');

const service = require('../tasks.service');
const validator = require('../tasks.validator');

const oid = (n) => n.toString(16).padStart(24, '0');
const ALICE = oid(1);
const BOB = oid(2);
const DAVE = oid(4);  // suspended member
const WS = oid(30);
const OTHER_WS = oid(31);
const TASK = oid(100);

function query(value) {
    const q = {
        select: jest.fn(() => q),
        populate: jest.fn(() => q),
        lean: jest.fn(() => q),
        sort: jest.fn(() => q),
        limit: jest.fn(() => q),
        skip: jest.fn(() => q),
        distinct: jest.fn(() => Promise.resolve(Array.isArray(value) ? value : [])),
        then: (res, rej) => Promise.resolve(value).then(res, rej),
    };
    return q;
}

function workspaceDoc() {
    return {
        _id: WS,
        name: 'Acme',
        company: oid(50),
        members: [
            { user: ALICE, role: 'owner', status: 'active' },
            { user: BOB, role: 'member', status: 'active' },
            { user: DAVE, role: 'member', status: 'suspended' },
        ],
    };
}

function makeTask(overrides = {}) {
    const t = {
        _id: TASK,
        workspace: WS,
        company: oid(50),
        title: 'Write docs',
        createdBy: ALICE,
        assignedTo: [ALICE],
        watchers: [],
        visibility: 'private',
        channel: null,
        status: 'todo',
        deleted: false,
        deletedFor: [],
        linkedIssues: [],
        dependencies: [],
        subtasks: [],
        attachments: [],
        timeTracking: { totalTime: 0, sessions: [] },
        transferRequest: undefined,
        ...overrides,
    };
    t.isCreator = (u) => String(t.createdBy) === String(u);
    t.isAssignee = (u) => t.assignedTo.some(a => String(a) === String(u));
    t.save = jest.fn().mockResolvedValue(t);
    return t;
}


let currentTask;

beforeEach(() => {
    jest.clearAllMocks();
    global.__createdTasks = [];
    currentTask = makeTask();
    Task.findById = jest.fn((id) => query(String(id) === TASK ? currentTask : null));
    Task.find = jest.fn(() => query([]));
    Workspace.findById = jest.fn((id) => query(String(id) === WS ? workspaceDoc() : null));
    User.findById = jest.fn((id) => query({ _id: id, username: 'user', companyId: oid(50) }));
    User.find = jest.fn(() => query([]));
    Channel.find = jest.fn(() => query([]));
    Channel.findById = jest.fn(() => query(null));
    Message.updateMany = jest.fn().mockResolvedValue({});
    encryptForConversation.mockReset();
});


jest.mock('../../../../models/Milestone', () => ({ findById: jest.fn() }));
const Milestone = require('../../../../models/Milestone');

const MS = oid(70);
const OTHER_MS = oid(71);
const BLOCKER = oid(101);

describe('dependency blocking on completion', () => {
    it('refuses done while a dependency is open, allows it with ignoreBlockers', async () => {
        currentTask.dependencies = [BLOCKER];
        Task.find = jest.fn(() => query([{ _id: BLOCKER, title: 'Design', status: 'in_progress', deleted: false }]));
        await expect(service.updateTask(ALICE, TASK, { status: 'done' }, null, null))
            .rejects.toMatchObject({ statusCode: 409, code: 'TASK_BLOCKED', blockers: [expect.objectContaining({ _id: BLOCKER, status: 'in_progress' })] });
        expect(currentTask.status).toBe('todo');

        const res = await service.updateTask(ALICE, TASK, { status: 'done', ignoreBlockers: true }, null, null);
        expect(res.completed).toBe(true);
        expect(currentTask.status).toBe('done');
    });

    it('counts is_blocked_by links and ignores closed or deleted blockers', async () => {
        currentTask.linkedIssues = [{ task: BLOCKER, linkType: 'is_blocked_by' }, { task: oid(102), linkType: 'relates_to' }];
        Task.find = jest.fn(() => query([{ _id: BLOCKER, title: 'x', status: 'done' }]));
        await service.updateTask(ALICE, TASK, { status: 'done' }, null, null);
        expect(Task.find.mock.calls[0][0]).toEqual({ _id: { $in: [BLOCKER] } });
        expect(currentTask.status).toBe('done');
    });

    it('lists open blockers and removes a dependency', async () => {
        currentTask.dependencies = [BLOCKER];
        Task.find = jest.fn(() => query([{ _id: BLOCKER, title: 'Design', status: 'todo' }]));
        const out = await service.getBlockers(ALICE, TASK);
        expect(out.blocked).toBe(true);
        const removed = await service.removeDependency(ALICE, TASK, BLOCKER);
        expect(removed.dependencies).toEqual([]);
        await expect(service.removeDependency(ALICE, TASK, 'nope')).rejects.toMatchObject({ statusCode: 400 });
    });
});

describe('milestone linking', () => {
    beforeEach(() => {
        Milestone.findById.mockImplementation((id) => query(
            String(id) === MS ? { _id: MS, workspace: WS, deleted: false }
                : String(id) === OTHER_MS ? { _id: OTHER_MS, workspace: OTHER_WS, deleted: false } : null));
    });

    it('links, rejects foreign or unknown milestones and unlinks with null', async () => {
        await service.updateTask(ALICE, TASK, { milestoneId: MS }, null, null);
        expect(currentTask.milestoneId).toBe(MS);
        await expect(service.updateTask(ALICE, TASK, { milestoneId: OTHER_MS }, null, null)).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.updateTask(ALICE, TASK, { milestoneId: oid(72) }, null, null)).rejects.toMatchObject({ statusCode: 400 });
        await service.updateTask(ALICE, TASK, { milestoneId: null }, null, null);
        expect(currentTask.milestoneId).toBeNull();
    });

    it('needs edit rights (creator or manager)', async () => {
        currentTask.createdBy = BOB;
        currentTask.assignedTo = [ALICE, BOB];
        currentTask.isCreator = (u) => String(u) === BOB;
        // ALICE is the workspace owner (manager): allowed. A plain assignee is not.
        await service.updateTask(ALICE, TASK, { milestoneId: MS }, null, null);
        currentTask.createdBy = ALICE;
        currentTask.isCreator = (u) => String(u) === ALICE;
        await expect(service.updateTask(BOB, TASK, { milestoneId: null }, null, null)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('accepts milestone, estimate and recurrence on create', async () => {
        await service.createTask(ALICE, {
            workspaceId: WS, title: 'Weekly sync notes', milestoneId: MS, estimatedHours: 3,
            dueDate: '2026-11-02T09:00:00.000Z', recurring: { pattern: 'weekly', daysOfWeek: [1, 3] },
        }, null, null);
        const created = global.__createdTasks[0];
        expect(created.milestoneId).toBe(MS);
        expect(created.estimatedHours).toBe(3);
        expect(created.recurring).toMatchObject({ isRecurring: true, pattern: 'weekly', daysOfWeek: [1, 3] });
        // The task is the Monday occurrence; the generator starts with Wednesday.
        expect(created.recurring.nextDue.toISOString()).toBe('2026-11-04T09:00:00.000Z');
    });

    it('rejects a bad recurrence rule', async () => {
        await expect(service.createTask(ALICE, { workspaceId: WS, title: 'x', recurring: { pattern: 'hourly' } }, null, null))
            .rejects.toMatchObject({ statusCode: 400 });
        await expect(service.updateTask(ALICE, TASK, { recurring: { pattern: 'daily', interval: 0 } }, null, null))
            .rejects.toMatchObject({ statusCode: 400 });
    });

    it('turns recurrence on and off on update', async () => {
        currentTask.dueDate = new Date('2026-11-01T10:00:00.000Z');
        await service.updateTask(ALICE, TASK, { recurring: { pattern: 'monthly' } }, null, null);
        expect(currentTask.recurring).toMatchObject({ isRecurring: true, pattern: 'monthly', dayOfMonth: 1 });
        expect(currentTask.recurring.nextDue.toISOString()).toBe('2026-12-01T10:00:00.000Z');
        await service.updateTask(ALICE, TASK, { recurring: null }, null, null);
        expect(currentTask.recurring.isRecurring).toBe(false);
    });
});

describe('per-user time tracking', () => {
    it('runs one timer per user and reports totals per user', async () => {
        currentTask.visibility = 'workspace';
        await service.startTimer(ALICE, TASK);
        await service.startTimer(BOB, TASK); // a second user can run their own timer
        await expect(service.startTimer(BOB, TASK)).rejects.toMatchObject({ statusCode: 400 });

        currentTask.timeTracking.sessions.forEach((s) => { s.start = new Date(Date.now() - 60000); });
        const stopped = await service.stopTimer(BOB, TASK);
        expect(stopped.elapsed).toBeGreaterThanOrEqual(60);
        const bobSession = currentTask.timeTracking.sessions.find((s) => s.user === BOB);
        const aliceSession = currentTask.timeTracking.sessions.find((s) => s.user === ALICE);
        expect(bobSession.end).toBeInstanceOf(Date);
        expect(aliceSession.end).toBeNull(); // Alice's timer keeps running

        await service.logTime(ALICE, TASK, { minutes: 30, note: 'review' });
        const t = await service.getTaskTime(ALICE, TASK);
        const alice = t.byUser.find((r) => r.userId === ALICE);
        const bob = t.byUser.find((r) => r.userId === BOB);
        expect(alice).toMatchObject({ running: true, sessions: 2 });
        expect(alice.seconds).toBeGreaterThanOrEqual(1800 + 60);
        expect(bob).toMatchObject({ running: false, sessions: 1 });
        expect(t.totalSeconds).toBe(currentTask.timeTracking.totalTime);
    });

    it('rejects invalid manual entries', async () => {
        await expect(service.logTime(ALICE, TASK, { minutes: 0 })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.logTime(ALICE, TASK, { seconds: 90000 })).rejects.toMatchObject({ statusCode: 400 });
    });

    it('builds a workspace time report from visible tasks', async () => {
        const start = new Date('2026-10-01T10:00:00Z');
        Task.find = jest.fn(() => query([
            { _id: oid(110), title: 'A', timeTracking: { sessions: [
                { start, end: new Date(start.getTime() + 3600000), user: ALICE },
                { start, end: new Date(start.getTime() + 600000), user: BOB },
            ] } },
            { _id: oid(111), title: 'B', timeTracking: { sessions: [
                { start: new Date('2026-09-01T10:00:00Z'), end: new Date('2026-09-01T11:00:00Z'), user: BOB },
            ] } },
        ]));
        const r = await service.getTimeReport(ALICE, WS, { from: '2026-09-15' });
        expect(r.byUser.map((u) => [u.userId, u.seconds])).toEqual([[ALICE, 3600], [BOB, 600]]);
        expect(r.byTask).toHaveLength(1);
        expect(Task.find.mock.calls[0][0]['timeTracking.sessions.0']).toEqual({ $exists: true });
        await expect(service.getTimeReport(ALICE, WS, { from: 'nope' })).rejects.toMatchObject({ statusCode: 400 });
    });
});

describe('workload includes estimated hours', () => {
    it('sums estimates per assignee and counts unestimated tasks', async () => {
        Task.aggregate.mockResolvedValueOnce([{ _id: ALICE, count: 3, estimatedHours: 7.5, unestimated: 1 }]);
        const { workload } = await service.getWorkload(ALICE, WS);
        expect(workload[0]).toMatchObject({ count: 3, estimatedHours: 7.5, unestimated: 1 });
        const group = Task.aggregate.mock.calls[0][0].find((s) => s.$group).$group;
        expect(group.estimatedHours).toEqual({ $sum: { $ifNull: ['$estimatedHours', 0] } });
    });
});

describe('validator: planning fields', () => {
    it('checks milestoneId, recurring and ignoreBlockers shapes', () => {
        expect(validator.validateUpdateTask({ milestoneId: 'x' }).valid).toBe(false);
        expect(validator.validateUpdateTask({ milestoneId: null }).valid).toBe(true);
        expect(validator.validateUpdateTask({ recurring: 'daily' }).valid).toBe(false);
        expect(validator.validateUpdateTask({ ignoreBlockers: 'yes' }).valid).toBe(false);
        expect(validator.validateCreateTask({ title: 't', workspaceId: WS, startDate: 'bad' }).valid).toBe(false);
    });
});

jest.mock('../../../../models/Sprint', () => ({ findById: jest.fn() }));
const Sprint = require('../../../../models/Sprint');

describe('sprint assignment and the web recurrence shape', () => {
    const SPRINT = oid(80);
    beforeEach(() => {
        Sprint.findById.mockImplementation((id) => query(String(id) === SPRINT ? { _id: SPRINT, workspace: WS, deleted: false } : null));
    });

    it('saves sprintId on create and update (it used to be ignored)', async () => {
        await service.createTask(ALICE, { workspaceId: WS, title: 'x', sprintId: SPRINT }, null, null);
        expect(global.__createdTasks[0].sprintId).toBe(SPRINT);
        await service.updateTask(ALICE, TASK, { sprintId: SPRINT }, null, null);
        expect(currentTask.sprintId).toBe(SPRINT);
        await expect(service.updateTask(ALICE, TASK, { sprintId: oid(81) }, null, null)).rejects.toMatchObject({ statusCode: 400 });
        await service.updateTask(ALICE, TASK, { sprintId: null }, null, null);
        expect(currentTask.sprintId).toBeNull();
    });

    it('accepts what the web picker sends (date-only end date covers that day)', async () => {
        await service.updateTask(ALICE, TASK, {
            recurring: { isRecurring: true, pattern: 'weekly', interval: 2, daysOfWeek: [1], endDate: '2026-11-16', nextDue: '2026-11-02T00:00:00.000Z' },
        }, null, null);
        expect(currentTask.recurring).toMatchObject({ pattern: 'weekly', interval: 2, daysOfWeek: [1] });
        expect(currentTask.recurring.endDate.toISOString()).toBe('2026-11-16T23:59:59.999Z');
        expect(currentTask.recurring.nextDue.toISOString()).toBe('2026-11-02T00:00:00.000Z');
        await service.updateTask(ALICE, TASK, { recurring: { isRecurring: false, pattern: null, interval: 1, daysOfWeek: [], endDate: null, nextDue: null } }, null, null);
        expect(currentTask.recurring.isRecurring).toBe(false);
    });
});
