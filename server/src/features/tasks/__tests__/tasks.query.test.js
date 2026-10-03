'use strict';

const mongoose = require('mongoose');

jest.mock('../../../../models/Task', () => ({
    countDocuments: jest.fn().mockResolvedValue(7),
    find: jest.fn(),
    aggregate: jest.fn().mockResolvedValue([{ _id: null, total: 4, completed: 1 }]),
}));

const Task = require('../../../../models/Task');
const repo = require('../tasks.repository');
const postgres = require('../../../shared/postgres');
const Tasks = require('../tasks.query');

const W = '64b000000000000000000001';
const U = '64b000000000000000000002';

describe('whereFromFilter (Mongo-style filter → SQL)', () => {
    const w = (f) => repo.whereFromFilter(f);

    test('equality, aliases and id casting', () => {
        const { clause, params } = w({ workspaceId: new mongoose.Types.ObjectId(W), status: 'done' });
        expect(clause).toBe('t.workspace_id = $1 AND t.status = $2');
        expect(params).toEqual([W, 'done']);
    });

    test('$in / $nin / $ne / ranges / null', () => {
        const d = new Date('2026-01-01');
        const { clause, params } = w({
            status: { $nin: ['done', 'cancelled'] }, deleted: { $ne: true }, dueDate: { $lt: d }, completedAt: { $ne: null }, priority: { $in: ['high', null] },
        });
        expect(clause).toContain('(t.status IS NULL OR NOT (t.status = ANY($1)))');
        expect(clause).toContain('t.deleted IS DISTINCT FROM $2');
        expect(clause).toContain('t.due_date < $3');
        expect(clause).toContain('t.completed_at IS NOT NULL');
        expect(clause).toContain('(t.priority = ANY($4) OR t.priority IS NULL)');
        expect(params).toEqual([['done', 'cancelled'], true, d, ['high']]);
    });

    test('relations, arrays, regex, links and $or', () => {
        const { clause, params } = w({
            $or: [{ assignedTo: U }, { createdBy: { $in: [U] } }],
            tags: /ops/i,
            title: /deploy/i,
            'externalLinks.url': 'https://x/1',
        });
        expect(clause).toContain('EXISTS (SELECT 1 FROM task_assignees r WHERE r.task_id = t.id AND r.user_id = $1)');
        expect(clause).toContain('t.created_by = ANY($2)');
        expect(clause).toContain('EXISTS (SELECT 1 FROM unnest(t.tags) x WHERE x ~* $3)');
        expect(clause).toContain('t.title ~* $4');
        expect(clause).toContain('t.external_links @> $5::jsonb');
        expect(params[4]).toBe('[{"url":"https://x/1"}]');
    });

    test('unknown fields and operators throw instead of being ignored', () => {
        expect(() => w({ nope: 1 })).toThrow(/unsupported field nope/);
        expect(() => w({ status: { $foo: 1 } })).toThrow(/unsupported operator \$foo/);
    });

    test('project keeps only selected fields', () => {
        expect(repo.project({ _id: 'a', title: 't', status: 's', x: 1 }, 'title status')).toEqual({ _id: 'a', title: 't', status: 's' });
        expect(repo.project({ _id: 'a', title: 't', x: 1 }, '-x')).toEqual({ _id: 'a', title: 't' });
    });
});

describe('tasks.query store switch', () => {
    const env = { ...process.env };
    afterEach(() => { process.env = { ...env }; postgres._setPoolForTests(undefined); });

    test('mongo store delegates to the Task model', async () => {
        delete process.env.TASKS_STORE;
        expect(await Tasks.countDocuments({ workspace: W })).toBe(7);
        expect(Task.countDocuments).toHaveBeenCalledWith({ workspace: W });
        expect(await Tasks.totals({ workspace: W })).toEqual({ total: 4, completed: 1 });
        const match = Task.aggregate.mock.calls[0][0][0].$match;
        expect(match.workspace).toBeInstanceOf(mongoose.Types.ObjectId);
    });

    test('pg store runs SQL', async () => {
        process.env.TASKS_STORE = 'pg';
        process.env.DATABASE_URL = 'postgres://test';
        const calls = [];
        postgres._setPoolForTests({ query: async (text, params) => { calls.push({ text, params }); return { rows: [{ n: 3, total: 3, completed: 2, hours: 1.5 }] }; } });
        expect(await Tasks.countDocuments({ workspace: W, deleted: { $ne: true } })).toBe(3);
        expect(calls[0].text).toMatch(/SELECT count\(\*\)::int AS n FROM tasks t WHERE t\.workspace_id = \$1 AND t\.deleted IS DISTINCT FROM \$2/);
        expect(await Tasks.totals({ workspace: W })).toEqual(expect.objectContaining({ total: 3, completed: 2 }));
        expect(await Tasks.avgCompletionHours({ workspace: W })).toBe(1.5);
        expect(Task.countDocuments).not.toHaveBeenCalled();
    });
});
