'use strict';

jest.mock('../../../../models/Task', () => ({ findByIdAndUpdate: jest.fn().mockResolvedValue({}) }));
jest.mock('../tasks.repository', () => ({ update: jest.fn().mockResolvedValue({}), addAssignee: jest.fn().mockResolvedValue() }));

const Task = require('../../../../models/Task');
const repo = require('../tasks.repository');
const { executeRules } = require('../tasks.automation');

const task = (rules) => ({ _id: 't1', status: 'todo', priority: 'low', createdBy: 'u1', assignedTo: ['u2'], automationRules: rules, save: jest.fn() });

describe('task automation rules', () => {
    const env = { ...process.env };
    afterEach(() => { process.env = { ...env }; jest.clearAllMocks(); });

    test('MongoDB store writes through the model', async () => {
        delete process.env.TASKS_STORE;
        const t = task([{ trigger: 'created', action: 'move_to_done' }, { trigger: 'created', action: 'assign_creator' }]);
        await executeRules(t, 'created');
        expect(Task.findByIdAndUpdate).toHaveBeenCalledWith('t1', expect.objectContaining({ status: 'done' }));
        expect(t.save).toHaveBeenCalled();
        expect(repo.update).not.toHaveBeenCalled();
    });

    test('PostgreSQL store writes through the repository', async () => {
        process.env.TASKS_STORE = 'pg';
        process.env.DATABASE_URL = 'postgres://unused';
        const t = task([
            { trigger: 'created', action: 'move_to_done' },
            { trigger: 'created', action: 'assign_creator' },
            { trigger: 'created', action: 'set_high_priority' },
            { trigger: 'other', action: 'set_high_priority' },
        ]);
        await executeRules(t, 'created');
        expect(repo.update).toHaveBeenCalledWith('t1', expect.objectContaining({ status: 'done' }));
        expect(repo.addAssignee).toHaveBeenCalledWith('t1', 'u1');
        expect(repo.update).toHaveBeenCalledWith('t1', { priority: 'high' });
        expect(Task.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(t.save).not.toHaveBeenCalled();
        expect(t.assignedTo).toEqual(['u2', 'u1']);
    });
});
