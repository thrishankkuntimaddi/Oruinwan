'use strict';

jest.mock('../../../../models/Milestone', () => require('../../roadmap/__tests__/fakeModel').makeFakeModel({ description: '', status: 'not_started', deleted: false, dueDate: null }));
jest.mock('../../../../models/Task', () => require('../../roadmap/__tests__/fakeModel').makeFakeModel({ deleted: false, milestoneId: null, assignedTo: [] }));
jest.mock('../../tasks/tasks.hydrate', () => ({ hydrateTaskUsers: jest.fn(async (docs) => docs) }));

const mongoose = require('mongoose');
const identity = require('../../../identity');
const Milestone = require('../../../../models/Milestone');
const Task = require('../../../../models/Task');
const service = require('../milestones.service');
const { taskProgress, milestoneProgress } = require('../milestones.progress');

const oid = () => new mongoose.Types.ObjectId().toString();
const WS = oid();
const OTHER_WS = oid();
const ALICE = oid();
const BOB = oid();
const OUTSIDER = oid();

beforeEach(() => {
    jest.restoreAllMocks();
    Milestone.reset();
    Task.reset();
    delete process.env.TASKS_STORE;
    jest.spyOn(identity.workspaces, 'membership').mockImplementation(async (ws, uid) => {
        if (String(ws) !== WS) return null;
        const member = [ALICE, BOB].includes(String(uid)) ? { user: uid, role: 'member' } : null;
        return { workspace: { _id: WS }, member, role: member?.role || null, isAdmin: false };
    });
    jest.spyOn(identity.users, 'findById').mockImplementation(async () => ({ companyId: null }));
});

function seedTasks() {
    const ids = { a: oid(), b: oid(), c: oid(), priv: oid(), foreign: oid() };
    Task.seed([
        { _id: ids.a, workspace: WS, title: 'A', status: 'done', visibility: 'workspace', createdBy: ALICE, estimatedHours: 4 },
        { _id: ids.b, workspace: WS, title: 'B', status: 'todo', visibility: 'workspace', createdBy: ALICE, estimatedHours: 2 },
        { _id: ids.c, workspace: WS, title: 'C', status: 'cancelled', visibility: 'workspace', createdBy: ALICE },
        { _id: ids.priv, workspace: WS, title: 'P', status: 'todo', visibility: 'private', createdBy: BOB, assignedTo: [BOB] },
        { _id: ids.foreign, workspace: OTHER_WS, title: 'F', status: 'todo', visibility: 'workspace', createdBy: ALICE },
    ]);
    return ids;
}

describe('progress maths', () => {
    test('cancelled tasks are ignored; hours are summed', () => {
        expect(taskProgress([{ status: 'done', estimatedHours: 1 }, { status: 'todo', estimatedHours: 2 }, { status: 'cancelled', estimatedHours: 9 }]))
            .toEqual({ total: 2, done: 1, open: 1, percent: 50, estimatedHours: 3, remainingHours: 2 });
    });
    test('a completed milestone without tasks is 100%', () => {
        expect(milestoneProgress({ status: 'completed' }, [])).toMatchObject({ percent: 100, complete: true });
        expect(milestoneProgress({ status: 'in_progress' }, [])).toMatchObject({ percent: 0, complete: false });
    });
});

describe('CRUD', () => {
    test('create validates input and membership', async () => {
        await expect(service.createMilestone(ALICE, { workspaceId: WS })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.createMilestone(ALICE, { workspaceId: WS, name: 'Beta', status: 'bogus' })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.createMilestone(ALICE, { workspaceId: WS, name: 'Beta', startDate: '2026-12-01', endDate: '2026-11-01' })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.createMilestone(OUTSIDER, { workspaceId: WS, name: 'Beta' })).rejects.toMatchObject({ statusCode: 403 });
        const { milestone } = await service.createMilestone(ALICE, { workspaceId: WS, name: ' Beta ', dueDate: '2026-12-01' });
        expect(milestone.name).toBe('Beta');
        expect(new Date(milestone.dueDate).toISOString()).toBe('2026-12-01T00:00:00.000Z');
    });

    test('update validates, get returns progress, delete detaches tasks', async () => {
        const ids = seedTasks();
        const { milestone } = await service.createMilestone(ALICE, { workspaceId: WS, name: 'Beta' });
        await expect(service.updateMilestone(ALICE, milestone._id, { status: 'nope' })).rejects.toMatchObject({ statusCode: 400 });
        await service.updateMilestone(BOB, milestone._id, { status: 'at_risk' });
        await service.linkTasks(ALICE, milestone._id, [ids.a, ids.b, ids.c]);
        const got = await service.getMilestone(ALICE, milestone._id);
        expect(got.milestone.status).toBe('at_risk');
        expect(got.milestone.progress).toMatchObject({ total: 2, done: 1, percent: 50, estimatedHours: 6, remainingHours: 2 });
        expect(got.milestone.tasks).toHaveLength(3);
        const list = await service.getMilestones(BOB, WS);
        expect(list.milestones[0].taskCounts).toEqual({ total: 2, done: 1 });
        await service.deleteMilestone(ALICE, milestone._id);
        expect(Task._rows().filter((t) => t.milestoneId)).toHaveLength(0);
        await expect(service.getMilestone(ALICE, milestone._id)).rejects.toMatchObject({ statusCode: 404 });
        await expect(service.getMilestone(ALICE, 'nope')).rejects.toMatchObject({ statusCode: 404 });
    });
});

describe('task linking', () => {
    test('only visible tasks of the same workspace can be linked', async () => {
        const ids = seedTasks();
        const { milestone } = await service.createMilestone(ALICE, { workspaceId: WS, name: 'Beta' });
        await expect(service.linkTasks(ALICE, milestone._id, [ids.foreign])).rejects.toMatchObject({ statusCode: 400, errors: [ids.foreign] });
        await expect(service.linkTasks(ALICE, milestone._id, [ids.priv])).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.linkTasks(ALICE, milestone._id, [])).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.linkTasks(ALICE, milestone._id, ['bad'])).rejects.toMatchObject({ statusCode: 400 });
        const out = await service.linkTasks(BOB, milestone._id, [ids.priv, ids.a]);
        expect(out.linked).toEqual([ids.priv, ids.a]);
        expect(out.progress).toMatchObject({ total: 2, done: 1 });
        // ALICE can't see BOB's private task in the milestone task list
        expect((await service.getMilestone(ALICE, milestone._id)).milestone.tasks.map((t) => t._id)).toEqual([ids.a]);
        await expect(service.linkTasks(OUTSIDER, milestone._id, [ids.a])).rejects.toMatchObject({ statusCode: 403 });
    });

    test('a task moves between milestones and can be unlinked', async () => {
        const ids = seedTasks();
        const m1 = (await service.createMilestone(ALICE, { workspaceId: WS, name: 'One' })).milestone;
        const m2 = (await service.createMilestone(ALICE, { workspaceId: WS, name: 'Two' })).milestone;
        await service.linkTasks(ALICE, m1._id, [ids.a]);
        await service.linkTasks(ALICE, m2._id, [ids.a]);
        expect((await service.getProgress(ALICE, m1._id)).progress.total).toBe(0);
        expect((await service.getProgress(ALICE, m2._id)).progress.total).toBe(1);
        await expect(service.unlinkTask(ALICE, m1._id, ids.a)).rejects.toMatchObject({ statusCode: 404 });
        const out = await service.unlinkTask(ALICE, m2._id, ids.a);
        expect(out.progress.total).toBe(0);
    });
});

describe('PostgreSQL task store', () => {
    test('linking writes milestoneId through the tasks repository', async () => {
        jest.resetModules();
        jest.doMock('../../tasks/tasks.store', () => ({ tasksStore: () => 'pg' }));
        const MS = oid();
        const T = oid();
        const update = jest.fn(async () => ({}));
        const findMany = jest.fn(async (f) => (f.ids ? [{ _id: T, workspace: WS, status: 'todo', visibility: 'workspace' }] : []));
        jest.doMock('../../tasks/tasks.repository', () => ({ update, findMany }));
        jest.doMock('../../tasks/planning.repository', () => ({
            milestones: { findById: jest.fn(async () => ({ _id: MS, workspace: WS, deleted: false, status: 'not_started' })) },
        }));
        jest.doMock('../../tasks/tasks.hydrate', () => ({ hydrateTaskUsers: jest.fn(async (d) => d) }));
        const id2 = require('../../../identity');
        jest.spyOn(id2.workspaces, 'membership').mockResolvedValue({ workspace: { _id: WS }, member: { role: 'member' } });
        const pgService = require('../milestones.service');
        await pgService.linkTasks(ALICE, MS, [T]);
        expect(update).toHaveBeenCalledWith(T, { milestoneId: MS });
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ milestoneId: MS, workspace: WS }));
    });
});
