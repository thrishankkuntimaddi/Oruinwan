'use strict';

const { buildTeamDelivery, weekWindows } = require('../teamDelivery');
const { buildActiveSeries, weekStartKey } = require('../activeDays');

// Wednesday 2026-10-21 12:00 UTC. Weeks start on Monday: 2026-10-19, 10-12, 10-05.
const NOW = new Date('2026-10-21T12:00:00Z');
const d = (s) => new Date(`${s}T10:00:00Z`);

describe('weekWindows / weekStartKey', () => {
    test('Monday-based UTC weeks, oldest first, last one contains now', () => {
        expect(weekStartKey(NOW)).toBe('2026-10-19');
        expect(weekStartKey(new Date('2026-10-19T00:00:00Z'))).toBe('2026-10-19');
        expect(weekStartKey(new Date('2026-10-18T23:59:59Z'))).toBe('2026-10-12');
        expect(weekWindows(3, NOW).map((w) => w.weekStart)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
    });
});

describe('buildTeamDelivery', () => {
    const teams = [
        { _id: 't1', name: 'Platform', members: [{ user: 'a' }, { user: 'b' }] },
        { _id: 't2', name: 'Design', members: [{ user: 'c' }, { user: 'b' }] },
    ];

    test('completed per week, cycle time, overdue trend and open workload per team', () => {
        const tasks = [
            // Platform: done this week after 48h.
            { _id: 1, assignedTo: ['a'], status: 'done', createdAt: d('2026-10-18'), completedAt: d('2026-10-20') },
            // Platform: done last week after 24h.
            { _id: 2, assignedTo: ['a'], status: 'done', createdAt: d('2026-10-13'), completedAt: d('2026-10-14') },
            // Shared by both teams (b is in both): counted once per team.
            { _id: 3, assignedTo: ['b'], status: 'done', createdAt: d('2026-10-12'), completedAt: d('2026-10-13') },
            // Design: open, due 2026-10-10 → overdue at the end of every week since.
            { _id: 4, assignedTo: ['c'], status: 'in_progress', createdAt: d('2026-10-01'), dueDate: d('2026-10-10') },
            // Design: completed late this week → overdue at end of weeks 10-05 (no: due 10-14) and 10-12.
            { _id: 5, assignedTo: ['c'], status: 'done', createdAt: d('2026-10-01'), dueDate: d('2026-10-14'), completedAt: d('2026-10-20') },
            // Nobody in a team.
            { _id: 6, assignedTo: ['z'], status: 'todo', createdAt: d('2026-10-15'), dueDate: d('2026-11-30') },
            { _id: 7, assignedTo: [], status: 'done', createdAt: d('2026-10-19'), completedAt: d('2026-10-19') },
        ];
        const r = buildTeamDelivery(teams, tasks, { weeks: 3, now: NOW });
        expect(r.weeks).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);

        const platform = r.teams.find((t) => t.name === 'Platform');
        expect(platform.memberCount).toBe(2);
        expect(platform.completedPerWeek).toEqual([0, 2, 1]);
        expect(platform.completed).toBe(3);
        expect(platform.avgCycleHours).toBe(32); // (48 + 24 + 24) / 3
        expect(platform.medianCycleHours).toBe(24);
        expect(platform.overduePerWeek).toEqual([0, 0, 0]);
        expect(platform.open).toBe(0);

        const design = r.teams.find((t) => t.name === 'Design');
        expect(design.completedPerWeek).toEqual([0, 1, 1]);
        expect(design.overduePerWeek).toEqual([1, 2, 1]);
        expect(design.open).toBe(1);
        expect(design.openOverdue).toBe(1);

        expect(r.unassigned.completed).toBe(1);
        expect(r.unassigned.open).toBe(1);
        expect(r.unassigned.openOverdue).toBe(0);
        expect(r.total.completed).toBe(5);
        // Sorted by completed, most first.
        expect(r.teams.map((t) => t.name)).toEqual(['Platform', 'Design']);
        // Team aggregates only: no member ids or names leak into the report.
        expect(JSON.stringify(r)).not.toMatch(/"a"|"b"|"c"/);
    });

    test('no teams and no tasks gives empty, zeroed output', () => {
        const r = buildTeamDelivery([], [], { weeks: 2, now: NOW });
        expect(r.teams).toEqual([]);
        expect(r.total).toMatchObject({ completed: 0, completedPerWeek: [0, 0], avgCycleHours: null, medianCycleHours: null });
    });

    test('a cancelled task stops counting as overdue after it was cancelled', () => {
        const tasks = [{ _id: 1, assignedTo: ['a'], status: 'cancelled', createdAt: d('2026-10-01'), dueDate: d('2026-10-06'), updatedAt: d('2026-10-15') }];
        const r = buildTeamDelivery(teams, tasks, { weeks: 3, now: NOW });
        expect(r.teams.find((t) => t.name === 'Platform').overduePerWeek).toEqual([1, 0, 0]);
    });
});

describe('buildActiveSeries', () => {
    test('distinct members per day and per week, zeros for quiet days', () => {
        const rows = [
            { user: 'a', day: '2026-10-21' }, { user: 'b', day: '2026-10-21' },
            { user: 'a', day: '2026-10-20' },
            { user: 'c', day: '2026-10-16' }, { user: 'a', day: '2026-10-13' },
        ];
        const { daily, weekly } = buildActiveSeries(rows, 10, NOW);
        expect(daily).toHaveLength(10);
        expect(daily[0].date).toBe('2026-10-12');
        expect(daily.at(-1)).toEqual({ date: '2026-10-21', active: 2 });
        expect(daily.find((x) => x.date === '2026-10-20').active).toBe(1);
        expect(daily.find((x) => x.date === '2026-10-14').active).toBe(0);
        expect(weekly).toEqual([{ weekStart: '2026-10-12', active: 2 }, { weekStart: '2026-10-19', active: 2 }]);
    });
});

describe('markActive', () => {
    test('skips without a company or a database connection, never throws', async () => {
        const { markActive, _resetForTests } = require('../activeDays');
        _resetForTests();
        await expect(markActive('u1', null)).resolves.toBe(false);
        await expect(markActive('u1', 'co')).resolves.toBe(false); // mongoose not connected in unit tests
    });
});
