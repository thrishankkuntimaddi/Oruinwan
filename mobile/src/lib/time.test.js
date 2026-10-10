import { dueLabel, shortAgo, toDate } from './time.js';

const NOW = new Date(2026, 9, 10, 15, 0).getTime();
const day = 24 * 60 * 60 * 1000;

describe('time helpers', () => {
  // Regression: a task without a due date (null from the server) showed "20736d overdue".
  it('treats null, undefined and empty values as no date', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate('')).toBeNull();
    expect(dueLabel(null, NOW)).toBeNull();
    expect(shortAgo(null, NOW)).toBe('');
  });

  it('labels due dates relative to today', () => {
    expect(dueLabel(NOW + 2 * 60 * 60 * 1000, NOW)).toEqual({ text: 'Today', tone: 'today' });
    expect(dueLabel(NOW + day, NOW).tone).toBe('soon');
    expect(dueLabel(NOW - 3 * day, NOW)).toEqual({ text: '3d overdue', tone: 'overdue' });
  });
});
