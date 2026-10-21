import { describe, expect, it } from 'vitest';
import { dayString, dayValue, describeRecurring, describeRule, fromRecurring, nextOccurrence, toRecurringPayload } from './recurrence.js';
import { minutesFrom, myOpenSession, openSprints, recurrenceLabel } from './planning.js';

const next = (rule, from) => {
  const ts = nextOccurrence(rule, dayValue(from));
  return ts == null ? null : dayString(ts);
};

describe('repeat rules', () => {
  it('finds the next occurrence', () => {
    expect(next({ frequency: 'daily' }, '2026-10-21')).toBe('2026-10-22');
    expect(next({ frequency: 'custom', unit: 'day', interval: 3 }, '2026-10-21')).toBe('2026-10-24');
    // 2026-10-21 is a Wednesday: Mon/Fri → Friday.
    expect(next({ frequency: 'weekly', daysOfWeek: [1, 5] }, '2026-10-21')).toBe('2026-10-23');
    expect(next({ frequency: 'weekly', interval: 2, daysOfWeek: [1] }, '2026-10-23')).toBe('2026-11-02');
    expect(next({ frequency: 'monthly' }, '2027-01-31')).toBe('2027-02-28');
    expect(next({ frequency: 'daily', endDate: '2026-10-21' }, '2026-10-21')).toBeNull();
  });

  it('builds the server payload (custom weeks are weekly + interval)', () => {
    const p = toRecurringPayload({ frequency: 'weekly', interval: 2, daysOfWeek: [3, 1], endDate: '2026-12-31' }, { dueDate: '2026-10-21' });
    expect(p).toEqual({ isRecurring: true, pattern: 'weekly', interval: 2, daysOfWeek: [1, 3], endDate: '2026-12-31T00:00:00.000Z', nextDue: '2026-11-02T00:00:00.000Z' });
    expect(toRecurringPayload({ frequency: 'custom', unit: 'month', interval: 3 }, { dueDate: '2026-10-21' })).toMatchObject({ pattern: 'monthly', interval: 3 });
    expect(toRecurringPayload({ frequency: 'none' }).isRecurring).toBe(false);
  });

  it('reads a task rule back and describes it', () => {
    expect(fromRecurring({ isRecurring: true, pattern: 'daily', interval: 4 })).toMatchObject({ frequency: 'custom', unit: 'day', interval: 4 });
    expect(describeRule({ frequency: 'weekly', interval: 2, daysOfWeek: [1, 3] })).toBe('Every 2 weeks on Mon, Wed');
    expect(describeRule({ frequency: 'none' })).toBe("Doesn't repeat");
    expect(describeRecurring({ isRecurring: true, pattern: 'monthly', interval: 1, endDate: '2026-12-31' })).toMatch(/^Monthly until .*2026$/);
    expect(recurrenceLabel(null)).toBe('Does not repeat');
    expect(recurrenceLabel({ pattern: 'daily', interval: 1 })).toBe('Every day');
  });
});

describe('time helpers', () => {
  it('finds my own running timer', () => {
    const tt = {
      sessions: [
        { start: '2026-01-01T09:00:00Z', end: null, user: 'u2' },
        { start: '2026-01-01T10:00:00Z', end: null, user: { _id: 'me' } },
      ],
    };
    expect(myOpenSession(tt, 'me').start).toBe('2026-01-01T10:00:00Z');
    expect(myOpenSession({ sessions: [{ start: 'x', end: null, user: 'u2' }] }, 'me')).toBeNull();
    // Old sessions without a user count as mine when it is the only open one.
    expect(myOpenSession({ sessions: [{ start: 'x', end: null }] }, 'me')).toEqual({ start: 'x', end: null });
    expect(myOpenSession(undefined, 'me')).toBeNull();
  });

  it('turns hours and minutes into loggable minutes', () => {
    expect(minutesFrom('1', '30')).toBe(90);
    expect(minutesFrom('', '0')).toBeNull();
    expect(minutesFrom('25', '0')).toBeNull();
    expect(minutesFrom('0.5', '')).toBe(30);
  });

  it('offers open sprints, active first', () => {
    const list = openSprints([
      { id: 'a', status: 'completed' },
      { id: 'b', status: 'planning', start: '2026-02-01' },
      { id: 'c', status: 'active', start: '2026-01-01' },
    ]);
    expect(list.map((s) => s.id)).toEqual(['c', 'b']);
  });
});
