'use strict';

/**
 * Bulk creates on the free plan: clone, import and templates create only what
 * fits (channels within the allowance, cloned members within their join limit
 * and the member cap) and report what they skipped. The old "3 workspaces"
 * rule is gone: the route's plan guard is the only workspace-count rule.
 */

const mockChannels = [];
let mockUsers = {};
let mockJoined = {};

jest.mock('../../../identity', () => ({
    users: { findById: jest.fn(async (id) => mockUsers[id] || { _id: id, username: id, companyId: null }) },
    workspaces: {
        findById: jest.fn(),
        create: jest.fn(async (d) => ({ _id: 'new1', ...d })),
        update: jest.fn(async (id, patch) => ({ _id: id, members: [], ...patch })),
    },
    workspacePermissions: { get: jest.fn(async () => null), upsert: jest.fn(async () => {}) },
}));
jest.mock('../../../identity/queries/workspaces', () => ({
    countCreatedBy: jest.fn(async () => 99),
    findByNameForCreator: jest.fn(async () => null),
    planWorkspaceCounts: jest.fn(async (id) => ({ owned: 0, joined: mockJoined[id] || 0 })),
    countSeats: jest.fn(async () => 1),
    countPendingEmailInvites: jest.fn(async () => 0),
}));
jest.mock('../../channels/channel.model', () => ({
    create: jest.fn(async (doc) => { const c = { _id: `ch${mockChannels.length + 1}`, ...doc }; mockChannels.push(c); return c; }),
    find: jest.fn(() => ({ lean: async () => [], select: () => ({ lean: async () => [] }) })),
    countDocuments: jest.fn(async () => 0),
}));
jest.mock('../../../models/WorkspaceTemplate', () => ({ findOne: jest.fn(), updateOne: jest.fn(async () => {}) }));
jest.mock('../../../shared/workspaceFeatures', () => ({ invalidateWorkspaceFeatures: jest.fn() }));
jest.mock('../../../modules/conversations/conversationKeys.service', () => ({ bootstrapConversationKey: jest.fn(async () => {}) }));
jest.mock('../../../shared/adminAudit', () => ({ recordAdminAction: jest.fn(async () => {}) }));
jest.mock('../../../../models/Note', () => ({ countDocuments: jest.fn() }));
jest.mock('../../tasks/tasks.query', () => ({ countDocuments: jest.fn() }));

const identity = require('../../../identity');
const Channel = require('../../channels/channel.model');
const WorkspaceTemplate = require('../../../models/WorkspaceTemplate');
const planService = require('../../../shared/plans/planService');
const svc = require('../workspace-os.service');
const ctrl = require('../workspace-os.controller');

const names = (n, prefix = 'c') => Array.from({ length: n }, (_, i) => ({ _id: `${prefix}${i}`, name: `${prefix}${i}` }));
const lean = (rows) => ({ lean: async () => rows, select: () => ({ lean: async () => rows }) });

beforeEach(() => {
    jest.clearAllMocks();
    mockChannels.length = 0;
    mockUsers = { owner1: { _id: 'owner1', username: 'Sam', companyId: null } };
    mockJoined = {};
    planService._clearCache();
    planService.deps.mongoReady = () => true;
    Channel.countDocuments.mockResolvedValue(0);
    Channel.find.mockImplementation(() => lean([]));
});

describe('clone', () => {
    test('no "3 workspaces" rule: someone who already created many can clone (the route guard decides)', async () => {
        identity.workspaces.findById.mockResolvedValue({ _id: 'src', name: 'Acme', company: null, members: [{ user: 'owner1', role: 'owner' }] });
        const cloned = await svc.cloneWorkspace({ sourceId: 'src', userId: 'owner1', name: 'Copy' });
        expect(cloned._id).toBe('new1');
    });

    test('with members: only people within their join limit and the member cap; the rest are reported', async () => {
        const members = [{ user: 'owner1', role: 'owner' }];
        for (let i = 0; i < 14; i++) members.push({ user: `u${i}`, role: i === 0 ? 'owner' : 'member' });
        mockJoined = { u1: 2 }; // already joined 2 workspaces: the free plan's limit
        identity.workspaces.findById.mockResolvedValue({ _id: 'src', name: 'Acme', company: null, members });
        const cloned = await svc.cloneWorkspace({ sourceId: 'src', userId: 'owner1', name: 'Copy', includeMembers: true });

        const created = identity.workspaces.create.mock.calls[0][0].members;
        expect(created).toHaveLength(11); // owner + 10
        expect(created[0]).toMatchObject({ user: 'owner1', role: 'owner' });
        expect(created.filter((m) => m.role === 'owner')).toHaveLength(1); // the source's other owner is an admin here
        expect(created.map((m) => m.user)).not.toContain('u1');
        expect(cloned.skippedMembers).toEqual(expect.arrayContaining([
            expect.objectContaining({ userId: 'u1', reason: 'workspaces.join' }),
            expect.objectContaining({ userId: 'u13', reason: 'members.perWorkspace' }),
        ]));
        expect(cloned.skippedMembers).toHaveLength(4); // u1 (join limit), u11-u13 (owner + 10 reached)
        const body = ctrl._planSkips(cloned);
        expect(body.skippedMessage).toMatch(/4 people were not added/);
    });

    test('a company clone copies everyone', async () => {
        mockUsers.owner1 = { _id: 'owner1', companyId: 'co1', userType: 'company' };
        const members = [{ user: 'owner1', role: 'owner' }, ...names(14, 'u').map((u) => ({ user: u._id, role: 'member' }))];
        identity.workspaces.findById.mockResolvedValue({ _id: 'src', name: 'Acme', company: 'co1', members });
        const cloned = await svc.cloneWorkspace({ sourceId: 'src', userId: 'owner1', name: 'Copy', includeMembers: true, companyId: 'co1' });
        expect(identity.workspaces.create.mock.calls[0][0].members).toHaveLength(15);
        expect(cloned.skippedMembers).toEqual([]);
    });

    test('channels: the default ones always come along, the rest up to the allowance', async () => {
        identity.workspaces.findById.mockResolvedValue({ _id: 'src', name: 'Acme', company: null, members: [{ user: 'owner1', role: 'owner' }] });
        const source = [{ _id: 'g', name: 'general' }, { _id: 'r', name: 'random' }, { _id: 'p', name: 'launch', autoCreated: true }, ...names(12)];
        Channel.find.mockImplementation(() => lean(source));
        const cloned = await svc.cloneWorkspace({ sourceId: 'src', userId: 'owner1', name: 'Copy' });
        expect(mockChannels.map((c) => c.name)).toEqual(['general', 'random', 'launch', ...names(10).map((c) => c.name)]);
        expect(mockChannels.find((c) => c.name === 'launch').autoCreated).toBe(true);
        expect(cloned.skippedChannels).toEqual(['c10', 'c11']);
        expect(ctrl._planSkips(cloned).skippedMessage).toMatch(/^2 channels skipped: free plan allows 10 channels/);
    });
});

describe('import', () => {
    test('creates up to the allowance; a bundle cannot mark its own channels free', async () => {
        const bundle = { schemaVersion: '1.0', workspace: { name: 'Imported' }, channels: [{ name: 'general', isDefault: true }, ...names(11).map((c) => ({ name: c.name, autoCreated: true }))] };
        const imported = await svc.importWorkspace({ bundle, userId: 'owner1' });
        expect(mockChannels).toHaveLength(11);
        expect(imported.skippedChannels).toEqual(['c10']);
        expect(imported.channelLimit).toBe(10);
    });

    test('company accounts import everything', async () => {
        mockUsers.owner1 = { _id: 'owner1', companyId: 'co1', userType: 'company' };
        const bundle = { schemaVersion: '1.0', workspace: { name: 'Imported' }, channels: names(15) };
        const imported = await svc.importWorkspace({ bundle, userId: 'owner1' });
        expect(mockChannels).toHaveLength(15);
        expect(imported.skippedChannels).toEqual([]);
    });
});

describe('templates', () => {
    test('a template creates only the channels that still fit, and says which it skipped', async () => {
        WorkspaceTemplate.findOne.mockReturnValue({ lean: async () => ({ _id: 't1', isPublic: true, defaultChannels: names(5, 'tpl') }) });
        Channel.countDocuments.mockResolvedValue(8); // 8 counted channels already
        const ws = { _id: 'ws1', company: null, members: [] };
        const applied = await svc.applyTemplate({ workspace: ws, templateId: 't1', userId: 'owner1' });
        expect(mockChannels.map((c) => c.name)).toEqual(['tpl0', 'tpl1']);
        expect(applied.skippedChannels).toEqual(['tpl2', 'tpl3', 'tpl4']);
        expect(applied.channelLimit).toBe(10);
    });

    test('a counting problem never blocks: everything is created', async () => {
        WorkspaceTemplate.findOne.mockReturnValue({ lean: async () => ({ _id: 't1', isPublic: true, defaultChannels: names(3, 'tpl') }) });
        planService.deps.mongoReady = () => false;
        const applied = await svc.applyTemplate({ workspace: { _id: 'ws1', company: null, members: [] }, templateId: 't1', userId: 'owner1' });
        expect(mockChannels).toHaveLength(3);
        expect(applied.skippedChannels).toEqual([]);
    });
});
