import { describe, expect, test } from 'vitest';
import { groupActivity } from './activityGroups.js';

const dm = (id, at, extra = {}) => ({ id, type: 'dm', at, read: false, count: 1, target: { kind: 'dm', id: 'd1' }, ...extra });

describe('groupActivity', () => {
  test('folds unread rows of the same DM into the newest one', () => {
    const rows = groupActivity([dm('a', '2026-10-22T10:00:00Z'), dm('b', '2026-10-22T11:00:00Z')]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'b', count: 2 });
  });

  test('keeps different conversations, read and unread rows, and other kinds apart', () => {
    const rows = groupActivity([
      dm('a', '2026-10-22T10:00:00Z'),
      dm('b', '2026-10-22T09:00:00Z', { target: { kind: 'dm', id: 'd2' } }),
      dm('c', '2026-10-22T08:00:00Z', { read: true }),
      { id: 'h', type: 'meeting', at: '2026-10-22T07:00:00Z', count: 1, target: { kind: 'channel', id: 'c1' } },
      { id: 'h2', type: 'meeting', at: '2026-10-22T06:00:00Z', count: 1, target: { kind: 'channel', id: 'c1' } },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'h', 'h2']);
  });

  test('adds server counts together', () => {
    const rows = groupActivity([dm('a', '2026-10-22T10:00:00Z', { count: 3 }), dm('b', '2026-10-22T09:00:00Z', { count: 2 })]);
    expect(rows[0].count).toBe(5);
  });
});
