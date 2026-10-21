'use strict';

jest.mock('../RoadmapItem', () => {
    const { makeFakeModel } = require('./fakeModel');
    const m = makeFakeModel({ description: '', status: 'planned', milestoneIds: [], taskIds: [], projectId: null, channelId: null, quarter: null, order: 0, color: 'accent', deleted: false, startDate: null, endDate: null });
    m.ROADMAP_STATUSES = ['planned', 'in_progress', 'at_risk', 'done'];
    m.ROADMAP_COLORS = ['accent', 'color-primary', 'color-success', 'color-warning', 'color-danger', 'text-muted'];
    m.QUARTER_RE = /^\d{4}-Q[1-4]$/;
    return m;
});
jest.mock('../../milestones/milestones.store', () => ({
    onPg: () => false,
    findMilestones: jest.fn(),
    findTasks: jest.fn(),
}));
jest.mock('../../channels/channel.model', () => ({ findById: jest.fn() }));

const mongoose = require('mongoose');
const identity = require('../../../identity');
const RoadmapItem = require('../RoadmapItem');
const store = require('../../milestones/milestones.store');
const Channel = require('../../channels/channel.model');
const service = require('../roadmap.service');

const oid = () => new mongoose.Types.ObjectId().toString();
const WS = oid();
const COMPANY = oid();
const ADMIN = oid();
const MANAGER = oid(); // company manager, workspace member
const MEMBER = oid();
const OUTSIDER = oid();
const M1 = oid();
const M2 = oid();
const T1 = oid(), T2 = oid(), T3 = oid(), T4 = oid();

const members = { [ADMIN]: 'admin', [MANAGER]: 'member', [MEMBER]: 'member' };
const users = {
    [ADMIN]: { _id: ADMIN, username: 'ada' },
    [MANAGER]: { _id: MANAGER, username: 'max', companyId: COMPANY, companyRole: 'manager' },
    [MEMBER]: { _id: MEMBER, username: 'mo', companyId: COMPANY, companyRole: 'member' },
};

const milestones = [
    { _id: M1, name: 'Beta', status: 'in_progress', workspace: WS },
    { _id: M2, name: 'GA', status: 'completed', workspace: WS },
];
const tasks = [
    { _id: T1, status: 'done', milestoneId: M1, workspace: WS, visibility: 'workspace', estimatedHours: 2 },
    { _id: T2, status: 'todo', milestoneId: M1, workspace: WS, visibility: 'workspace', estimatedHours: 3 },
    { _id: T3, status: 'cancelled', milestoneId: M1, workspace: WS, visibility: 'workspace' },
    { _id: T4, status: 'done', milestoneId: null, workspace: WS, visibility: 'private', createdBy: ADMIN, assignedTo: [] },
];

beforeEach(() => {
    jest.restoreAllMocks();
    RoadmapItem.reset();
    jest.spyOn(identity.workspaces, 'membership').mockImplementation(async (ws, uid) => {
        if (String(ws) !== WS) return null;
        const role = members[String(uid)];
        return { workspace: { _id: WS, company: COMPANY }, member: role ? { user: uid, role } : null, role: role || null, isAdmin: role === 'owner' || role === 'admin' };
    });
    jest.spyOn(identity.users, 'findById').mockImplementation(async (id) => users[String(id)] || null);
    jest.spyOn(identity.users, 'findManyByIds').mockImplementation(async () => new Map());
    store.findMilestones.mockImplementation(async (ws, ids) => milestones.filter((m) => !ids || ids.includes(m._id)));
    store.findTasks.mockImplementation(async (ws, { ids = [], milestoneIds = [], projectId = null } = {}) =>
        tasks.filter((t) => ids.includes(t._id) || (t.milestoneId && milestoneIds.includes(t.milestoneId)) || (projectId && t.project === projectId)));
});

describe('permissions', () => {
    test('admins and company managers create; plain members cannot', async () => {
        await expect(service.createItem(ADMIN, { workspaceId: WS, title: 'Mobile v2' })).resolves.toHaveProperty('item.title', 'Mobile v2');
        await expect(service.createItem(MANAGER, { workspaceId: WS, title: 'Search' })).resolves.toHaveProperty('item.ownerId');
        await expect(service.createItem(MEMBER, { workspaceId: WS, title: 'Nope' })).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.createItem(OUTSIDER, { workspaceId: WS, title: 'Nope' })).rejects.toMatchObject({ statusCode: 403 });
    });

    test('the item owner may edit but not reassign; others get 403; outsiders 404', async () => {
        const { item } = await service.createItem(ADMIN, { workspaceId: WS, title: 'X', ownerId: MEMBER });
        await expect(service.updateItem(MEMBER, item._id, { status: 'in_progress' })).resolves.toHaveProperty('item.status', 'in_progress');
        await expect(service.updateItem(MEMBER, item._id, { ownerId: ADMIN })).rejects.toMatchObject({ statusCode: 403 });
        const other = await service.createItem(ADMIN, { workspaceId: WS, title: 'Y' });
        await expect(service.updateItem(MEMBER, other.item._id, { title: 'Z' })).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.getItem(OUTSIDER, item._id)).rejects.toMatchObject({ statusCode: 404 });
        await expect(service.deleteItem(MEMBER, item._id)).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.deleteItem(ADMIN, item._id)).resolves.toHaveProperty('message');
        await expect(service.getItem(ADMIN, item._id)).rejects.toMatchObject({ statusCode: 404 });
    });

    test('members can read the roadmap with canEdit flags', async () => {
        await service.createItem(ADMIN, { workspaceId: WS, title: 'A' });
        await service.createItem(ADMIN, { workspaceId: WS, title: 'B', ownerId: MEMBER });
        const { items, canCreate } = await service.listItems(MEMBER, WS);
        expect(canCreate).toBe(false);
        expect(items.map((i) => [i.title, i.canEdit])).toEqual([['A', false], ['B', true]]);
        await expect(service.listItems(OUTSIDER, WS)).rejects.toMatchObject({ statusCode: 403 });
    });
});

describe('validation', () => {
    test('rejects bad status, colour, quarter, dates and foreign links', async () => {
        const base = { workspaceId: WS, title: 'T' };
        await expect(service.createItem(ADMIN, { ...base, status: 'nope' })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.createItem(ADMIN, { ...base, color: '#ff00ff' })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.createItem(ADMIN, { ...base, quarter: 'Q4-2026' })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.createItem(ADMIN, { ...base, startDate: '2026-12-01', endDate: '2026-01-01' })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.createItem(ADMIN, { ...base, milestoneIds: [oid()] })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.createItem(ADMIN, { ...base, ownerId: OUTSIDER })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.createItem(ADMIN, { ...base, title: '  ' })).rejects.toMatchObject({ statusCode: 400 });
        Channel.findById.mockReturnValue({ select: () => ({ lean: async () => ({ workspace: oid() }) }) });
        await expect(service.createItem(ADMIN, { ...base, channelId: oid() })).rejects.toMatchObject({ statusCode: 400 });
    });

    test('a private task of someone else cannot be linked', async () => {
        await expect(service.createItem(MANAGER, { workspaceId: WS, title: 'T', taskIds: [T4] })).rejects.toMatchObject({ statusCode: 400, errors: [T4] });
        await expect(service.createItem(ADMIN, { workspaceId: WS, title: 'T', taskIds: [T4] })).resolves.toBeTruthy();
    });
});

describe('progress', () => {
    test('counts tasks of linked milestones plus direct tasks, ignoring cancelled ones', async () => {
        const { item } = await service.createItem(ADMIN, {
            workspaceId: WS, title: 'Launch', milestoneIds: [M1, M2], taskIds: [T4], quarter: '2026-Q4', color: 'color-success',
        });
        // tasks: T1 done, T2 todo, T4 done (T3 cancelled is ignored) -> 2/3
        expect(item.progress.percent).toBe(67);
        expect(item.progress.tasks).toMatchObject({ total: 3, done: 2, estimatedHours: 5, remainingHours: 3 });
        expect(item.progress.milestones.total).toBe(2);
        // M2 has no tasks but is completed -> complete; M1 is not
        expect(item.progress.milestones.completed).toBe(1);
        expect(item.quarter).toBe('2026-Q4');
    });

    test('milestones without tasks drive the percentage, and a bare done item is 100', async () => {
        store.findTasks.mockResolvedValue([]);
        const a = await service.createItem(ADMIN, { workspaceId: WS, title: 'A', milestoneIds: [M1, M2] });
        expect(a.item.progress.percent).toBe(50);
        const b = await service.createItem(ADMIN, { workspaceId: WS, title: 'B', status: 'done' });
        expect(b.item.progress.percent).toBe(100);
    });
});

describe('listing and ordering', () => {
    test('filters by quarter and reorders', async () => {
        const a = (await service.createItem(ADMIN, { workspaceId: WS, title: 'A', quarter: '2026-Q3' })).item;
        const b = (await service.createItem(ADMIN, { workspaceId: WS, title: 'B', quarter: '2026-Q4' })).item;
        const c = (await service.createItem(ADMIN, { workspaceId: WS, title: 'C', quarter: '2026-Q4' })).item;
        expect((await service.listItems(MEMBER, WS, { quarter: '2026-Q4' })).items.map((i) => i.title)).toEqual(['B', 'C']);
        await service.reorder(ADMIN, { workspaceId: WS, order: [c._id, a._id, b._id] });
        expect((await service.listItems(MEMBER, WS)).items.map((i) => i.title)).toEqual(['C', 'A', 'B']);
        await expect(service.reorder(MEMBER, { workspaceId: WS, order: [a._id] })).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.reorder(ADMIN, { workspaceId: WS, order: [oid()] })).rejects.toMatchObject({ statusCode: 400 });
    });
});
