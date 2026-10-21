import { describe, it, expect } from 'vitest';
import {
    toRecurringPayload, fromRecurring, nextOccurrence, describeRule, describeRecurring, dayValue, dayString,
    normalizeRule, isRecurring, sameRecurring,
} from '../utils/taskRecurrence';

const day = (s) => dayValue(s);
const next = (rule, from) => {
    const ts = nextOccurrence(rule, day(from));
    return ts == null ? null : dayString(ts);
};

describe('taskRecurrence: next occurrence', () => {
    it('daily and custom-days step by the interval', () => {
        expect(next({ frequency: 'daily' }, '2026-10-21')).toBe('2026-10-22');
        expect(next({ frequency: 'custom', unit: 'day', interval: 3 }, '2026-10-21')).toBe('2026-10-24');
    });

    it('weekly without days repeats on the same weekday', () => {
        expect(next({ frequency: 'weekly' }, '2026-10-21')).toBe('2026-10-28');
        expect(next({ frequency: 'weekly', interval: 2 }, '2026-10-21')).toBe('2026-11-04');
    });

    it('weekly with days picks the next chosen weekday', () => {
        // 2026-10-21 is a Wednesday (3). Mon/Fri -> Friday the 23rd.
        expect(next({ frequency: 'weekly', daysOfWeek: [1, 5] }, '2026-10-21')).toBe('2026-10-23');
        // From Friday -> next Monday.
        expect(next({ frequency: 'weekly', daysOfWeek: [1, 5] }, '2026-10-23')).toBe('2026-10-26');
        // Every 2 weeks on Monday, from Friday of week 0 -> Monday of week 2.
        expect(next({ frequency: 'weekly', interval: 2, daysOfWeek: [1] }, '2026-10-23')).toBe('2026-11-02');
    });

    it('monthly keeps the day of month and clamps short months', () => {
        expect(next({ frequency: 'monthly' }, '2026-10-21')).toBe('2026-11-21');
        expect(next({ frequency: 'monthly' }, '2027-01-31')).toBe('2027-02-28');
        expect(next({ frequency: 'custom', unit: 'month', interval: 3 }, '2026-10-21')).toBe('2027-01-21');
    });

    it('stops after the end date', () => {
        expect(next({ frequency: 'daily', endDate: '2026-10-21' }, '2026-10-21')).toBeNull();
        expect(next({ frequency: 'daily', endDate: '2026-10-22' }, '2026-10-21')).toBe('2026-10-22');
    });

    it('none never repeats', () => {
        expect(next({ frequency: 'none' }, '2026-10-21')).toBeNull();
    });
});

describe('taskRecurrence: server payload round trip', () => {
    it('builds the recurring field anchored on the due date', () => {
        const p = toRecurringPayload({ frequency: 'weekly', daysOfWeek: [1, 3], endDate: '2026-12-31' }, { dueDate: '2026-10-21T00:00:00.000Z' });
        expect(p).toEqual({
            isRecurring: true, pattern: 'weekly', interval: 1, daysOfWeek: [1, 3],
            endDate: '2026-12-31T00:00:00.000Z', nextDue: '2026-10-26T00:00:00.000Z',
        });
    });

    it('falls back to today when there is no due date', () => {
        const p = toRecurringPayload({ frequency: 'daily' }, { today: new Date('2026-10-21T15:00:00') });
        expect(p.pattern).toBe('daily');
        expect(p.nextDue).toBe('2026-10-22T00:00:00.000Z');
    });

    it('maps custom units onto server patterns (custom = every N days)', () => {
        expect(toRecurringPayload({ frequency: 'custom', unit: 'day', interval: 4 }, { dueDate: '2026-10-21' })).toMatchObject({ pattern: 'custom', interval: 4 });
        expect(toRecurringPayload({ frequency: 'custom', unit: 'week', interval: 2 }, { dueDate: '2026-10-21' })).toMatchObject({ pattern: 'weekly', interval: 2 });
        expect(toRecurringPayload({ frequency: 'custom', unit: 'month', interval: 6 }, { dueDate: '2026-10-21' })).toMatchObject({ pattern: 'monthly', interval: 6 });
    });

    it("'none' turns repeating off", () => {
        expect(toRecurringPayload({ frequency: 'none' })).toMatchObject({ isRecurring: false, pattern: null, nextDue: null });
    });

    it('reads the server field back into a picker rule', () => {
        expect(fromRecurring(null).frequency).toBe('none');
        expect(fromRecurring({ isRecurring: false, pattern: 'daily' }).frequency).toBe('none');
        expect(fromRecurring({ isRecurring: true, pattern: 'daily', interval: 1 }).frequency).toBe('daily');
        expect(fromRecurring({ isRecurring: true, pattern: 'daily', interval: 3 })).toMatchObject({ frequency: 'custom', unit: 'day', interval: 3 });
        expect(fromRecurring({ isRecurring: true, pattern: 'weekly', interval: 2, daysOfWeek: [5, 1], endDate: '2026-12-31T00:00:00.000Z' }))
            .toMatchObject({ frequency: 'weekly', interval: 2, daysOfWeek: [1, 5], endDate: '2026-12-31' });
        expect(fromRecurring({ isRecurring: true, pattern: 'custom', interval: 10 })).toMatchObject({ frequency: 'custom', unit: 'day', interval: 10 });
    });

    it('round-trips and compares schedules', () => {
        const rule = normalizeRule({ frequency: 'monthly', interval: 2, endDate: '2027-06-30' });
        const payload = toRecurringPayload(rule, { dueDate: '2026-10-21' });
        expect(fromRecurring(payload)).toEqual(rule);
        expect(sameRecurring(payload, { ...payload, nextDue: null })).toBe(true);
        expect(sameRecurring(payload, null)).toBe(false);
        expect(isRecurring({ recurring: payload })).toBe(true);
        expect(isRecurring({ recurring: null })).toBe(false);
    });
});

describe('taskRecurrence: labels', () => {
    it('describes rules in plain words', () => {
        expect(describeRule({ frequency: 'none' })).toBe("Doesn't repeat");
        expect(describeRule({ frequency: 'daily' })).toBe('Every day');
        expect(describeRule({ frequency: 'weekly', daysOfWeek: [1, 3] })).toBe('Weekly on Mon, Wed');
        expect(describeRule({ frequency: 'weekly', interval: 2 })).toBe('Every 2 weeks');
        expect(describeRule({ frequency: 'monthly' })).toBe('Monthly');
        expect(describeRule({ frequency: 'custom', unit: 'day', interval: 5 })).toBe('Every 5 days');
        expect(describeRule({ frequency: 'daily', endDate: '2026-12-31' })).toMatch(/^Every day until /);
        expect(describeRecurring({ isRecurring: true, pattern: 'monthly', interval: 3 })).toBe('Every 3 months');
    });
});
