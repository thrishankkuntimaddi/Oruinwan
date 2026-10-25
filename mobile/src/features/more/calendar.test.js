import { describe, expect, it } from 'vitest';
import { calendarEvents, dayKey, eventsByDay, monthWeeks } from './calendar.js';

describe('Activity calendar', () => {
  const d = (day, h = 9) => new Date(2026, 9, day, h).toISOString();
  const events = calendarEvents({
    me: 'me',
    meetings: [
      { id: 'm1', kind: 'scheduled', title: 'Standup', start: d(26, 10), end: d(26, 10) },
      { id: 'h1', kind: 'huddle', title: 'Huddle', startedAt: d(25, 15) },
      { id: 'x', kind: 'scheduled', title: 'No time' },
    ],
    tasks: [
      { id: 't1', title: 'Ship', due: d(26, 0), status: 'todo', assigneeIds: ['me'] },
      { id: 't2', title: 'Done one', due: d(26, 0), status: 'done', assigneeIds: ['me'] },
      { id: 't3', title: 'Someone else', due: d(26, 0), status: 'todo', assigneeIds: ['ben'], createdBy: 'ben' },
    ],
    reminders: [{ id: 'r1', at: d(27, 8), note: 'Call Ana' }],
    noteReminders: [{ id: 'nr1', noteId: 'n1', noteTitle: 'Spec', remindAt: d(28, 9) }],
    scheduled: [{ id: 's1', sendAt: d(27, 18), text: 'Weekly update' }],
  });

  it('puts meetings, huddles, my open tasks, reminders and scheduled messages on their days', () => {
    // Not: a meeting without a time, a finished task, or someone else's task.
    expect(events.map((e) => e.id).sort()).toEqual(['m:h1', 'm:m1', 'n:nr1', 'r:r1', 's:s1', 't:t1']);
    expect(events.find((e) => e.id === 'n:nr1')).toMatchObject({ kind: 'reminder', title: 'Note: Spec', ref: { noteId: 'n1' } });
    const byDay = eventsByDay(events);
    expect(byDay.get(dayKey(d(26))).map((e) => e.kind)).toEqual(['task', 'meeting']);
    expect(byDay.get(dayKey(d(25))).map((e) => e.kind)).toEqual(['huddle']);
    expect(byDay.get(dayKey(d(27))).map((e) => e.kind)).toEqual(['reminder', 'scheduled']);
  });

  it('lays out a month Monday first', () => {
    const weeks = monthWeeks(2026, 9);
    expect(weeks[0].findIndex(Boolean)).toBe(3); // 1 October 2026 is a Thursday
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });
});
