'use strict';

/**
 * Recurrence rules for recurring tasks (pure; used by the create/update paths
 * and by tasks.cron.js on both task stores).
 *
 * Stored shape (task.recurring):
 *   isRecurring  boolean
 *   pattern      'daily' | 'weekly' | 'monthly' | 'custom'
 *   interval     >= 1   daily: every N days, weekly: every N weeks,
 *                        monthly: every N months, custom: every N days
 *   daysOfWeek   [0..6] (0 = Sunday) weekly/custom: occurrences fall on these
 *                        weekdays (weekly honours `interval` weeks; custom = every week)
 *   dayOfMonth   1..31  monthly: the anchor day (clamped to the month's last day)
 *   endDate      Date|null  no occurrence is generated after this instant
 *   nextDue      Date|null  due date of the next occurrence to generate
 *
 * All arithmetic is in UTC so a server's local timezone never shifts dates.
 */

const PATTERNS = ['daily', 'weekly', 'monthly', 'custom'];
const DAY_MS = 86400000;
const MAX_INTERVAL = 365;

function badRequest(message) {
    return Object.assign(new Error(message), { statusCode: 400 });
}

function toDate(v) {
    if (v === null || v === undefined || v === '') return null;
    const d = v instanceof Date ? new Date(v.getTime()) : new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

const DISABLED_TAIL = Object.freeze({ isRecurring: false, nextDue: null });
const DISABLED = Object.freeze({ isRecurring: false, pattern: null, interval: 1, daysOfWeek: [], dayOfMonth: null, endDate: null, nextDue: null });

/**
 * Validate client input into the stored shape. `fallbackStart` (usually the
 * task's due date, else now) seeds nextDue when the client does not send one.
 * Accepts null / false / { isRecurring: false } to turn recurrence off.
 * Throws a 400 error on invalid input.
 */
function normalizeRecurring(input, { fallbackStart = null } = {}) {
    if (input === null || input === false || input === undefined) return { ...DISABLED };
    if (typeof input !== 'object' || Array.isArray(input)) throw badRequest('recurring must be an object');
    if (input.isRecurring === false) return { ...DISABLED };

    const pattern = input.pattern;
    if (!PATTERNS.includes(pattern)) throw badRequest(`recurring.pattern must be one of: ${PATTERNS.join(', ')}`);

    const interval = input.interval === undefined || input.interval === null ? 1 : Number(input.interval);
    if (!Number.isInteger(interval) || interval < 1 || interval > MAX_INTERVAL) {
        throw badRequest(`recurring.interval must be an integer between 1 and ${MAX_INTERVAL}`);
    }

    let daysOfWeek = [];
    if (input.daysOfWeek !== undefined && input.daysOfWeek !== null) {
        if (!Array.isArray(input.daysOfWeek) || input.daysOfWeek.some(d => !Number.isInteger(d) || d < 0 || d > 6)) {
            throw badRequest('recurring.daysOfWeek must be an array of weekday numbers 0 (Sunday) to 6');
        }
        daysOfWeek = [...new Set(input.daysOfWeek)].sort((a, b) => a - b);
    }
    if (daysOfWeek.length && !['weekly', 'custom'].includes(pattern)) {
        throw badRequest('recurring.daysOfWeek is only valid with the weekly or custom pattern');
    }

    const nextDue = toDate(input.nextDue ?? input.startDate);
    if (nextDue === undefined) throw badRequest('recurring.nextDue must be a valid date');
    // A date-only end date ("YYYY-MM-DD", as the web picker sends) includes that whole day (UTC).
    const endDate = typeof input.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.endDate)
        ? toDate(`${input.endDate}T23:59:59.999Z`)
        : toDate(input.endDate);
    if (endDate === undefined) throw badRequest('recurring.endDate must be a valid date');

    let first = nextDue || toDate(fallbackStart) || new Date();
    // With weekdays, the first occurrence is the first allowed weekday on/after the start.
    if (daysOfWeek.length && !daysOfWeek.includes(first.getUTCDay())) {
        for (let i = 1; i <= 7; i += 1) {
            const c = new Date(first.getTime() + i * DAY_MS);
            if (daysOfWeek.includes(c.getUTCDay())) { first = c; break; }
        }
    }
    if (endDate && first > endDate) throw badRequest('recurring.endDate is before the first occurrence');

    let dayOfMonth = null;
    if (pattern === 'monthly') {
        dayOfMonth = input.dayOfMonth !== undefined && input.dayOfMonth !== null ? Number(input.dayOfMonth) : first.getUTCDate();
        if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) throw badRequest('recurring.dayOfMonth must be 1..31');
    }

    return { isRecurring: true, pattern, interval, daysOfWeek, dayOfMonth, endDate, nextDue: first };
}

function startOfUtcWeek(d) {
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    return day.getTime() - day.getUTCDay() * DAY_MS;
}

function addMonthsClamped(from, months, dayOfMonth) {
    const y = from.getUTCFullYear();
    const m = from.getUTCMonth() + months;
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const day = Math.min(dayOfMonth || from.getUTCDate(), lastDay);
    return new Date(Date.UTC(y, m, day, from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()));
}

/**
 * The occurrence after `from` (a Date that is itself an occurrence), or null
 * when the rule has ended (past endDate) or is not recurring.
 */
function nextOccurrence(recurring, from) {
    if (!recurring || !recurring.isRecurring || !from) return null;
    const base = toDate(from);
    if (!base) return null;
    const interval = Math.max(1, Number(recurring.interval) || 1);
    const days = Array.isArray(recurring.daysOfWeek) ? recurring.daysOfWeek : [];
    let next;

    if (days.length && (recurring.pattern === 'weekly' || recurring.pattern === 'custom')) {
        const weekStep = recurring.pattern === 'weekly' ? interval : 1;
        const baseWeek = startOfUtcWeek(base);
        for (let i = 1; i <= 7 * weekStep + 7; i += 1) {
            const c = new Date(base.getTime() + i * DAY_MS);
            if (!days.includes(c.getUTCDay())) continue;
            const weeks = Math.round((startOfUtcWeek(c) - baseWeek) / (7 * DAY_MS));
            if (weeks % weekStep === 0) { next = c; break; }
        }
    } else if (recurring.pattern === 'weekly') {
        next = new Date(base.getTime() + 7 * interval * DAY_MS);
    } else if (recurring.pattern === 'monthly') {
        next = addMonthsClamped(base, interval, recurring.dayOfMonth);
    } else {
        // daily and custom (every N days)
        next = new Date(base.getTime() + interval * DAY_MS);
    }

    if (!next) return null;
    const end = toDate(recurring.endDate);
    if (end && next > end) return null;
    return next;
}

/**
 * What the generator should do for a due rule at `now`:
 *   { occurrenceDue, recurring }  where occurrenceDue is the due date of the
 *   task to create now (null when the rule already ended), and `recurring` is
 *   the rule to store back (nextDue moved past `now`, skipping missed
 *   occurrences so a long outage creates one catch-up task, not dozens;
 *   isRecurring=false once the end date passes).
 */
function planNextRun(recurring, now = new Date()) {
    const due = toDate(recurring?.nextDue);
    const end = toDate(recurring?.endDate);
    if (!recurring?.isRecurring || !due || (end && due > end)) {
        return { occurrenceDue: null, recurring: { ...(recurring || {}), ...DISABLED_TAIL } };
    }
    let next = nextOccurrence(recurring, due);
    let guard = 0;
    while (next && next <= now && guard < 1000) {
        next = nextOccurrence(recurring, next);
        guard += 1;
    }
    const stored = next
        ? { ...recurring, nextDue: next }
        : { ...recurring, ...DISABLED_TAIL };
    return { occurrenceDue: due, recurring: stored };
}


/**
 * The rule to store on a task. The task itself is the first occurrence (due at
 * `dueDate`, else now), so unless the client names `nextDue` the generator
 * starts with the occurrence after it.
 */
function recurringForTask(input, dueDate, now = new Date()) {
    const explicitStart = input && typeof input === 'object' && (input.nextDue || input.startDate);
    const base = toDate(dueDate) || now;
    const rule = normalizeRecurring(input, { fallbackStart: base });
    // Explicit start, or the first allowed weekday already falls after the task: keep it.
    if (!rule.isRecurring || explicitStart || rule.nextDue > base) return rule;
    const next = nextOccurrence(rule, rule.nextDue);
    return next ? { ...rule, nextDue: next } : { ...rule, ...DISABLED_TAIL };
}

module.exports = { PATTERNS, normalizeRecurring, nextOccurrence, planNextRun, recurringForTask };
