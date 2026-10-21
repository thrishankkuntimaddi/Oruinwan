'use strict';

/** The route guards: 403 PLAN_LIMIT before the controller runs, the inviter told when an invitee is over their limit. */

jest.mock('../../../identity', () => ({
    users: { findById: jest.fn() },
    workspaces: { findById: jest.fn() },
}));
jest.mock('../../../identity/queries/workspaces', () => ({
    planWorkspaceCounts: jest.fn(), countSeats: jest.fn(), countPendingEmailInvites: jest.fn(),
}));
jest.mock('../../../identity/queries/auth', () => ({ invites: { findByTokenHash: jest.fn() } }));
jest.mock('../../../features/channels/channel.model', () => ({ countDocuments: jest.fn() }));
jest.mock('../../../../models/Note', () => ({ countDocuments: jest.fn() }));
jest.mock('../../../features/tasks/tasks.query', () => ({ countDocuments: jest.fn(), findById: jest.fn() }));
jest.mock('../../../modules/notifications/notificationService', () => ({ create: jest.fn(async () => ({})) }));

const identity = require('../../../identity');
const wsq = require('../../../identity/queries/workspaces');
const { invites } = require('../../../identity/queries/auth');
const Channel = require('../../../features/channels/channel.model');
const Note = require('../../../../models/Note');
const tasksQuery = require('../../../features/tasks/tasks.query');
const notifications = require('../../../modules/notifications/notificationService');
const planService = require('../planService');
const guards = require('../planGuards');

function run(mw, { body = {}, params = {}, userId = 'u1', io = null } = {}) {
    return new Promise((resolve) => {
        const res = {
            statusCode: 200, body: null,
            status(c) { this.statusCode = c; return this; },
            json(b) { this.body = b; resolve({ res: this, passed: false }); return this; },
        };
        const req = { body, params, user: { sub: userId }, app: { get: () => io } };
        mw(req, res, () => resolve({ res, passed: true }));
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    planService._clearCache();
    planService.deps.mongoReady = () => true;
    planService.deps.tasksOnPg = () => false;
    identity.users.findById.mockImplementation(async (id) => ({ _id: id, username: id === 'u1' ? 'Sam' : 'Inviter', companyId: null }));
    identity.workspaces.findById.mockResolvedValue({ _id: 'w1', name: 'Acme', company: null, members: [{ user: 'owner', status: 'active', role: 'owner' }] });
    wsq.countSeats.mockResolvedValue(1);
    wsq.countPendingEmailInvites.mockResolvedValue(0);
});

test('creating a third workspace answers 403 PLAN_LIMIT', async () => {
    wsq.planWorkspaceCounts.mockResolvedValue({ owned: 2, joined: 0 });
    const { res, passed } = await run(guards.workspaceCreate);
    expect(passed).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'PLAN_LIMIT', limit: 'workspaces.create', max: 2, used: 2, plan: 'free', upgradeUrl: '/pricing' });
    expect(res.body.message).toBe("You've reached the free plan limit: 2 workspaces you created. Pro and Enterprise are coming soon.");
});

test('a counting failure lets the request through', async () => {
    wsq.planWorkspaceCounts.mockRejectedValue(new Error('db down'));
    expect((await run(guards.workspaceCreate)).passed).toBe(true);
});

test('accepting a third invite is refused and the inviter is told', async () => {
    wsq.planWorkspaceCounts.mockResolvedValue({ owned: 0, joined: 2 });
    invites.findByTokenHash.mockResolvedValue({ _id: 'i1', workspace: 'w1', invitedBy: 'owner', inviteType: 'link', status: 'pending' });
    const emit = jest.fn();
    const io = { to: jest.fn(() => ({ emit })) };
    const { res, passed } = await run(guards.workspaceJoin, { body: { token: 'abc' }, io });
    expect(passed).toBe(false);
    expect(res.body).toMatchObject({ code: 'PLAN_LIMIT', limit: 'workspaces.join', max: 2 });
    expect(io.to).toHaveBeenCalledWith('user_owner');
    expect(emit).toHaveBeenCalledWith('plan:limit_reached', expect.objectContaining({
        limit: 'workspaces.join', workspaceId: 'w1', userId: 'u1', message: expect.stringMatching(/Sam couldn't join Acme/),
    }));
    expect(notifications.create).toHaveBeenCalledWith(io, expect.objectContaining({ recipient: 'owner', type: 'plan_limit' }));
});

test('joining a full workspace is refused; your own pending email invite holds your seat', async () => {
    wsq.planWorkspaceCounts.mockResolvedValue({ owned: 0, joined: 0 });
    wsq.countSeats.mockResolvedValue(10);
    wsq.countPendingEmailInvites.mockResolvedValue(1);
    invites.findByTokenHash.mockResolvedValue({ _id: 'i1', workspace: 'w1', inviteType: 'link', status: 'pending' });
    expect((await run(guards.workspaceJoin, { body: { token: 't' } })).res.body).toMatchObject({ limit: 'members.perWorkspace', max: 11 });
    invites.findByTokenHash.mockResolvedValue({ _id: 'i2', workspace: 'w1', inviteType: 'email', email: 'sam@x.io', status: 'pending', used: false });
    expect((await run(guards.workspaceJoin, { body: { token: 't' } })).passed).toBe(true);
});

test('email invites take a seat each (pending invites count toward the cap)', async () => {
    wsq.countSeats.mockResolvedValue(9);
    wsq.countPendingEmailInvites.mockResolvedValue(0);
    const ok = await run(guards.workspaceInvite, { params: { workspaceId: 'w1' }, body: { inviteType: 'email', emails: ['a@x.io', 'b@x.io'] } });
    expect(ok.passed).toBe(true);
    const tooMany = await run(guards.workspaceInvite, { params: { workspaceId: 'w1' }, body: { inviteType: 'email', emails: 'a@x.io, b@x.io, c@x.io' } });
    expect(tooMany.res.body).toMatchObject({ limit: 'members.perWorkspace', used: 9, max: 11 });
});

test('channel, note and task guards', async () => {
    Channel.countDocuments.mockResolvedValue(10);
    expect((await run(guards.channelCreate, { body: { workspaceId: 'w1' } })).res.body.limit).toBe('channels.perWorkspace');

    Note.countDocuments.mockResolvedValue(2);
    expect((await run(guards.noteCreate, { body: { workspaceId: 'w1', templateId: 'spec' } })).res.body.limit).toBe('notes.perTemplate');
    expect(Note.countDocuments).toHaveBeenCalledWith({ workspace: 'w1', owner: 'u1', templateKey: 'projectspec' });
    expect((await run(guards.noteCreate, { body: { workspaceId: 'w1', templateId: 'blank' } })).passed).toBe(true);

    tasksQuery.countDocuments.mockImplementation(async (f) => (f.assignedTo ? 30 : f.createdBy ? 30 : 30));
    expect((await run(guards.taskCreate, { body: { workspaceId: 'w1', assignmentType: 'self' } })).res.body.limit).toBe('tasks.selfCreated');
    tasksQuery.findById.mockResolvedValue({ _id: 't1', workspace: 'w1' });
    expect((await run(guards.subtaskCreate, { params: { id: 't1' }, body: { assignedTo: ['u1'] } })).res.body.limit).toBe('tasks.selfCreated');
});
