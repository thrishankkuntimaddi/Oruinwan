'use strict';

/**
 * The PostgreSQL task service functions ported last: revoke, transfers,
 * timers and integration updates. The repository and identity store are
 * in-memory fakes, so this checks rules and response shapes, not SQL.
 */

const mockTasks = new Map();
const mockPatches = [];

jest.mock('../tasks.repository', () => ({
    findById: jest.fn(async (id) => {
        const t = mockTasks.get(String(id));
        return t ? { ...t, assignedTo: [...t.assignedTo] } : null;
    }),
    update: jest.fn(async (id, patch) => {
        mockPatches.push(patch);
        const t = { ...mockTasks.get(String(id)), ...patch };
        mockTasks.set(String(id), t);
        return { ...t, assignedTo: [...t.assignedTo] };
    }),
    appendActivity: jest.fn(async () => 'act'),
    hydrateForClient: jest.fn(async (list) => list),
    hydrateUsers: jest.fn(async (list) => list),
}));
jest.mock('../../../identity', () => ({
    users: {
        findById: jest.fn(async (id) => ({ _id: String(id), username: `user-${String(id).slice(-1)}` })),
        findManyByIds: jest.fn(async (ids) => new Map(ids.map((id) => [String(id), { _id: String(id), username: `user-${String(id).slice(-1)}` }]))),
    },
    workspaces: { findById: jest.fn() },
}));
jest.mock('../../../../utils/historyLogger', () => ({ logAction: jest.fn().mockResolvedValue() }));
jest.mock('../../../modules/notifications/notificationService', () => new Proxy({}, { get: () => jest.fn().mockResolvedValue() }));
jest.mock('../../../modules/notifications/notificationEventEmitter', () => ({ emit: jest.fn() }));
jest.mock('../../channels/channel.model.js', () => ({}));
jest.mock('../../../modules/messages/message.model.js', () => ({}));

const identity = require('../../../identity');
const repo = require('../tasks.repository');
const { createPgTaskService } = require('../tasks.service.pg');

const oid = (n) => n.toString(16).padStart(24, '0');
const ALICE = oid(1); // creator
const BOB = oid(2);   // assignee
const CAROL = oid(3); // member
const EVE = oid(4);   // not a member
const WS = oid(30);
const TASK = oid(100);

const workspace = {
    _id: WS, name: 'Acme', company: oid(50),
    members: [
        { user: ALICE, role: 'owner', status: 'active' },
        { user: BOB, role: 'member', status: 'active' },
        { user: CAROL, role: 'member', status: 'active' },
    ],
};

const isAdmin = (ws, uid) => ws.members.some((m) => m.user === String(uid) && ['owner', 'admin'].includes(m.role));
const service = createPgTaskService({
    validateWorkspaceMember: jest.fn(),
    getUserChannels: jest.fn(async () => []),
    isWorkspaceAdmin: isAdmin,
    postChannelNotice: jest.fn(),
    assertActiveMembers: jest.fn(),
});

function seed(overrides = {}) {
    const t = {
        _id: TASK, workspace: WS, company: oid(50), title: 'Ship it', createdBy: ALICE, assignedTo: [BOB], watchers: [],
        visibility: 'private', status: 'todo', deleted: false, deletedFor: [], transferRequest: null,
        timeTracking: { totalTime: 0, sessions: [] }, externalLinks: [], ...overrides,
    };
    mockTasks.set(TASK, t);
    return t;
}

function mockIo() {
    const emit = jest.fn();
    return { to: jest.fn(() => ({ emit })), emit };
}

beforeEach(() => {
    mockTasks.clear();
    mockPatches.length = 0;
    jest.clearAllMocks();
    identity.workspaces.findById.mockResolvedValue(workspace);
});

describe('revokeTask (pg)', () => {
    test('creator takes the task back, clears a pending transfer and reopens a done task', async () => {
        seed({ status: 'done', transferRequest: { status: 'pending', requestedBy: BOB, requestedTo: CAROL } });
        const io = mockIo();
        const res = await service.revokeTask(ALICE, TASK, { io });
        expect(mockPatches[0]).toMatchObject({ assignedTo: [ALICE], transferRequest: null, status: 'todo', previousStatus: 'done', completedAt: null });
        expect(res.task.assignedTo).toEqual([ALICE]);
        expect(io.to).toHaveBeenCalledWith(`user_${BOB}`);
        expect(io.emit).toHaveBeenCalledWith('task-removed', { taskId: TASK, reason: 'revoked' });
    });

    test('only the creator may revoke', async () => {
        seed();
        await expect(service.revokeTask(BOB, TASK, {})).rejects.toMatchObject({ statusCode: 403 });
    });
});

describe('transfer requests (pg)', () => {
    test('an assignee asks to hand the task to an active member; the note comes back as reason and note', async () => {
        seed();
        const res = await service.requestTransfer(BOB, TASK, CAROL, '  on leave ', null, null);
        expect(res.transferRequest).toMatchObject({ requestedBy: BOB, requestedTo: CAROL, status: 'pending', reason: 'on leave', note: 'on leave' });
        expect(mockTasks.get(TASK).transferRequest.status).toBe('pending');
    });

    test('rejects non-assignees, self transfers, non-members and existing assignees', async () => {
        seed({ assignedTo: [BOB, CAROL] });
        await expect(service.requestTransfer(ALICE, TASK, CAROL, '', null, null)).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.requestTransfer(BOB, TASK, BOB, '', null, null)).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.requestTransfer(BOB, TASK, EVE, '', null, null)).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.requestTransfer(BOB, TASK, CAROL, '', null, null)).rejects.toMatchObject({ statusCode: 400 });
    });

    test('approve swaps the requester for the target; reject keeps assignees', async () => {
        seed({ transferRequest: { requestedBy: BOB, requestedTo: CAROL, status: 'pending', reason: '' } });
        const io = mockIo();
        const res = await service.handleTransferRequest(ALICE, TASK, 'approve', io, null);
        expect(res.task.assignedTo).toEqual([CAROL]);
        expect(mockTasks.get(TASK).transferRequest.status).toBe('approved');
        expect(io.emit).toHaveBeenCalledWith('task-assigned', expect.objectContaining({ _id: TASK }));

        seed({ transferRequest: { requestedBy: BOB, requestedTo: CAROL, status: 'pending', reason: '' } });
        const rej = await service.handleTransferRequest(ALICE, TASK, 'reject', null, null);
        expect(rej.task.assignedTo).toEqual([BOB]);
        expect(mockTasks.get(TASK).transferRequest.status).toBe('rejected');
    });

    test('only the creator decides, and only on a pending request', async () => {
        seed({ transferRequest: { requestedBy: BOB, requestedTo: CAROL, status: 'pending' } });
        await expect(service.handleTransferRequest(BOB, TASK, 'approve', null, null)).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.handleTransferRequest(ALICE, TASK, 'maybe', null, null)).rejects.toMatchObject({ statusCode: 400 });
        seed({ transferRequest: null });
        await expect(service.handleTransferRequest(ALICE, TASK, 'approve', null, null)).rejects.toMatchObject({ statusCode: 400 });
    });
});

describe('timers (pg)', () => {
    test('start opens one session, stop closes it and adds the elapsed seconds', async () => {
        seed();
        const started = await service.startTimer(BOB, TASK);
        expect(started.timeTracking.sessions).toHaveLength(1);
        await expect(service.startTimer(BOB, TASK)).rejects.toMatchObject({ statusCode: 400 });
        const t = mockTasks.get(TASK);
        t.timeTracking.sessions[0].start = new Date(Date.now() - 5000);
        const stopped = await service.stopTimer(BOB, TASK);
        expect(stopped.elapsed).toBeGreaterThanOrEqual(5);
        expect(stopped.timeTracking.totalTime).toBe(stopped.elapsed);
        expect(stopped.timeTracking.sessions[0].end).toBeInstanceOf(Date);
        await expect(service.stopTimer(BOB, TASK)).rejects.toMatchObject({ statusCode: 400 });
    });

    test('a task the caller cannot see is refused', async () => {
        seed();
        await expect(service.startTimer(CAROL, TASK)).rejects.toMatchObject({ statusCode: 403 });
    });
});

describe('applyExternalUpdate (pg)', () => {
    test('upserts the external link by url and moves status along allowed transitions', async () => {
        seed({ status: 'in_progress', externalLinks: [{ url: 'https://gh/pr/1', state: 'open' }] });
        const res = await service.applyExternalUpdate(TASK, {
            actorId: ALICE, link: { url: 'https://gh/pr/1', provider: 'github', state: 'merged' }, note: 'PR merged', status: 'done',
        }, null);
        expect(res).toMatchObject({ statusChanged: true, from: 'in_progress', to: 'done' });
        expect(mockTasks.get(TASK).externalLinks).toEqual([expect.objectContaining({ url: 'https://gh/pr/1', state: 'merged' })]);
        expect(mockTasks.get(TASK).completedBy).toBe(ALICE);
        expect(repo.appendActivity.mock.calls.map((c) => c[0].action)).toEqual(['integration_event', 'status_changed']);
    });

    test('ignores deleted tasks, blocked targets and onlyFrom mismatches', async () => {
        seed({ deleted: true });
        expect(await service.applyExternalUpdate(TASK, { status: 'done' })).toEqual({ task: null, statusChanged: false });
        seed({ status: 'todo' });
        expect((await service.applyExternalUpdate(TASK, { status: 'blocked' })).statusChanged).toBe(false);
        expect((await service.applyExternalUpdate(TASK, { status: 'in_progress', onlyFrom: ['review'] })).statusChanged).toBe(false);
        expect(repo.update).not.toHaveBeenCalled();
    });
});
