import {
    formatDate, formatTime, formatDateTime, formatDayHeading, dayKey, isDateOnly, resolveTimeZone, zoneOffsetLabel,
} from '../utils/userDateFormat';
import { normalizePreferences } from '../hooks/useUserPreferences';

// 2026-09-28 21:05:00 UTC — still the 28th in New York, already the 29th in Kolkata.
const T = '2026-09-28T21:05:00.000Z';
const utc = (extra = {}) => ({ timezone: 'UTC', dateFormat: 'MM/DD/YYYY', timeFormat: '12h', ...extra });

describe('formatDate', () => {
    it('writes each date pattern', () => {
        expect(formatDate(T, utc())).toBe('09/28/2026');
        expect(formatDate(T, utc({ dateFormat: 'DD/MM/YYYY' }))).toBe('28/09/2026');
        expect(formatDate(T, utc({ dateFormat: 'YYYY-MM-DD' }))).toBe('2026-09-28');
        expect(formatDate(T, utc({ dateFormat: 'DD MMM YYYY' }))).toBe('28 Sep 2026');
    });

    it('has a compact form without the year', () => {
        expect(formatDate(T, utc(), { year: false })).toBe('Sep 28');
        expect(formatDate(T, utc({ dateFormat: 'DD/MM/YYYY' }), { year: false })).toBe('28 Sep');
        expect(formatDate(T, utc({ dateFormat: 'YYYY-MM-DD' }), { year: false })).toBe('09-28');
    });

    it('uses the chosen time zone for the calendar day', () => {
        expect(formatDate(T, utc({ timezone: 'America/New_York' }))).toBe('09/28/2026');
        expect(formatDate(T, utc({ timezone: 'Asia/Kolkata' }))).toBe('09/29/2026');
    });

    it('keeps the calendar day of date-only (UTC midnight) values in any zone', () => {
        const due = '2026-10-05T00:00:00.000Z';
        expect(isDateOnly(due)).toBe(true);
        expect(isDateOnly(T)).toBe(false);
        expect(formatDate(due, utc({ timezone: 'America/Los_Angeles' }), { dateOnly: true })).toBe('10/05/2026');
        expect(formatDate(due, utc({ timezone: 'America/Los_Angeles' }))).toBe('10/04/2026');
    });

    it('accepts the whole preferences object and falls back to defaults', () => {
        expect(formatDate(T, { region: utc({ dateFormat: 'YYYY-MM-DD' }) })).toBe('2026-09-28');
        expect(formatDate(T, { timezone: 'UTC', dateFormat: 'bogus' })).toBe('09/28/2026');
    });

    it('returns an empty string for missing or invalid dates', () => {
        expect(formatDate(null, utc())).toBe('');
        expect(formatDate('not a date', utc())).toBe('');
        expect(formatTime(undefined, utc())).toBe('');
        expect(formatDateTime('', utc())).toBe('');
    });
});

describe('formatTime', () => {
    it('writes 12-hour and 24-hour clocks', () => {
        expect(formatTime(T, utc())).toBe('9:05 PM');
        expect(formatTime(T, utc({ timeFormat: '24h' }))).toBe('21:05');
        expect(formatTime('2026-09-28T00:07:00Z', utc({ timeFormat: '24h' }))).toBe('00:07');
    });

    it('converts to the chosen zone', () => {
        expect(formatTime(T, utc({ timezone: 'Asia/Kolkata', timeFormat: '24h' }))).toBe('02:35');
        expect(formatTime(T, utc({ timezone: 'America/New_York' }))).toBe('5:05 PM');
    });
});

describe('formatDateTime / formatDayHeading / dayKey', () => {
    it('combines date and time', () => {
        expect(formatDateTime(T, utc({ dateFormat: 'DD MMM YYYY', timeFormat: '24h' }))).toBe('28 Sep 2026, 21:05');
    });

    it('writes day headings in the chosen order', () => {
        expect(formatDayHeading(T, utc())).toBe('Monday, September 28, 2026');
        expect(formatDayHeading(T, utc({ dateFormat: 'DD/MM/YYYY' }))).toBe('Monday, 28 September 2026');
        expect(formatDayHeading(T, utc({ dateFormat: 'YYYY-MM-DD' }))).toBe('Monday, 2026-09-28');
        expect(formatDayHeading(T, utc({ timezone: 'Asia/Kolkata' }))).toBe('Tuesday, September 29, 2026');
    });

    it('groups by calendar day in the chosen zone', () => {
        expect(dayKey(T, utc())).toBe('2026-09-28');
        expect(dayKey(T, utc({ timezone: 'Asia/Kolkata' }))).toBe('2026-09-29');
    });
});

describe('time zones', () => {
    it("treats 'auto' and unknown zones as the browser's zone", () => {
        expect(resolveTimeZone('auto')).toBeUndefined();
        expect(resolveTimeZone('Mars/Olympus_Mons')).toBeUndefined();
        expect(resolveTimeZone('Europe/Berlin')).toBe('Europe/Berlin');
        expect(() => formatTime(T, { timezone: 'Mars/Olympus_Mons' })).not.toThrow();
    });

    it('labels offsets', () => {
        expect(zoneOffsetLabel('Asia/Kolkata', new Date(T))).toBe('GMT+5:30');
    });
});

describe('normalizePreferences', () => {
    it('fills in defaults and keeps saved values', () => {
        const p = normalizePreferences({ privacy: { typingIndicators: false }, region: { timeFormat: '24h' }, appearance: { textSize: 'huge' } });
        expect(p.privacy).toEqual({ readReceipts: true, typingIndicators: false, allowDiscovery: true });
        expect(p.region).toEqual({ language: 'en', timezone: 'auto', dateFormat: 'MM/DD/YYYY', timeFormat: '24h' });
        expect(p.appearance.textSize).toBe('default');
        expect(normalizePreferences(null).privacy.readReceipts).toBe(true);
    });
});
