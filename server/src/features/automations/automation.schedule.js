'use strict';

/**
 * Schedules for `scheduled` automations. Pure (no I/O), so it is fully unit tested.
 *
 * Two forms:
 *  - interval: "15m", "2h", "1d" (minimum 5m) — runs when that long has passed since the last run;
 *  - cron: standard 5-field expression "minute hour day-of-month month day-of-week",
 *    evaluated in an IANA timezone (default UTC). Supports `*`, lists `1,15`, ranges `1-5`,
 *    steps `*\/15` / `0-30/10`, month names JAN–DEC, weekday names SUN–SAT (0 or 7 = Sunday)
 *    and the macros @hourly @daily @midnight @weekly @monthly @yearly @annually.
 *    As in Vixie cron, when both day-of-month and day-of-week are restricted a day
 *    matches if EITHER matches.
 */

const MIN_INTERVAL_MS = 5 * 60_000;
const MAX_INTERVAL_MS = 366 * 86_400_000;

const MACROS = {
    '@yearly': '0 0 1 1 *',
    '@annually': '0 0 1 1 *',
    '@monthly': '0 0 1 * *',
    '@weekly': '0 0 * * 0',
    '@daily': '0 0 * * *',
    '@midnight': '0 0 * * *',
    '@hourly': '0 * * * *',
};

const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const DAYS = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

const FIELDS = [
    { name: 'minute', min: 0, max: 59 },
    { name: 'hour', min: 0, max: 23 },
    { name: 'dayOfMonth', min: 1, max: 31 },
    { name: 'month', min: 1, max: 12, names: MONTHS },
    { name: 'dayOfWeek', min: 0, max: 7, names: DAYS },
];

/** Milliseconds for "15m" / "2h" / "1d", or null when it is not an interval. */
function parseInterval(expression) {
    if (typeof expression !== 'string') return null;
    const match = expression.trim().match(/^(\d{1,4})\s*(m|h|d)$/i);
    if (!match) return null;
    const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000 };
    return parseInt(match[1], 10) * multipliers[match[2].toLowerCase()];
}

function parseValue(token, field) {
    const upper = token.toUpperCase();
    if (field.names && Object.prototype.hasOwnProperty.call(field.names, upper)) return field.names[upper];
    if (!/^\d{1,2}$/.test(token)) throw new Error(`Invalid ${field.name} value "${token}"`);
    const n = parseInt(token, 10);
    if (n < field.min || n > field.max) throw new Error(`${field.name} value ${n} out of range ${field.min}-${field.max}`);
    return n;
}

function parseField(text, field) {
    const values = new Set();
    for (const part of text.split(',')) {
        if (!part) throw new Error(`Empty list item in ${field.name}`);
        const [rangePart, stepPart, extra] = part.split('/');
        if (extra !== undefined) throw new Error(`Invalid step in ${field.name}`);
        let step = 1;
        if (stepPart !== undefined) {
            if (!/^\d{1,2}$/.test(stepPart) || parseInt(stepPart, 10) < 1) throw new Error(`Invalid step "${stepPart}" in ${field.name}`);
            step = parseInt(stepPart, 10);
        }
        let start;
        let end;
        if (rangePart === '*') {
            start = field.min;
            end = field.name === 'dayOfWeek' ? 6 : field.max;
        } else if (rangePart.includes('-')) {
            const [a, b, more] = rangePart.split('-');
            if (more !== undefined) throw new Error(`Invalid range in ${field.name}`);
            start = parseValue(a, field);
            end = parseValue(b, field);
            if (end < start) throw new Error(`Invalid range ${rangePart} in ${field.name}`);
        } else {
            start = parseValue(rangePart, field);
            end = stepPart !== undefined ? (field.name === 'dayOfWeek' ? 6 : field.max) : start;
        }
        for (let v = start; v <= end; v += step) values.add(field.name === 'dayOfWeek' && v === 7 ? 0 : v);
    }
    return values;
}

/** Parsed cron, or throws with a readable message. */
function parseCron(expression) {
    if (typeof expression !== 'string' || !expression.trim()) throw new Error('Cron expression is required');
    let expr = expression.trim();
    if (expr.startsWith('@')) {
        const macro = MACROS[expr.toLowerCase()];
        if (!macro) throw new Error(`Unknown cron macro "${expr}"`);
        expr = macro;
    }
    const parts = expr.split(/\s+/);
    if (parts.length !== 5) throw new Error('Cron expression needs 5 fields: minute hour day-of-month month day-of-week');
    const sets = parts.map((p, i) => parseField(p, FIELDS[i]));
    return {
        minute: sets[0],
        hour: sets[1],
        dayOfMonth: sets[2],
        month: sets[3],
        dayOfWeek: sets[4],
        domRestricted: parts[2] !== '*' && !parts[2].startsWith('*/'),
        dowRestricted: parts[4] !== '*' && !parts[4].startsWith('*/'),
    };
}

function isValidTimezone(tz) {
    if (!tz) return true;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

const formatters = new Map();
function formatterFor(tz) {
    if (!formatters.has(tz)) {
        formatters.set(tz, new Intl.DateTimeFormat('en-US', {
            timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', weekday: 'short',
        }));
    }
    return formatters.get(tz);
}

/** Wall-clock parts of `date` in `tz`. */
function partsIn(date, tz = 'UTC') {
    const out = {};
    for (const p of formatterFor(tz).formatToParts(date)) out[p.type] = p.value;
    return {
        minute: parseInt(out.minute, 10),
        hour: parseInt(out.hour, 10) % 24,
        dayOfMonth: parseInt(out.day, 10),
        month: parseInt(out.month, 10),
        dayOfWeek: DAYS[String(out.weekday).slice(0, 3).toUpperCase()],
    };
}

function dayMatches(cron, p) {
    const dom = cron.dayOfMonth.has(p.dayOfMonth);
    const dow = cron.dayOfWeek.has(p.dayOfWeek);
    if (cron.domRestricted && cron.dowRestricted) return dom || dow;
    return dom && dow;
}

function cronMatches(cron, date, tz = 'UTC') {
    const p = partsIn(date, tz);
    return cron.month.has(p.month) && dayMatches(cron, p) && cron.hour.has(p.hour) && cron.minute.has(p.minute);
}

const floorMinute = (ms) => Math.floor(ms / 60_000) * 60_000;

/** The first time strictly after `from` that matches, or null within ~4 years. */
function nextCronRun(expressionOrCron, from = new Date(), tz = 'UTC') {
    const cron = typeof expressionOrCron === 'string' ? parseCron(expressionOrCron) : expressionOrCron;
    let t = floorMinute(new Date(from).getTime()) + 60_000;
    for (let i = 0; i < 200_000; i++) {
        const d = new Date(t);
        const p = partsIn(d, tz);
        if (!cron.month.has(p.month) || !dayMatches(cron, p)) {
            t += (24 * 60 - (p.hour * 60 + p.minute)) * 60_000; // next local midnight
            continue;
        }
        if (!cron.hour.has(p.hour)) {
            t += (60 - p.minute) * 60_000; // next local hour
            continue;
        }
        if (!cron.minute.has(p.minute)) {
            t += 60_000;
            continue;
        }
        return d;
    }
    return null;
}

/** The latest matching time in (after, now], scanning back at most `lookbackMinutes`. */
function latestCronRun(expressionOrCron, now = new Date(), tz = 'UTC', { after = null, lookbackMinutes = 60 } = {}) {
    const cron = typeof expressionOrCron === 'string' ? parseCron(expressionOrCron) : expressionOrCron;
    const end = floorMinute(new Date(now).getTime());
    const floor = after ? new Date(after).getTime() : -Infinity;
    for (let i = 0; i <= lookbackMinutes; i++) {
        const t = end - i * 60_000;
        if (t <= floor) return null;
        if (cronMatches(cron, new Date(t), tz)) return new Date(t);
    }
    return null;
}

/**
 * Normalised schedule from what clients send. Accepts { type: 'interval'|'cron', expression, timezone };
 * a 5-field / @macro expression is treated as cron even when type says interval (older clients).
 * Throws a 400-style error when it is invalid.
 */
function normalizeSchedule(schedule) {
    if (!schedule) return null;
    const expression = String(schedule.expression || '').trim();
    const timezone = schedule.timezone ? String(schedule.timezone) : 'UTC';
    const bad = (msg) => Object.assign(new Error(msg), { statusCode: 400 });
    if (!expression) throw bad('schedule.expression is required');
    if (!isValidTimezone(timezone)) throw bad(`Unknown timezone "${timezone}"`);
    const interval = parseInterval(expression);
    if (interval !== null && schedule.type !== 'cron') {
        if (interval < MIN_INTERVAL_MS) throw bad('Interval must be at least 5m');
        if (interval > MAX_INTERVAL_MS) throw bad('Interval must be at most 366d');
        return { type: 'interval', expression, timezone };
    }
    try {
        parseCron(expression);
    } catch (err) {
        throw bad(`Invalid schedule: ${err.message}`);
    }
    return { type: 'cron', expression, timezone };
}

/**
 * Whether a scheduled automation should run now, and the slot it runs for.
 * interval: due when `interval` has passed since lastRunAt.
 * cron: due when a matching minute in the last hour is later than lastRunAt (and createdAt).
 */
function dueSlot(schedule, { lastRunAt = null, createdAt = null, now = new Date() } = {}) {
    if (!schedule || !schedule.expression) return null;
    const expression = schedule.expression;
    const interval = parseInterval(expression);
    if (interval !== null && schedule.type !== 'cron') {
        const last = lastRunAt ? new Date(lastRunAt).getTime() : 0;
        return now.getTime() - last >= interval ? new Date(floorMinute(now.getTime())) : null;
    }
    let cron;
    try { cron = parseCron(expression); } catch { return null; }
    const after = [lastRunAt, createdAt].filter(Boolean).map((d) => new Date(d).getTime());
    const floor = after.length ? new Date(Math.max(...after)) : null;
    return latestCronRun(cron, now, schedule.timezone || 'UTC', { after: floor });
}

/** Next `count` run times for a schedule (for previews in the UI). */
function previewRuns(schedule, { count = 5, from = new Date(), lastRunAt = null } = {}) {
    const s = normalizeSchedule(schedule);
    const out = [];
    if (s.type === 'interval') {
        const ms = parseInterval(s.expression);
        let t = lastRunAt ? new Date(lastRunAt).getTime() + ms : from.getTime();
        if (t < from.getTime()) t = from.getTime();
        for (let i = 0; i < count; i++) out.push(new Date(t + i * ms));
        return out;
    }
    let t = from;
    const cron = parseCron(s.expression);
    for (let i = 0; i < count; i++) {
        t = nextCronRun(cron, t, s.timezone);
        if (!t) break;
        out.push(t);
    }
    return out;
}

module.exports = {
    parseInterval,
    parseCron,
    cronMatches,
    nextCronRun,
    latestCronRun,
    normalizeSchedule,
    dueSlot,
    previewRuns,
    isValidTimezone,
    MIN_INTERVAL_MS,
};
