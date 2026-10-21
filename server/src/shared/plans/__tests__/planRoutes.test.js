'use strict';

/** GET /api/plan: plan, limits, usage, progress-bar items and what is blocked. */

jest.mock('../../../identity', () => ({
    users: { findById: jest.fn() },
    workspaces: { findById: jest.fn(), membership: jest.fn() },
}));
jest.mock('../../../identity/queries/workspaces', () => ({
    planWorkspaceCounts: jest.fn(async () => ({ owned: 2, joined: 1 })),
    countSeats: jest.fn(async () => 4),
    countPendingEmailInvites: jest.fn(async () => 1),
}));
jest.mock('../../../features/channels/channel.model', () => ({ countDocuments: jest.fn(async () => 3) }));
jest.mock('../../../../models/Note', () => ({ countDocuments: jest.fn(), aggregate: jest.fn(async () => [{ _id: 'meeting', n: 2 }]) }));
jest.mock('../../../features/tasks/tasks.query', () => ({
    countDocuments: jest.fn(async (f) => (f.assignedTo ? 5 : f.createdBy ? 12 : 40)),
}));

const identity = require('../../../identity');
const planService = require('../planService');
const counters = require('../planCounters');
const aiQuota = require('../aiQuota');
const { buildPlan } = require('../plan.routes');

const FREE_WS = { _id: '64b000000000000000000001', name: 'Acme', company: null, members: [] };
const CORP_WS = { _id: '64b000000000000000000002', name: 'Corp', company: 'c1', members: [] };

beforeEach(() => {
    planService._clearCache();
    planService.deps.mongoReady = () => true;
    planService.deps.tasksOnPg = () => false;
    counters._setBackendForTests('memory');
    counters._resetMemory();
    identity.users.findById.mockImplementation(async (id) => ({ _id: id, companyId: id === 'emp' ? 'c1' : null }));
    identity.workspaces.findById.mockImplementation(async (id) => (String(id) === CORP_WS._id ? CORP_WS : FREE_WS));
});
afterAll(() => counters._setBackendForTests(null));

test('free workspace: usage for every limit', async () => {
    for (let i = 0; i < 12; i += 1) await aiQuota.consume({ userId: 'u1', workspaceId: FREE_WS._id });
    const plan = await buildPlan('u1', FREE_WS);
    expect(plan).toMatchObject({ plan: 'free', exempt: false, upgradeUrl: '/pricing' });
    expect(plan.plans.map((p) => p.id)).toEqual(['free', 'pro', 'enterprise']);
    expect(plan.usage).toMatchObject({
        'workspaces.create': 2, 'workspaces.join': 1, 'members.perWorkspace': 5, 'channels.perWorkspace': 3,
        'tasks.perWorkspace': 40, 'tasks.selfCreated': 5, 'tasks.assignedToOthers': 7, 'ai.userDaily': 12, 'ai.workspaceDaily': 12,
    });
    expect(plan.blocked['workspaces.create']).toBe(true);
    expect(plan.blocked['channels.perWorkspace']).toBe(false);
    expect(plan.items.find((i) => i.key === 'workspaces.create')).toMatchObject({ used: 2, max: 2, atLimit: true, label: 'Workspaces you created' });
    expect(plan.items).toHaveLength(9);
    expect(plan.notes).toMatchObject({ perTemplate: 2, byTemplate: { meeting: 2 }, externalSharing: false });
    expect(plan.huddles).toEqual({ participants: 10, minutes: 30 });
    expect(plan.ai).toMatchObject({ userUsed: 12, userMax: 50, userRemaining: 38, workspaceMax: 300 });
});

test('without a workspace only the personal items are listed', async () => {
    const plan = await buildPlan('u1', null);
    expect(plan.items.map((i) => i.scope)).toEqual(expect.not.arrayContaining(['workspace']));
    expect(plan.workspacePlan).toBeNull();
});

test('company workspace: exempt, nothing limited', async () => {
    const plan = await buildPlan('emp', CORP_WS);
    expect(plan).toMatchObject({ plan: 'company', exempt: true });
    expect(plan.limits['channels.perWorkspace']).toBeNull();
    expect(plan.limits['workspaces.create']).toBeNull();
    expect(Object.values(plan.blocked).every((v) => v === false)).toBe(true);
});
