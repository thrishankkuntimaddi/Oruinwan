'use strict';

const { findSlots, normalizeWorkingHours, localParts, isValidTimeZone } = require('../availability');

// 2026-10-19 is a Monday.
const MON = '2026-10-19T00:00:00.000Z';

describe('availability.findSlots', () => {
    test('first slot is the start of the working day in UTC', () => {
        const slots = findSlots({ attendees: [{ userId: 'a', timezone: 'UTC' }], durationMinutes: 60, from: MON, limit: 3 });
        expect(slots.map((s) => s.start)).toEqual([
            '2026-10-19T09:00:00.000Z', '2026-10-19T09:30:00.000Z', '2026-10-19T10:00:00.000Z',
        ]);
        expect(slots.every((s) => s.allAvailable && s.unavailable.length === 0)).toBe(true);
    });

    test('busy intervals are skipped', () => {
        const busy = [{ start: '2026-10-19T09:00:00Z', end: '2026-10-19T10:30:00Z' }];
        const [first] = findSlots({ attendees: [{ userId: 'a', timezone: 'UTC', busy }], durationMinutes: 30, from: MON, limit: 1 });
        expect(first.start).toBe('2026-10-19T10:30:00.000Z');
    });

    test('working hours are intersected across timezones', () => {
        const [first] = findSlots({
            attendees: [{ userId: 'london', timezone: 'UTC' }, { userId: 'ny', timezone: 'America/New_York' }],
            durationMinutes: 60, from: MON, limit: 1,
        });
        // New York (UTC-4 in October) opens at 13:00Z.
        expect(first.start).toBe('2026-10-19T13:00:00.000Z');
    });

    test('slots never run past the end of the working day', () => {
        const slots = findSlots({ attendees: [{ userId: 'a', timezone: 'UTC' }], durationMinutes: 60, from: '2026-10-19T16:45:00Z', limit: 3 });
        expect(slots[0].start).toBe('2026-10-19T17:00:00.000Z');
        expect(slots[1].start).toBe('2026-10-20T09:00:00.000Z');
    });

    test('weekends are skipped by default and custom days/hours are honoured', () => {
        const [weekday] = findSlots({ attendees: [{ userId: 'a', timezone: 'UTC' }], from: '2026-10-24T00:00:00Z', limit: 1 });
        expect(weekday.start).toBe('2026-10-26T09:00:00.000Z');
        const [saturday] = findSlots({
            attendees: [{ userId: 'a', timezone: 'UTC', workingHours: { start: '07:00', end: '12:00', days: [6] } }],
            from: '2026-10-19T00:00:00Z', limit: 1,
        });
        expect(saturday.start).toBe('2026-10-24T07:00:00.000Z');
    });

    test('auto/invalid timezones fall back to the caller timezone, then UTC', () => {
        const [a] = findSlots({ attendees: [{ userId: 'a', timezone: 'auto' }], from: MON, limit: 1, fallbackTimeZone: 'Asia/Kolkata' });
        expect(a.start).toBe('2026-10-19T03:30:00.000Z'); // 09:00 IST
        const [b] = findSlots({ attendees: [{ userId: 'a', timezone: 'Not/AZone' }], from: MON, limit: 1, fallbackTimeZone: 'nope' });
        expect(b.start).toBe('2026-10-19T09:00:00.000Z');
    });

    test('when no time suits everyone, partial slots list who is busy', () => {
        const allWeek = [{ start: '2026-10-19T00:00:00Z', end: '2026-10-26T00:00:00Z' }];
        const slots = findSlots({
            attendees: [{ userId: 'a', timezone: 'UTC' }, { userId: 'b', timezone: 'UTC', busy: allWeek }],
            from: MON, to: '2026-10-20T00:00:00Z', limit: 2,
        });
        expect(slots).toHaveLength(2);
        expect(slots[0]).toMatchObject({ allAvailable: false, availableCount: 1, attendeeCount: 2, unavailable: ['b'] });
    });

    test('limit and duration are clamped', () => {
        const slots = findSlots({ attendees: [{ userId: 'a', timezone: 'UTC' }], from: MON, limit: 500, durationMinutes: 1 });
        expect(slots.length).toBe(20);
        expect(new Date(slots[0].end) - new Date(slots[0].start)).toBe(5 * 60e3);
    });

    test('no attendees: default working hours in the fallback timezone', () => {
        const slots = findSlots({ attendees: [], from: MON, limit: 2 });
        expect(slots.map((s) => s.start)).toEqual(['2026-10-19T09:00:00.000Z', '2026-10-19T09:30:00.000Z']);
    });
});

describe('availability helpers', () => {
    test('normalizeWorkingHours defaults and rejects inverted ranges', () => {
        expect(normalizeWorkingHours()).toEqual({ startMin: 540, endMin: 1080, days: [1, 2, 3, 4, 5] });
        expect(normalizeWorkingHours({ start: '18:00', end: '09:00' })).toMatchObject({ startMin: 540, endMin: 1080 });
        expect(normalizeWorkingHours({ start: '08:30', end: '17:15', days: [0, 9, 'x', 3] })).toEqual({ startMin: 510, endMin: 1035, days: [0, 3] });
    });

    test('localParts and isValidTimeZone', () => {
        expect(localParts(new Date('2026-10-19T13:30:00Z'), 'America/New_York')).toEqual({ day: '2026-10-19', weekday: 1, minutes: 9 * 60 + 30 });
        expect(isValidTimeZone('Europe/Paris')).toBe(true);
        expect(isValidTimeZone('auto')).toBe(false);
        expect(isValidTimeZone('Mars/Base')).toBe(false);
    });
});
