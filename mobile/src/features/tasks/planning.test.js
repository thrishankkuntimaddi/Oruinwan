import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration, milestoneProgress, recurrenceLabel, sprintBoard, timelineRows, workloadBars } from './planning.js';
import { normalizeSlots, trackedSeconds, mapPlanningTask } from '../../data/live/adapter.work.js';

describe('time', () => {
  it('formats durations and clocks', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(59)).toBe('59s');
    expect(formatDuration(3725)).toBe('1h 2m');
    expect(formatClock(125)).toBe('2:05');
    expect(formatClock(3725)).toBe('1:02:05');
  });
  it('adds a running session to the total', () => {
    const now = Date.parse('2026-01-01T10:10:00Z');
    expect(trackedSeconds({ totalTime: 100, sessions: [{ start: '2026-01-01T09:00:00Z', end: '2026-01-01T09:01:40Z' }] }, now)).toBe(100);
    expect(trackedSeconds({ totalTime: 100, sessions: [{ start: '2026-01-01T10:00:00Z', end: null }] }, now)).toBe(700);
    expect(trackedSeconds(undefined, now)).toBe(0);
  });
});

describe('mapPlanningTask', () => {
  it('maps planning fields', () => {
    const t = mapPlanningTask({
      _id: 't1', title: 'A', status: 'todo', sprintId: 's1', milestoneId: { _id: 'm1' }, dependencies: ['t2'],
      subtasks: [{ _id: 'c1', title: 'Sub', status: 'done' }, 'raw-id'],
      linkedIssues: [{ _id: 'l1', task: { _id: 't3', title: 'B', status: 'done' }, linkType: 'blocks' }],
      timeTracking: { totalTime: 60, sessions: [{ start: '2026-01-01T00:00:00Z' }] },
      recurring: { isRecurring: true, pattern: 'weekly', interval: 1 },
    });
    expect(t.sprintId).toBe('s1');
    expect(t.milestoneId).toBe('m1');
    expect(t.subtasks).toEqual([{ id: 'c1', title: 'Sub', status: 'done', assigneeIds: [] }]);
    expect(t.links[0]).toMatchObject({ id: 'l1', taskId: 't3', type: 'blocks' });
    expect(t.time.runningSince).toBe('2026-01-01T00:00:00Z');
    expect(recurrenceLabel(t.recurring)).toBe('Every week');
  });
});

describe('suggest-time slots', () => {
  it('accepts a single slot', () => {
    const slots = normalizeSlots({ suggestedStart: '2026-01-01T10:00:00Z', suggestedEnd: '2026-01-01T10:30:00Z', durationMinutes: 30, note: 'Next' });
    expect(slots).toEqual([{ start: '2026-01-01T10:00:00.000Z', end: '2026-01-01T10:30:00.000Z', minutes: 30, note: 'Next' }]);
  });
  it('accepts arrays and fills missing ends', () => {
    expect(normalizeSlots([{ start: '2026-01-01T10:00:00Z', duration: 45 }, { bogus: true }])).toEqual([
      { start: '2026-01-01T10:00:00.000Z', end: '2026-01-01T10:45:00.000Z', minutes: 45, note: null },
    ]);
    expect(normalizeSlots({ slots: [{ startTime: '2026-01-01T09:00:00Z' }] })).toHaveLength(1);
    expect(normalizeSlots(null)).toEqual([]);
  });
});

describe('boards', () => {
  const tasks = [
    { id: 'a', sprintId: 's', status: 'backlog' },
    { id: 'b', sprintId: 's', status: 'done', milestoneId: 'm' },
    { id: 'c', sprintId: 'x', status: 'todo', milestoneId: 'm' },
    { id: 'd', sprintId: 's', status: 'cancelled' },
  ];
  it('groups a sprint by status', () => {
    const board = sprintBoard(tasks, 's');
    expect(board.find((c) => c.status === 'todo').items.map((t) => t.id)).toEqual(['a']);
    expect(board.find((c) => c.status === 'done').items.map((t) => t.id)).toEqual(['b']);
    expect(board.flatMap((c) => c.items)).toHaveLength(2);
  });
  it('computes milestone progress', () => {
    expect(milestoneProgress({ id: 'm' }, tasks)).toEqual({ total: 2, done: 1, percent: 50 });
    expect(milestoneProgress({ id: 'm', counts: { total: 4, done: 1 } }, tasks)).toEqual({ total: 4, done: 1, percent: 25 });
  });
  it('scales workload bars', () => {
    expect(workloadBars([{ count: 4 }, { count: 1 }]).map((w) => w.percent)).toEqual([100, 25]);
  });
});

describe('timelineRows', () => {
  const now = new Date(2026, 0, 10, 12).getTime();
  it('places bars inside the range', () => {
    const { rows, days } = timelineRows(
      [
        { id: 'a', due: new Date(2026, 0, 12).toISOString(), start: new Date(2026, 0, 8).toISOString() },
        { id: 'b', due: new Date(2026, 0, 30).toISOString() },
        { id: 'c' },
      ],
      { now },
    );
    expect(rows.map((r) => r.task.id)).toEqual(['a', 'b']);
    expect(days).toBeGreaterThanOrEqual(14);
    for (const r of rows) {
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.left + r.width).toBeLessThanOrEqual(100.0001);
    }
  });
  it('is empty without due dates', () => {
    expect(timelineRows([{ id: 'x' }], { now }).rows).toEqual([]);
  });
});
