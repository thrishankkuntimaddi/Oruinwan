'use strict';

const {
    parseInterval, parseCron, cronMatches, nextCronRun, latestCronRun, normalizeSchedule, dueSlot, previewRuns,
} = require('../automation.schedule');

const at = (iso) => new Date(iso);

describe('parseInterval', () => {
    test('simple intervals', () => {
        expect(parseInterval('15m')).toBe(15 * 60_000);
        expect(parseInterval('2h')).toBe(2 * 3_600_000);
        expect(parseInterval('1d')).toBe(86_400_000);
        expect(parseInterval('1D')).toBe(86_400_000);
        expect(parseInterval('0 9 * * *')).toBeNull();
        expect(parseInterval('')).toBeNull();
        expect(parseInterval(null)).toBeNull();
    });
});

describe('parseCron', () => {
    test('fields, lists, ranges, steps and names', () => {
        const c = parseCron('*/15 9-17 * JAN,mar MON-FRI');
        expect([...c.minute]).toEqual([0, 15, 30, 45]);
        expect([...c.hour]).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
        expect([...c.month]).toEqual([1, 3]);
        expect([...c.dayOfWeek]).toEqual([1, 2, 3, 4, 5]);
        expect(c.domRestricted).toBe(false);
        expect(c.dowRestricted).toBe(true);
    });

    test('7 means Sunday and range steps work', () => {
        expect([...parseCron('0 0 * * 7').dayOfWeek]).toEqual([0]);
        expect([...parseCron('0-30/10 * * * *').minute]).toEqual([0, 10, 20, 30]);
        expect([...parseCron('5/20 * * * *').minute]).toEqual([5, 25, 45]);
    });

    test('macros', () => {
        expect([...parseCron('@hourly').minute]).toEqual([0]);
        expect([...parseCron('@weekly').dayOfWeek]).toEqual([0]);
        expect([...parseCron('@yearly').month]).toEqual([1]);
    });

    test.each([
        ['* * * *', /5 fields/],
        ['60 * * * *', /out of range/],
        ['* 24 * * *', /out of range/],
        ['* * 0 * *', /out of range/],
        ['* * * 13 *', /out of range/],
        ['*/0 * * * *', /Invalid step/],
        ['5-1 * * * *', /Invalid range/],
        ['a * * * *', /Invalid minute/],
        ['@sometimes', /Unknown cron macro/],
        ['1,,2 * * * *', /Empty list/],
    ])('rejects %s', (expr, msg) => {
        expect(() => parseCron(expr)).toThrow(msg);
    });
});

describe('matching and next run', () => {
    test('matches in UTC', () => {
        const c = parseCron('30 9 * * 1-5');
        expect(cronMatches(c, at('2026-10-19T09:30:00Z'))).toBe(true); // Monday
        expect(cronMatches(c, at('2026-10-18T09:30:00Z'))).toBe(false); // Sunday
        expect(cronMatches(c, at('2026-10-19T09:31:00Z'))).toBe(false);
    });

    test('day-of-month OR day-of-week when both are restricted', () => {
        const c = parseCron('0 0 1 * MON');
        expect(cronMatches(c, at('2026-10-01T00:00:00Z'))).toBe(true); // Thursday the 1st
        expect(cronMatches(c, at('2026-10-05T00:00:00Z'))).toBe(true); // a Monday
        expect(cronMatches(c, at('2026-10-06T00:00:00Z'))).toBe(false);
    });

    test('timezones', () => {
        const c = parseCron('0 9 * * *');
        // 09:00 in Kolkata (UTC+5:30) is 03:30 UTC.
        expect(cronMatches(c, at('2026-10-19T03:30:00Z'), 'Asia/Kolkata')).toBe(true);
        expect(cronMatches(c, at('2026-10-19T09:00:00Z'), 'Asia/Kolkata')).toBe(false);
        expect(nextCronRun(c, at('2026-10-19T04:00:00Z'), 'Asia/Kolkata').toISOString()).toBe('2026-10-20T03:30:00.000Z');
    });

    test('nextCronRun is strictly after `from`', () => {
        expect(nextCronRun('30 9 * * 1-5', at('2026-10-19T09:30:00Z')).toISOString()).toBe('2026-10-20T09:30:00.000Z');
        expect(nextCronRun('30 9 * * 1-5', at('2026-10-23T10:00:00Z')).toISOString()).toBe('2026-10-26T09:30:00.000Z'); // Fri → Mon
        expect(nextCronRun('0 0 29 2 *', at('2026-03-01T00:00:00Z')).toISOString()).toBe('2028-02-29T00:00:00.000Z');
        expect(nextCronRun('*/15 * * * *', at('2026-10-19T09:07:42Z')).toISOString()).toBe('2026-10-19T09:15:00.000Z');
    });

    test('latestCronRun looks back for a missed slot but not before `after`', () => {
        const now = at('2026-10-19T09:32:10Z');
        expect(latestCronRun('30 9 * * *', now).toISOString()).toBe('2026-10-19T09:30:00.000Z');
        expect(latestCronRun('30 9 * * *', now, 'UTC', { after: at('2026-10-19T09:30:00Z') })).toBeNull();
        expect(latestCronRun('0 3 * * *', now)).toBeNull(); // more than an hour ago
    });
});

describe('normalizeSchedule', () => {
    test('intervals and cron, including cron sent with type interval', () => {
        expect(normalizeSchedule({ expression: '2h' })).toEqual({ type: 'interval', expression: '2h', timezone: 'UTC' });
        expect(normalizeSchedule({ type: 'interval', expression: '0 9 * * *' })).toEqual({ type: 'cron', expression: '0 9 * * *', timezone: 'UTC' });
        expect(normalizeSchedule({ type: 'cron', expression: '@daily', timezone: 'Europe/Berlin' }).type).toBe('cron');
        expect(normalizeSchedule(null)).toBeNull();
    });

    test('rejects bad input with 400', () => {
        expect(() => normalizeSchedule({ expression: '1m' })).toThrow(/at least 5m/);
        expect(() => normalizeSchedule({ expression: '0 25 * * *' })).toThrow(/Invalid schedule/);
        expect(() => normalizeSchedule({ expression: '0 9 * * *', timezone: 'Mars/Base' })).toThrow(/Unknown timezone/);
        try { normalizeSchedule({ expression: '' }); } catch (err) { expect(err.statusCode).toBe(400); }
    });
});

describe('dueSlot', () => {
    test('interval', () => {
        const now = at('2026-10-19T12:00:00Z');
        expect(dueSlot({ type: 'interval', expression: '1h' }, { lastRunAt: at('2026-10-19T10:59:00Z'), now })).not.toBeNull();
        expect(dueSlot({ type: 'interval', expression: '1h' }, { lastRunAt: at('2026-10-19T11:30:00Z'), now })).toBeNull();
        expect(dueSlot({ type: 'interval', expression: '1h' }, { lastRunAt: null, now })).not.toBeNull();
    });

    test('cron runs once per slot', () => {
        const s = { type: 'cron', expression: '30 9 * * *', timezone: 'UTC' };
        const now = at('2026-10-19T09:30:20Z');
        const slot = dueSlot(s, { lastRunAt: at('2026-10-18T09:30:05Z'), now });
        expect(slot.toISOString()).toBe('2026-10-19T09:30:00.000Z');
        expect(dueSlot(s, { lastRunAt: at('2026-10-19T09:30:20Z'), now: at('2026-10-19T09:31:00Z') })).toBeNull();
        // Not before the automation existed.
        expect(dueSlot(s, { createdAt: at('2026-10-19T09:31:00Z'), now: at('2026-10-19T09:40:00Z') })).toBeNull();
    });
});

describe('previewRuns', () => {
    test('cron and interval previews', () => {
        const from = at('2026-10-19T08:00:00Z');
        expect(previewRuns({ expression: '0 9 * * 1-5' }, { count: 3, from }).map((d) => d.toISOString()))
            .toEqual(['2026-10-19T09:00:00.000Z', '2026-10-20T09:00:00.000Z', '2026-10-21T09:00:00.000Z']);
        expect(previewRuns({ expression: '2h' }, { count: 2, from }).map((d) => d.toISOString()))
            .toEqual(['2026-10-19T08:00:00.000Z', '2026-10-19T10:00:00.000Z']);
    });
});
