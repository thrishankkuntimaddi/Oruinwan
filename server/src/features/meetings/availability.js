'use strict';

/**
 * Meeting time finder (pure, no I/O). Given each attendee's busy intervals,
 * timezone and working hours, returns the earliest slots where everybody is
 * free inside their own working day. When no slot fits everyone, the best
 * partial slots (most attendees free) are returned instead, flagged with
 * `allAvailable: false` and the ids of the people who are busy.
 *
 * Working hours default to 09:00–18:00, Monday–Friday, in the attendee's
 * timezone (UTC when unknown or 'auto').
 */

const DEFAULT_WORKING_HOURS = Object.freeze({ start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] });
const MINUTE = 60 * 1000;
const MAX_CANDIDATES = 7 * 24 * 4 * 2; // two weeks at 15-minute steps

function isValidTimeZone(tz) {
    if (!tz || typeof tz !== 'string' || tz === 'auto') return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

function parseHm(value, fallback) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
    if (!m) return fallback;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 24 || min > 59 || (h === 24 && min > 0)) return fallback;
    return h * 60 + min;
}

/** Normalised { startMin, endMin, days } from a stored { start: 'HH:MM', end, days }. */
function normalizeWorkingHours(wh) {
    const startMin = parseHm(wh?.start, 9 * 60);
    const endMin = parseHm(wh?.end, 18 * 60);
    const days = Array.isArray(wh?.days) && wh.days.length
        ? wh.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : DEFAULT_WORKING_HOURS.days;
    if (endMin <= startMin) return { startMin: 9 * 60, endMin: 18 * 60, days };
    return { startMin, endMin, days };
}

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatterCache = new Map();
function formatter(tz) {
    if (!formatterCache.has(tz)) {
        formatterCache.set(tz, new Intl.DateTimeFormat('en-US', {
            timeZone: tz, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        }));
    }
    return formatterCache.get(tz);
}

/** Wall-clock parts of an instant in a timezone: { day: 'YYYY-MM-DD', weekday, minutes }. */
function localParts(date, tz) {
    const parts = Object.fromEntries(formatter(tz).formatToParts(date).map((p) => [p.type, p.value]));
    return {
        day: `${parts.year}-${parts.month}-${parts.day}`,
        weekday: WEEKDAYS[parts.weekday],
        minutes: Number(parts.hour) * 60 + Number(parts.minute),
    };
}

/** True when [start, end) sits inside one working day of the attendee. */
function withinWorkingHours(start, end, tz, wh) {
    const a = localParts(start, tz);
    const b = localParts(new Date(end.getTime() - 1), tz); // inclusive last minute
    if (a.day !== b.day) return false;
    if (!wh.days.includes(a.weekday)) return false;
    return a.minutes >= wh.startMin && b.minutes + 1 <= wh.endMin;
}

function overlaps(start, end, busy) {
    const s = start.getTime();
    const e = end.getTime();
    return busy.some((b) => s < b.end && e > b.start);
}

function roundUp(date, stepMinutes) {
    const step = stepMinutes * MINUTE;
    return new Date(Math.ceil(date.getTime() / step) * step);
}

/**
 * @param {object} opts
 * @param {Array<{userId:string,timezone?:string,workingHours?:object,busy?:Array<{start:Date|string,end:Date|string}>}>} opts.attendees
 * @param {number} [opts.durationMinutes=30]
 * @param {Date}   [opts.from=now]   earliest start
 * @param {Date}   [opts.to=from+7d] latest end
 * @param {number} [opts.stepMinutes=30]
 * @param {number} [opts.limit=5]
 * @param {string} [opts.fallbackTimeZone='UTC'] used for attendees without a valid timezone
 */
function findSlots({
    attendees = [],
    durationMinutes = 30,
    from = new Date(),
    to = null,
    stepMinutes = 30,
    limit = 5,
    fallbackTimeZone = 'UTC',
} = {}) {
    const duration = Math.min(Math.max(Number(durationMinutes) || 30, 5), 480);
    const step = Math.min(Math.max(Number(stepMinutes) || 30, 5), 120);
    const max = Math.min(Math.max(Number(limit) || 5, 1), 20);
    const fallbackTz = isValidTimeZone(fallbackTimeZone) ? fallbackTimeZone : 'UTC';
    const start = roundUp(new Date(from), step);
    const end = to ? new Date(to) : new Date(start.getTime() + 7 * 24 * 60 * MINUTE);

    // Nobody named: default working hours in the fallback timezone.
    const list = attendees.length ? attendees : [{ userId: '', timezone: fallbackTz }];
    const people = list.map((a) => ({
        userId: String(a.userId),
        tz: isValidTimeZone(a.timezone) ? a.timezone : fallbackTz,
        wh: normalizeWorkingHours(a.workingHours),
        busy: (a.busy || [])
            .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
            .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start),
    }));

    const full = [];
    const partial = [];
    let candidates = 0;
    for (let t = start.getTime(); t + duration * MINUTE <= end.getTime() && candidates < MAX_CANDIDATES; t += step * MINUTE) {
        candidates++;
        const s = new Date(t);
        const e = new Date(t + duration * MINUTE);
        const busyIds = [];
        for (const p of people) {
            if (!withinWorkingHours(s, e, p.tz, p.wh) || overlaps(s, e, p.busy)) busyIds.push(p.userId);
        }
        const slot = {
            start: s.toISOString(),
            end: e.toISOString(),
            availableCount: people.length - busyIds.length,
            attendeeCount: people.length,
            allAvailable: busyIds.length === 0,
            score: people.length ? Math.round(((people.length - busyIds.length) / people.length) * 100) / 100 : 0,
            unavailable: busyIds,
        };
        if (slot.allAvailable) {
            full.push(slot);
            if (full.length >= max) break;
        } else if (slot.availableCount > 0) {
            partial.push(slot);
        }
    }

    if (full.length >= max) return full.slice(0, max);
    // Not enough slots for everyone: top up with the slots most people can make, earliest first.
    partial.sort((a, b) => b.availableCount - a.availableCount || a.start.localeCompare(b.start));
    return [...full, ...partial.slice(0, max - full.length)];
}

module.exports = { findSlots, normalizeWorkingHours, withinWorkingHours, localParts, isValidTimeZone, DEFAULT_WORKING_HOURS };
