'use strict';

/** Recurrence rules (pure) and the recurring-task generator (Mongo store, mocked). */

jest.mock('../../../../models/Task', () => {
    const Task = jest.fn(function (data) {
        Object.assign(this, { _id: `new${(global.__seq = (global.__seq || 0) + 1)}`, ...data });
        this.save = jest.fn().mockResolvedValue(this);
        global.__saved.push(this);
    });
    Task.find = jest.fn();
    Task.updateOne = jest.fn();
    return Task;
});
jest.mock('../issue-key-counter.model', () => ({ nextKey: jest.fn().mockResolvedValue('ACME-9') }));

const Task = require('../../../../models/Task');
const { normalizeRecurring, nextOccurrence, planNextRun, recurringForTask } = require('../tasks.recurrence');
const { runRecurringTaskJob, generateOccurrence } = require('../tasks.cron');

const D = (s) => new Date(s);
const iso = (d) => (d ? d.toISOString() : d);

function chain(value) {
    const q = { sort: () => q, lean: () => Promise.resolve(value), then: (r, j) => Promise.resolve(value).then(r, j) };
    return q;
}

describe('nextOccurrence', () => {
    it('daily / custom step by interval days', () => {
        expect(iso(nextOccurrence({ isRecurring: true, pattern: 'daily', interval: 1 }, D('2026-01-30T09:00:00Z')))).toBe('2026-01-31T09:00:00.000Z');
        expect(iso(nextOccurrence({ isRecurring: true, pattern: 'daily', interval: 3 }, D('2026-01-30T09:00:00Z')))).toBe('2026-02-02T09:00:00.000Z');
        expect(iso(nextOccurrence({ isRecurring: true, pattern: 'custom', interval: 10 }, D('2026-01-01T00:00:00Z')))).toBe('2026-01-11T00:00:00.000Z');
    });

    it('weekly honours the interval (it used to be ignored)', () => {
        expect(iso(nextOccurrence({ isRecurring: true, pattern: 'weekly', interval: 1 }, D('2026-10-05T09:00:00Z')))).toBe('2026-10-12T09:00:00.000Z');
        expect(iso(nextOccurrence({ isRecurring: true, pattern: 'weekly', interval: 2 }, D('2026-10-05T09:00:00Z')))).toBe('2026-10-19T09:00:00.000Z');
    });

    it('weekly on chosen weekdays, every N weeks', () => {
        const rule = { isRecurring: true, pattern: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] }; // Mon Wed Fri
        expect(iso(nextOccurrence(rule, D('2026-10-05T09:00:00Z')))).toBe('2026-10-07T09:00:00.000Z'); // Mon -> Wed
        expect(iso(nextOccurrence(rule, D('2026-10-09T09:00:00Z')))).toBe('2026-10-12T09:00:00.000Z'); // Fri -> Mon
        const biweekly = { ...rule, interval: 2, daysOfWeek: [1, 5] };
        expect(iso(nextOccurrence(biweekly, D('2026-10-05T09:00:00Z')))).toBe('2026-10-09T09:00:00.000Z'); // same week
        expect(iso(nextOccurrence(biweekly, D('2026-10-09T09:00:00Z')))).toBe('2026-10-19T09:00:00.000Z'); // skips a week
    });

    it('custom with weekdays repeats on those days every week', () => {
        const rule = { isRecurring: true, pattern: 'custom', interval: 5, daysOfWeek: [2, 4] };
        expect(iso(nextOccurrence(rule, D('2026-10-06T08:00:00Z')))).toBe('2026-10-08T08:00:00.000Z');
        expect(iso(nextOccurrence(rule, D('2026-10-08T08:00:00Z')))).toBe('2026-10-13T08:00:00.000Z');
    });

    it('monthly keeps the anchor day and clamps to short months', () => {
        const rule = { isRecurring: true, pattern: 'monthly', interval: 1, dayOfMonth: 31 };
        const feb = nextOccurrence(rule, D('2026-01-31T12:00:00Z'));
        expect(iso(feb)).toBe('2026-02-28T12:00:00.000Z');
        expect(iso(nextOccurrence(rule, feb))).toBe('2026-03-31T12:00:00.000Z');
        expect(iso(nextOccurrence({ ...rule, interval: 3, dayOfMonth: 15 }, D('2026-11-15T00:00:00Z')))).toBe('2027-02-15T00:00:00.000Z');
    });

    it('stops after the end date', () => {
        const rule = { isRecurring: true, pattern: 'daily', interval: 1, endDate: D('2026-01-02T00:00:00Z') };
        expect(nextOccurrence(rule, D('2026-01-01T09:00:00Z'))).toBeNull();
    });
});

describe('normalizeRecurring / recurringForTask', () => {
    it('validates input', () => {
        expect(() => normalizeRecurring({ pattern: 'yearly' })).toThrow(/pattern/);
        expect(() => normalizeRecurring({ pattern: 'daily', interval: 1.5 })).toThrow(/interval/);
        expect(() => normalizeRecurring({ pattern: 'daily', daysOfWeek: [1] })).toThrow(/daysOfWeek/);
        expect(() => normalizeRecurring({ pattern: 'weekly', daysOfWeek: [7] })).toThrow(/daysOfWeek/);
        expect(() => normalizeRecurring({ pattern: 'daily', endDate: 'x' })).toThrow(/endDate/);
        expect(() => normalizeRecurring({ pattern: 'daily', nextDue: '2026-02-01', endDate: '2026-01-01' })).toThrow(/endDate/);
        expect(normalizeRecurring(null)).toMatchObject({ isRecurring: false, nextDue: null });
        expect(normalizeRecurring({ isRecurring: false, pattern: 'daily' }).isRecurring).toBe(false);
    });

    it('starts after the task itself unless nextDue is given', () => {
        const due = '2026-10-05T09:00:00Z';
        expect(iso(recurringForTask({ pattern: 'daily' }, due).nextDue)).toBe('2026-10-06T09:00:00.000Z');
        expect(iso(recurringForTask({ pattern: 'daily', nextDue: due }, due).nextDue)).toBe('2026-10-05T09:00:00.000Z');
        // a weekday rule whose first slot is after the due date
        expect(iso(recurringForTask({ pattern: 'weekly', daysOfWeek: [5] }, due).nextDue)).toBe('2026-10-09T09:00:00.000Z');
        // an end date before the second occurrence: nothing more to generate
        expect(recurringForTask({ pattern: 'weekly', endDate: '2026-10-06T00:00:00Z' }, due).isRecurring).toBe(false);
    });
});

describe('planNextRun', () => {
    it('skips missed occurrences instead of flooding', () => {
        const rule = { isRecurring: true, pattern: 'daily', interval: 1, nextDue: D('2026-10-01T09:00:00Z') };
        const { occurrenceDue, recurring } = planNextRun(rule, D('2026-10-10T10:00:00Z'));
        expect(iso(occurrenceDue)).toBe('2026-10-01T09:00:00.000Z');
        expect(iso(recurring.nextDue)).toBe('2026-10-11T09:00:00.000Z');
    });

    it('ends the series at the end date', () => {
        const rule = { isRecurring: true, pattern: 'weekly', interval: 1, nextDue: D('2026-10-05T09:00:00Z'), endDate: D('2026-10-10T00:00:00Z') };
        const run = planNextRun(rule, D('2026-10-05T10:00:00Z'));
        expect(iso(run.occurrenceDue)).toBe('2026-10-05T09:00:00.000Z');
        expect(run.recurring).toMatchObject({ isRecurring: false, nextDue: null });
        expect(planNextRun({ ...rule, nextDue: D('2026-10-12T09:00:00Z') }).occurrenceDue).toBeNull();
    });
});

describe('recurring task generator (MongoDB)', () => {
    const series = () => ({
        _id: 'series1', workspace: 'ws1', company: 'c1', type: 'task', taskType: 'workspace', title: 'Standup notes',
        description: 'd', createdBy: 'u1', assignedTo: ['u2'], visibility: 'workspace', priority: 'high',
        estimatedHours: 1.5, milestoneId: 'm1', tags: ['ops'], labels: [],
        recurring: { isRecurring: true, pattern: 'weekly', interval: 1, daysOfWeek: [1, 4], nextDue: D('2026-10-05T09:00:00Z') },
    });

    beforeEach(() => {
        global.__saved = [];
        Task.updateOne.mockReset().mockResolvedValue({ modifiedCount: 1 });
        Task.find.mockReset();
    });

    it('creates the occurrence with copied fields and subtasks, and moves the rule forward', async () => {
        Task.find
            .mockReturnValueOnce(chain([series()]))
            .mockReturnValueOnce(chain([{ _id: 's1', type: 'subtask', title: 'Collect updates', assignedTo: ['u2'], dueDate: null, createdBy: 'u1', workspace: 'ws1' }]));
        const count = await runRecurringTaskJob(D('2026-10-05T10:00:00Z'));
        expect(count).toBe(1);

        const [claimFilter, claimUpdate] = Task.updateOne.mock.calls[0];
        expect(claimFilter).toEqual({ _id: 'series1', 'recurring.nextDue': D('2026-10-05T09:00:00Z') });
        expect(iso(claimUpdate.$set.recurring.nextDue)).toBe('2026-10-08T09:00:00.000Z'); // Mon -> Thu

        const [occurrence, subtask] = global.__saved;
        expect(occurrence).toMatchObject({
            title: 'Standup notes', status: 'todo', estimatedHours: 1.5, milestoneId: 'm1', issueKey: 'ACME-9',
            assignedTo: ['u2'], recurring: expect.objectContaining({ isRecurring: false }),
        });
        expect(iso(occurrence.dueDate)).toBe('2026-10-05T09:00:00.000Z');
        expect(subtask).toMatchObject({ type: 'subtask', parentTask: occurrence._id, title: 'Collect updates' });
        expect(Task.updateOne.mock.calls[1]).toEqual([{ _id: occurrence._id }, { $push: { subtasks: { $each: [subtask._id] } } }]);
    });

    it('does nothing when another run already claimed the occurrence', async () => {
        Task.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
        expect(await generateOccurrence(series(), D('2026-10-05T10:00:00Z'))).toBeNull();
        expect(global.__saved).toHaveLength(0);
    });

    it('turns the series off once the end date passed, without creating a task', async () => {
        const t = series();
        t.recurring.endDate = D('2026-10-01T00:00:00Z');
        expect(await generateOccurrence(t, D('2026-10-05T10:00:00Z'))).toBeNull();
        expect(Task.updateOne.mock.calls[0][1].$set.recurring).toMatchObject({ isRecurring: false, nextDue: null });
        expect(global.__saved).toHaveLength(0);
    });
});
