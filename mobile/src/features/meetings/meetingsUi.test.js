import { describe, expect, it } from 'vitest';
import { applyBrainstormEvent, combineDateTime, meetingWhen } from './meetingsUi.js';
import { mapMeeting, workAdapter } from '../../data/live/adapter.work.js';

describe('brainstorm events', () => {
  const list = [{ id: 'a', text: 'one' }];
  const map = workAdapter.mapSticky;
  it('adds, updates and deletes notes', () => {
    const added = applyBrainstormEvent(list, { action: 'add', item: { _id: 'b', text: 'two', position: { x: 1, y: 2 } } }, map);
    expect(added.map((n) => n.id)).toEqual(['a', 'b']);
    expect(added[1]).toMatchObject({ x: 1, y: 2, color: '#FBBF24' });
    const again = applyBrainstormEvent(added, { action: 'add', item: { _id: 'b', text: 'two!' } }, map);
    expect(again).toHaveLength(2);
    expect(again[1].text).toBe('two!');
    expect(applyBrainstormEvent(again, { action: 'delete', itemId: 'a' }).map((n) => n.id)).toEqual(['b']);
    expect(applyBrainstormEvent(list, { action: 'noop' })).toBe(list);
  });
});

describe('meeting helpers', () => {
  it('combines a local date and time', () => {
    const iso = combineDateTime('2026-03-03', '10:30');
    const d = new Date(iso);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 2, 3, 10, 30]);
    expect(combineDateTime('', '10:00')).toBeNull();
  });
  it('labels running meetings as now', () => {
    const now = Date.parse('2026-03-03T10:10:00Z');
    expect(meetingWhen('2026-03-03T10:00:00Z', 30, now)).toBe('Now');
    expect(meetingWhen(null)).toBe('No time set');
  });
  it('maps a meeting with an end time and sorted agenda', () => {
    const m = mapMeeting({
      _id: 'm1', title: 'Sync', startTime: '2026-03-03T10:00:00.000Z', duration: 45,
      agenda: [{ _id: 'b', title: 'Second', order: 1 }, { _id: 'a', title: 'First', order: 0 }],
      actionItems: [{ _id: 'x', text: 'Ship', assignedTo: { _id: 'u1', username: 'sam' } }],
    });
    expect(m.end).toBe('2026-03-03T10:45:00.000Z');
    expect(m.agenda.map((a) => a.title)).toEqual(['First', 'Second']);
    expect(m.actionItems[0]).toMatchObject({ id: 'x', status: 'pending', assignee: { id: 'u1', name: 'sam' }, taskId: null });
  });
});
