'use strict';

/** Task templates: subtask-title cleanup and "apply" (task + checklist subtasks). */

jest.mock('../../../../models/TaskTemplate', () => ({ findById: jest.fn(), create: jest.fn(), find: jest.fn() }));
jest.mock('../../../identity', () => ({
    users: { findById: jest.fn(async (id) => ({ _id: id, companyId: null })) },
    workspaces: { membership: jest.fn() },
}));
jest.mock('../../tasks/tasks.service', () => ({
    createTask: jest.fn(),
    createSubtask: jest.fn(),
    getTask: jest.fn(),
}));

const TaskTemplate = require('../../../../models/TaskTemplate');
const identity = require('../../../identity');
const tasksService = require('../../tasks/tasks.service');
const service = require('../task-templates.service');

const oid = (n) => n.toString(16).padStart(24, '0');
const ALICE = oid(1);
const BOB = oid(2);
const WS = oid(30);
const TPL = oid(40);

const template = {
    _id: TPL, workspace: WS, name: 'Release', title: 'Release checklist', description: 'Steps', priority: 'high',
    tags: ['release'], estimatedHours: 4, subtaskTitles: ['Tag build', '  ', 'Write notes'],
};

beforeEach(() => {
    jest.clearAllMocks();
    identity.workspaces.membership.mockImplementation(async (ws, uid) => (
        String(ws) === WS && [ALICE, BOB].includes(String(uid)) ? { member: { user: uid }, workspace: { _id: WS } } : { member: null }));
    TaskTemplate.findById.mockReturnValue({ lean: async () => template });
    let n = 200;
    tasksService.createTask.mockImplementation(async (_u, data) => ({ tasks: [{ _id: oid(100), title: data.title, assignedTo: [{ _id: BOB }] }] }));
    tasksService.createSubtask.mockImplementation(async (_u, parentId, data) => ({ subtask: { _id: oid(n++), parentTask: parentId, title: data.title, assignedTo: data.assignedTo } }));
    tasksService.getTask.mockImplementation(async (_u, id) => ({ task: { _id: id, title: 'Release checklist', subtasks: [] } }));
});

describe('applyTemplate', () => {
    it('creates the task from the template (body overrides) and one subtask per checklist item', async () => {
        const res = await service.applyTemplate(ALICE, TPL, { assignmentType: 'individual', assignedToIds: [BOB], dueDate: '2026-11-01', priority: 'low' }, null, null);
        const [, data] = tasksService.createTask.mock.calls[0];
        expect(data).toMatchObject({
            workspaceId: WS, title: 'Release checklist', description: 'Steps', priority: 'low', tags: ['release'],
            estimatedHours: 4, assignmentType: 'individual', assignedToIds: [BOB], dueDate: '2026-11-01',
        });
        expect(tasksService.createSubtask.mock.calls.map((c) => [c[1], c[2].title, c[2].assignedTo])).toEqual([
            [oid(100), 'Tag build', [BOB]],
            [oid(100), 'Write notes', [BOB]],
        ]);
        expect(res.subtasks).toHaveLength(2);
        expect(res.tasks[0]._id).toBe(oid(100));
    });

    it('refuses non-members and unknown templates', async () => {
        await expect(service.applyTemplate(oid(9), TPL, {}, null, null)).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.applyTemplate(ALICE, 'bad', {}, null, null)).rejects.toMatchObject({ statusCode: 404 });
        TaskTemplate.findById.mockReturnValue({ lean: async () => null });
        await expect(service.applyTemplate(ALICE, TPL, {}, null, null)).rejects.toMatchObject({ statusCode: 404 });
        expect(tasksService.createTask).not.toHaveBeenCalled();
    });
});

describe('subtask titles', () => {
    it('trims, drops blanks and rejects non-arrays', () => {
        expect(service._cleanTitles([' a ', '', 'b', 3])).toEqual(['a', 'b']);
        expect(() => service._cleanTitles('a')).toThrow(/array/);
    });
});
