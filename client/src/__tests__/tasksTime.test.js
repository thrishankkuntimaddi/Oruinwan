import { describe, it, expect } from 'vitest';
import {
  blockedFromError, myOpenSession, othersRunning, parseDuration, logError, fmtHours, estimatePct, reportRange, reportRows, reportCsv,
} from '../utils/taskTime';

describe('blocked task errors', () => {
  it('reads a 409 TASK_BLOCKED answer', () => {
    const err = { response: { status: 409, data: { message: 'Blocked', code: 'TASK_BLOCKED', blockers: [{ _id: 'a', title: 'Design', issueKey: 'OR-1', status: 'in_progress' }] } } };
    expect(blockedFromError(err)).toEqual({ message: 'Blocked', blockers: [{ id: 'a', title: 'Design', issueKey: 'OR-1', status: 'in_progress' }] });
  });
  it('ignores other errors', () => {
    expect(blockedFromError({ response: { status: 409, data: { code: 'OTHER' } } })).toBeNull();
    expect(blockedFromError({ response: { status: 400, data: { code: 'TASK_BLOCKED' } } })).toBeNull();
    expect(blockedFromError(new Error('x'))).toBeNull();
  });
});

describe('timer sessions', () => {
  const sessions = [
    { start: '2026-10-21T08:00:00Z', end: '2026-10-21T09:00:00Z', user: 'u1' },
    { start: '2026-10-21T10:00:00Z', end: null, user: 'u2' },
    { start: '2026-10-21T10:05:00Z', end: null, user: { _id: 'u1' } },
  ];
  it('finds only my open session', () => {
    expect(myOpenSession(sessions, 'u1')).toBe(sessions[2]);
    expect(myOpenSession(sessions, 'u3')).toBeNull();
    expect(myOpenSession([{ start: 'x', end: null }], 'u3')).toEqual({ start: 'x', end: null }); // legacy, no user
    expect(myOpenSession(sessions, null)).toBe(sessions[2]);
  });
  it('lists other people running timers', () => {
    expect(othersRunning([{ userId: 'u1', running: true }, { userId: 'u2', running: true }, { userId: 'u3', running: false }], 'u1'))
      .toEqual([{ userId: 'u2', running: true }]);
  });
});

describe('durations', () => {
  it('parses what people type', () => {
    expect(parseDuration('90')).toBe(5400);
    expect(parseDuration('1h 30m')).toBe(5400);
    expect(parseDuration('1.5h')).toBe(5400);
    expect(parseDuration('45 min')).toBe(2700);
    expect(parseDuration('1:30')).toBe(5400);
    expect(parseDuration('20s')).toBe(20);
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('soon')).toBeNull();
    expect(parseDuration('1h potato')).toBeNull();
  });
  it('validates the server limits', () => {
    expect(logError(null)).toMatch(/duration/);
    expect(logError(0)).toMatch(/at least/);
    expect(logError(25 * 3600)).toMatch(/24 hours/);
    expect(logError(60)).toBeNull();
  });
  it('formats hours and estimate use', () => {
    expect(fmtHours(0)).toBe('0m');
    expect(fmtHours(3900)).toBe('1h 05m');
    expect(estimatePct(5400, 1)).toBe(150);
    expect(estimatePct(5400, 0)).toBe(0);
  });
});

describe('time report', () => {
  it('computes ranges', () => {
    const now = new Date(2026, 9, 21, 15, 0, 0); // Wednesday
    const week = reportRange('week', now);
    expect(new Date(week.from).getDay()).toBe(1);
    expect(new Date(week.from).getDate()).toBe(19);
    expect(new Date(reportRange('month', now).from).getDate()).toBe(1);
    expect(new Date(reportRange('7d', now).from).getDate()).toBe(15);
    expect(reportRange('all', now)).toEqual({ from: undefined, to: undefined });
  });
  it('sorts rows with shares and exports CSV', () => {
    const rows = reportRows([{ userId: 'a', seconds: 100 }, { userId: 'b', seconds: 300 }], 400);
    expect(rows.map((r) => [r.userId, r.share])).toEqual([['b', 75], ['a', 25]]);
    const csv = reportCsv({ byUser: [{ userId: 'a', seconds: 3600, tasks: 2, user: { username: 'ana' } }], byTask: [{ title: 'Say "hi"', issueKey: 'OR-1', seconds: 1800, estimatedHours: 1 }] });
    expect(csv).toContain('"ana",1.00,2');
    expect(csv).toContain('"Say ""hi""","OR-1",0.50,1');
  });
});
