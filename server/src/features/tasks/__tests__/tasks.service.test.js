'use strict';

/**
 * Tasks service: completion bookkeeping, blocked reasons, membership and
 * visibility checks, attachments, channels, transfer / revoke, soft-delete
 * cascade and encrypted channel notices. All models are mocked.
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
jest.mock('../../../../models/User');
jest.mock('../../../../models/Workspace');
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
const TaskActivity = require('../../../../models/TaskActivity');
const User = require('../../../../models/User');
const Workspace = require('../../../../models/Workspace');
const Channel = require('../../channels/channel.model.js');
const Message = require('../../../modules/messages/message.model.js');
const messagesService = require('../../../modules/messages/messages.service');
const { encryptForConversation } = require('../../../modules/conversations/cryptoUtils');

const service = require('../tasks.service');
const validator = require('../tasks.validator');

const oid = (n) => n.toString(16).padStart(24, '0');
const ALICE = oid(1);
const BOB = oid(2);
const CAROL = oid(3); // not a workspace member
const DAVE = oid(4);  // suspended member
const WS = oid(30);
const OTHER_WS = oid(31);
const CH = oid(20);
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

function mockIo() {
    const emit = jest.fn();
    const io = { to: jest.fn(() => ({ emit })), emit };
    io.roomsFor = (event) => io.to.mock.calls
        .filter((_, i) => emit.mock.calls[i] && emit.mock.calls[i][0] === event)
        .flatMap(c => [].concat(c[0]));
    return io;
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

describe('workspace membership errors (A19)', () => {
    it('404s an unknown workspace and 403s a non-member', async () => {
        await expect(service.getTasks(ALICE, { workspaceId: OTHER_WS })).rejects.toMatchObject({ statusCode: 404 });
        await expect(service.getTasks(CAROL, { workspaceId: WS })).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.getTasks(DAVE, { workspaceId: WS })).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.getTasks(ALICE, { workspaceId: 'nope' })).rejects.toMatchObject({ statusCode: 400 });
    });
});

describe('getTasks (B5, contract 3)', () => {
    it('does not filter by company and hides subtasks unless asked', async () => {
        await service.getTasks(ALICE, { workspaceId: WS });
        const q = Task.find.mock.calls[0][0];
        expect(q.company).toBeUndefined();
        expect(q.deleted).toEqual({ $ne: true });
        expect(q.$and).toEqual(expect.arrayContaining([{ parentTask: null }, { type: { $ne: 'subtask' } }]));

        await service.getTasks(ALICE, { workspaceId: WS, includeSubtasks: 'true', includeDeleted: 'true' });
        const q2 = Task.find.mock.calls[1][0];
        expect(q2.deleted).toBeUndefined();
        expect(q2.$and).not.toEqual(expect.arrayContaining([{ parentTask: null }]));
    });

    it('drops deleted subtasks from a live parent', async () => {
        Task.find = jest.fn(() => query([{
            _id: TASK, title: 'p', deleted: false,
            subtasks: [{ _id: oid(5), title: 'a', status: 'todo', assignedTo: [], deleted: false },
                { _id: oid(6), title: 'b', status: 'todo', assignedTo: [], deleted: true }],
        }]));
        const { tasks } = await service.getTasks(ALICE, { workspaceId: WS });
        expect(tasks[0].subtasks).toEqual([{ _id: oid(5), title: 'a', status: 'todo', assignedTo: [] }]);
    });
});

describe('getTask (contract 4)', () => {
    it('returns a visible task and 403s others', async () => {
        const res = await service.getTask(ALICE, TASK);
        expect(res.task._id).toBe(TASK);
        await expect(service.getTask(BOB, TASK)).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.getTask(CAROL, TASK)).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.getTask(ALICE, oid(999))).rejects.toMatchObject({ statusCode: 404 });
    });
});

describe('updateTask completion (A9)', () => {
    it('records completion on → done and clears it on reopen', async () => {
        const res = await service.updateTask(ALICE, TASK, { status: 'done', completionNote: 'shipped' }, null, null);
        expect(res.completed).toBe(true);
        expect(currentTask.status).toBe('done');
        expect(currentTask.previousStatus).toBe('todo');
        expect(String(currentTask.completedBy)).toBe(ALICE);
        expect(currentTask.completedAt).toBeInstanceOf(Date);
        expect(currentTask.completionNote).toBe('shipped');

        await service.updateTask(ALICE, TASK, { status: 'in_progress' }, null, null);
        expect(currentTask.completedAt).toBeNull();
        expect(currentTask.completedBy).toBeNull();
        expect(currentTask.completionNote).toBe('');
    });

    it('rejects transitions the workflow does not allow', async () => {
        currentTask.status = 'cancelled';
        await expect(service.updateTask(ALICE, TASK, { status: 'done' }, null, null))
            .rejects.toMatchObject({ statusCode: 400, allowedTransitions: ['backlog', 'todo'] });
    });
});

describe('blocked status (contract 5)', () => {
    it('requires and stores a reason, and clears it when unblocked', async () => {
        await expect(service.updateTask(ALICE, TASK, { status: 'blocked' }, null, null)).rejects.toMatchObject({ statusCode: 400 });

        await service.updateTask(ALICE, TASK, { status: 'blocked', blockedReason: ' waiting on API ' }, null, null);
        expect(currentTask.blockedReason).toBe('waiting on API');
        expect(String(currentTask.blockedBy)).toBe(ALICE);
        expect(currentTask.blockedAt).toBeInstanceOf(Date);

        await service.updateTask(ALICE, TASK, { status: 'todo' }, null, null);
        expect(currentTask.blockedReason).toBeNull();
        expect(currentTask.blockedBy).toBeNull();
        expect(currentTask.blockedAt).toBeNull();
        expect(TaskActivity.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'unblocked', from: 'blocked' }));
    });
});

describe('assignees must be active members (B2)', () => {
    it('rejects non-members and suspended members on update', async () => {
        await expect(service.updateTask(ALICE, TASK, { assignedTo: [BOB, CAROL] }, null, null)).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.updateTask(ALICE, TASK, { assignedTo: [DAVE] }, null, null)).rejects.toMatchObject({ statusCode: 400 });
        await service.updateTask(ALICE, TASK, { assignedTo: [BOB] }, null, null);
        expect(currentTask.assignedTo).toEqual([BOB]);
    });

    it('rejects a transfer to a non-member', async () => {
        currentTask.assignedTo = [BOB];
        await expect(service.requestTransfer(BOB, TASK, CAROL, 'pls', null, null)).rejects.toMatchObject({ statusCode: 400 });
    });
});

describe('attachments and description (A8, A19)', () => {
    it('persists attachments on update and treats description null as empty', async () => {
        await service.updateTask(ALICE, TASK, {
            attachments: [{ name: 'spec.pdf', url: 'https://files.example.com/spec.pdf' }],
            description: null,
        }, null, null);
        expect(currentTask.attachments).toEqual([expect.objectContaining({ name: 'spec.pdf', url: 'https://files.example.com/spec.pdf', uploadedBy: ALICE })]);
        expect(currentTask.description).toBe('');
    });

    it('validates attachments', () => {
        expect(validator.validateUpdateTask({ description: null }).valid).toBe(true);
        expect(validator.validateUpdateTask({ attachments: [{ name: 'x', url: 'javascript:alert(1)' }] }).valid).toBe(false);
        expect(validator.validateUpdateTask({ attachments: [{ name: 'x'.repeat(201), url: 'https://a.b' }] }).valid).toBe(false);
        expect(validator.validateCreateTask({ title: 't', workspaceId: WS,
            attachments: Array.from({ length: 21 }, () => ({ name: 'a', url: 'https://a.b' })) }).valid).toBe(false);
        expect(validator.validateCreateTask({ title: 't', workspaceId: WS, attachments: [{ name: 'a', url: 'http://a.b/c' }] }).valid).toBe(true);
    });
});

describe('createTask channel + attachments (A7, A8, contract 1)', () => {
    beforeEach(() => {
        Channel.findById = jest.fn((id) => query(String(id) === CH
            ? { _id: CH, workspace: WS, isPrivate: true, members: [{ user: ALICE }, { user: BOB }], isMember: (u) => [ALICE, BOB].includes(String(u)) }
            : { _id: id, workspace: OTHER_WS, members: [], isMember: () => true }));
    });

    it('stores channelId and attachments for a self task', async () => {
        const io = mockIo();
        await service.createTask(ALICE, {
            workspaceId: WS, title: 'Mine', assignmentType: 'self', channelId: CH,
            attachments: [{ name: 'a.png', url: 'https://x.y/a.png' }],
        }, io, null);
        const t = global.__createdTasks[0];
        expect(String(t.channel)).toBe(CH);
        expect(t.visibility).toBe('private');
        expect(t.issueKey).toBe('ACME-1');
        expect(t.attachments).toEqual([expect.objectContaining({ name: 'a.png', url: 'https://x.y/a.png' })]);
        // private task: not announced into the channel room
        expect(io.roomsFor('task-created')).not.toContain(`channel:${CH}`);
        expect(io.roomsFor('task-created')).toContain(`user_${ALICE}`);
    });

    it('stores channelId for split individual tasks', async () => {
        await service.createTask(ALICE, {
            workspaceId: WS, title: 'Split', assignmentType: 'individual', assignedToIds: [ALICE, BOB], channelId: CH,
        }, null, null);
        expect(global.__createdTasks).toHaveLength(2);
        global.__createdTasks.forEach(t => expect(String(t.channel)).toBe(CH));
    });

    it('rejects a channel from another workspace, an inaccessible channel and non-member assignees', async () => {
        await expect(service.createTask(ALICE, { workspaceId: WS, title: 'x', channelId: oid(21) }, null, null))
            .rejects.toMatchObject({ statusCode: 400 });
        Workspace.findById = jest.fn(() => query({ ...workspaceDoc(), members: [...workspaceDoc().members, { user: CAROL, status: 'active' }] }));
        await expect(service.createTask(CAROL, { workspaceId: WS, title: 'x', channelId: CH }, null, null))
            .rejects.toMatchObject({ statusCode: 403 });
        Workspace.findById = jest.fn(() => query(workspaceDoc()));
        await expect(service.createTask(ALICE, { workspaceId: WS, title: 'x', assignmentType: 'individual', assignedToIds: [CAROL] }, null, null))
            .rejects.toMatchObject({ statusCode: 400 });
    });
});

describe('channel notices are never plaintext (B7)', () => {
    beforeEach(() => {
        Channel.findById = jest.fn(() => query({ _id: CH, workspace: WS, isPrivate: false, members: [{ user: ALICE }, { user: BOB }], isMember: () => true }));
    });

    it('posts an encrypted notice when the channel key is available', async () => {
        encryptForConversation.mockResolvedValue({ ciphertext: 'Y2lwaGVy', messageIv: 'aXY=' });
        await service.createTask(ALICE, { workspaceId: WS, title: 'Team', assignmentType: 'channel', channelId: CH }, null, null);
        expect(encryptForConversation).toHaveBeenCalledWith(CH, 'channel', expect.stringContaining('Team'));
        expect(messagesService.createMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'message', channel: CH, ciphertext: 'Y2lwaGVy', messageIv: 'aXY=',
        }), null);
        const arg = messagesService.createMessage.mock.calls[0][0];
        expect(arg.text).toBeUndefined();
    });

    it('posts nothing when encryption is unavailable', async () => {
        encryptForConversation.mockRejectedValue(new Error('no key'));
        await service.createTask(ALICE, { workspaceId: WS, title: 'Team', assignmentType: 'channel', channelId: CH }, null, null);
        expect(messagesService.createMessage).not.toHaveBeenCalled();
        expect(Message).not.toHaveBeenCalled();
    });
});

describe('socket fan-out (A10, contract 7)', () => {
    it('sends task-updated to creator, assignees and watchers of a private task', async () => {
        currentTask.assignedTo = [BOB];
        currentTask.watchers = [DAVE];
        const io = mockIo();
        await service.updateTask(BOB, TASK, { status: 'in_progress' }, io, null);
        const rooms = io.roomsFor('task-updated');
        expect(rooms).toEqual(expect.arrayContaining([`user_${ALICE}`, `user_${BOB}`, `user_${DAVE}`]));
    });
});

describe('watchers / timers / links / dependencies need visibility (B1)', () => {
    it('refuses a non-party on a private task and allows a party', async () => {
        await expect(service.addWatcher(BOB, TASK)).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.startTimer(BOB, TASK)).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.stopTimer(BOB, TASK)).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.addDependency(BOB, TASK, oid(101))).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.addLink(BOB, TASK, { linkedTaskId: oid(101), linkType: 'relates_to' })).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.addWatcher(CAROL, TASK)).rejects.toMatchObject({ statusCode: 403 });

        currentTask.visibility = 'workspace';
        await service.addWatcher(BOB, TASK);
        expect(currentTask.watchers).toContain(BOB);
    });

    it('does not let an existing watcher see a private task', async () => {
        currentTask.watchers = [BOB];
        await expect(service.getTaskActivity(BOB, TASK)).rejects.toMatchObject({ statusCode: 403 });
    });
});

describe('transfer and revoke (A16)', () => {
    it('stores the note as reason and returns it', async () => {
        currentTask.assignedTo = [BOB];
        const res = await service.requestTransfer(BOB, TASK, ALICE, 'on leave', null, null);
        expect(currentTask.transferRequest).toMatchObject({ status: 'pending', reason: 'on leave' });
        expect(res.transferRequest).toMatchObject({ reason: 'on leave', note: 'on leave' });
    });

    it('revoke clears a pending transfer and reopens done tasks', async () => {
        currentTask.assignedTo = [BOB];
        currentTask.status = 'done';
        currentTask.completedAt = new Date();
        currentTask.transferRequest = { status: 'pending', requestedBy: BOB, requestedTo: ALICE, reason: 'x' };
        await service.revokeTask(ALICE, TASK, { io: null });
        expect(currentTask.transferRequest).toBeUndefined();
        expect(currentTask.assignedTo).toEqual([ALICE]);
        expect(currentTask.status).toBe('todo');
        expect(currentTask.completedAt).toBeNull();
        expect(currentTask.revokedBy).toBe(ALICE);
    });
});

describe('delete / restore / permanent delete (B6, contract 6)', () => {
    it('soft delete cascades to subtasks and emits task-deleted', async () => {
        const io = mockIo();
        await service.deleteTask(ALICE, TASK, io, null);
        expect(currentTask.deleted).toBe(true);
        expect(Task.updateMany).toHaveBeenCalledWith(
            { parentTask: TASK, deleted: { $ne: true } },
            { $set: expect.objectContaining({ deleted: true, deletedAt: currentTask.deletedAt }) }
        );
        const i = io.emit.mock.calls.findIndex(c => c[0] === 'task-deleted');
        expect(io.emit.mock.calls[i][1]).toEqual({ taskId: TASK, deleted: true });
    });

    it('restore brings back the subtasks deleted with the parent and emits task-restored', async () => {
        const when = new Date('2026-09-01');
        currentTask.deleted = true;
        currentTask.deletedAt = when;
        const io = mockIo();
        const res = await service.restoreTask(ALICE, TASK, { io });
        expect(currentTask.deleted).toBe(false);
        expect(Task.updateMany).toHaveBeenCalledWith(
            { parentTask: TASK, deleted: true, deletedAt: when },
            { $set: { deleted: false, deletedAt: null, deletedBy: null } }
        );
        expect(res.task._id).toBe(TASK);
        expect(io.emit).toHaveBeenCalledWith('task-restored', { task: expect.objectContaining({ _id: TASK }) });
    });

    it('permanent delete removes subtasks and dangling references', async () => {
        Task.find = jest.fn(() => query([oid(5)]));
        const io = mockIo();
        await service.permanentDeleteTask(ALICE, TASK, { io });
        expect(Task.deleteMany).toHaveBeenCalledWith({ _id: { $in: [TASK, oid(5)] } });
        const [, update] = Task.updateMany.mock.calls[0];
        expect(update.$pull).toEqual({
            subtasks: { $in: [TASK, oid(5)] },
            dependencies: { $in: [TASK, oid(5)] },
            linkedIssues: { task: { $in: [TASK, oid(5)] } },
        });
        expect(io.emit).toHaveBeenCalledWith('task-deleted', { taskId: TASK, permanent: true });
    });

    it('only the creator or a workspace admin may delete', async () => {
        currentTask.assignedTo = [BOB];
        await expect(service.deleteTask(BOB, TASK, null, null)).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.deleteTask(CAROL, TASK, null, null)).rejects.toMatchObject({ statusCode: 403 });
        currentTask.status = 'done';
        await service.deleteTask(BOB, TASK, null, null); // assignee hides a completed task
        expect(currentTask.deleted).toBe(false);
        expect(currentTask.deletedFor).toContain(BOB);
    });
});

describe('workload (B4)', () => {
    it('counts only open tasks visible to the caller', async () => {
        await service.getWorkload(BOB, WS);
        const [match] = Task.aggregate.mock.calls[0][0];
        expect(match.$match.status).toEqual({ $nin: ['done', 'cancelled'] });
        expect(match.$match.deleted).toEqual({ $ne: true });
        expect(match.$match.$and[0].$or).toHaveLength(4);
    });
});
