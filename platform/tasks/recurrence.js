/**
 * Recurring tasks: the repeat picker's rule <-> the task's `recurring` field.
 *
 * Picker rule (UI):
 *   { frequency: 'none'|'daily'|'weekly'|'monthly'|'custom',
 *     interval: number >= 1,
 *     unit: 'day'|'week'|'month'        (custom only),
 *     daysOfWeek: number[] 0=Sun..6=Sat (weekly only),
 *     endDate: 'YYYY-MM-DD' | '' }
 *
 * Task field (server):
 *   recurring: { isRecurring, pattern: 'daily'|'weekly'|'monthly'|'custom',
 *                interval, daysOfWeek, endDate, nextDue }
 * `custom` always means "every N days" (that is what the server's generator
 * does with it); every N weeks/months is sent as weekly/monthly + interval.
 * `nextDue` is when the server should create the next copy.
 */

export const REPEAT_FREQUENCIES = [
    { id: 'none', label: "Doesn't repeat" },
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'custom', label: 'Custom' },
];

export const WEEKDAYS = [
    { id: 0, short: 'S', label: 'Sun' },
    { id: 1, short: 'M', label: 'Mon' },
    { id: 2, short: 'T', label: 'Tue' },
    { id: 3, short: 'W', label: 'Wed' },
    { id: 4, short: 'T', label: 'Thu' },
    { id: 5, short: 'F', label: 'Fri' },
    { id: 6, short: 'S', label: 'Sat' },
];

export const EMPTY_RULE = Object.freeze({ frequency: 'none', interval: 1, unit: 'day', daysOfWeek: [], endDate: '' });

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const clampInterval = (n) => Math.min(365, Math.max(1, Math.floor(Number(n) || 1)));

/** 'YYYY-MM-DD' (or Date/ISO) -> UTC-midnight timestamp, or null. */
export function dayValue(v) {
    if (!v) return null;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [y, m, d] = v.split('-').map(Number);
        return Date.UTC(y, m - 1, d);
    }
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    // Date-only values are stored as UTC midnight: keep that calendar day.
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

export const dayString = (ts) => {
    const d = new Date(ts);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

const addMonths = (ts, n, dayOfMonth) => {
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + n;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(y, m, Math.min(dayOfMonth, last));
};

export function normalizeRule(rule) {
    const r = { ...EMPTY_RULE, ...(rule || {}) };
    if (!REPEAT_FREQUENCIES.some((f) => f.id === r.frequency)) r.frequency = 'none';
    r.interval = clampInterval(r.interval);
    if (!['day', 'week', 'month'].includes(r.unit)) r.unit = 'day';
    r.daysOfWeek = [...new Set((r.daysOfWeek || []).map(Number).filter((n) => n >= 0 && n <= 6))].sort();
    r.endDate = r.endDate && dayValue(r.endDate) != null ? dayString(dayValue(r.endDate)) : '';
    return r;
}

/** The server pattern + interval for a rule. */
function patternOf(r) {
    if (r.frequency === 'daily') return { pattern: 'daily', interval: 1 };
    if (r.frequency === 'weekly') return { pattern: 'weekly', interval: r.interval };
    if (r.frequency === 'monthly') return { pattern: 'monthly', interval: r.interval };
    if (r.unit === 'week') return { pattern: 'weekly', interval: r.interval };
    if (r.unit === 'month') return { pattern: 'monthly', interval: r.interval };
    return { pattern: 'custom', interval: r.interval };
}

/**
 * First occurrence strictly after `anchor` (a day timestamp), or null when the
 * rule ends before it.
 */
export function nextOccurrence(rule, anchor) {
    const r = normalizeRule(rule);
    if (r.frequency === 'none' || anchor == null) return null;
    const { pattern, interval } = patternOf(r);
    let next;
    if (pattern === 'daily' || pattern === 'custom') {
        next = anchor + (pattern === 'daily' ? 1 : interval) * DAY;
    } else if (pattern === 'monthly') {
        next = addMonths(anchor, interval, new Date(anchor).getUTCDate());
    } else if (r.daysOfWeek.length === 0) {
        next = anchor + 7 * interval * DAY;
    } else {
        const weekStart = (ts) => ts - new Date(ts).getUTCDay() * DAY;
        const base = weekStart(anchor);
        for (let i = 1; i <= 7 * interval + 7; i += 1) {
            const ts = anchor + i * DAY;
            const weekIndex = Math.round((weekStart(ts) - base) / (7 * DAY));
            if (weekIndex % interval === 0 && r.daysOfWeek.includes(new Date(ts).getUTCDay())) { next = ts; break; }
        }
    }
    const end = dayValue(r.endDate);
    if (next == null || (end != null && next > end)) return null;
    return next;
}

/**
 * The `recurring` value to send for a rule. `dueDate` anchors the schedule
 * (falls back to `today`). A rule of 'none' turns repeating off.
 */
export function toRecurringPayload(rule, { dueDate = null, today = new Date() } = {}) {
    const r = normalizeRule(rule);
    if (r.frequency === 'none') return { isRecurring: false, pattern: null, interval: 1, daysOfWeek: [], endDate: null, nextDue: null };
    const { pattern, interval } = patternOf(r);
    const anchor = dayValue(dueDate) ?? dayValue(today);
    const next = nextOccurrence(r, anchor);
    return {
        isRecurring: true,
        pattern,
        interval,
        daysOfWeek: pattern === 'weekly' ? r.daysOfWeek : [],
        endDate: r.endDate ? `${r.endDate}T00:00:00.000Z` : null,
        nextDue: next != null ? new Date(next).toISOString() : null,
    };
}

/** Picker rule from a task's `recurring` field. */
export function fromRecurring(recurring) {
    if (!recurring || !recurring.isRecurring || !recurring.pattern) return { ...EMPTY_RULE };
    const interval = clampInterval(recurring.interval);
    const endDate = recurring.endDate && dayValue(recurring.endDate) != null ? dayString(dayValue(recurring.endDate)) : '';
    const daysOfWeek = Array.isArray(recurring.daysOfWeek) ? recurring.daysOfWeek : [];
    switch (recurring.pattern) {
        case 'daily':
            return interval === 1
                ? { ...EMPTY_RULE, frequency: 'daily', endDate }
                : { ...EMPTY_RULE, frequency: 'custom', unit: 'day', interval, endDate };
        case 'weekly':
            return { ...EMPTY_RULE, frequency: 'weekly', interval, daysOfWeek: normalizeRule({ daysOfWeek }).daysOfWeek, endDate };
        case 'monthly':
            return { ...EMPTY_RULE, frequency: 'monthly', interval, endDate };
        default:
            return { ...EMPTY_RULE, frequency: 'custom', unit: 'day', interval, endDate };
    }
}

export const isRecurring = (task) => !!(task?.recurring?.isRecurring && task.recurring.pattern);

const plural = (n, word) => (n === 1 ? word : `${n} ${word}s`);
const fmtEnd = (endDate) => {
    const ts = dayValue(endDate);
    if (ts == null) return '';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

/** "Every day", "Every 2 weeks on Mon, Wed", "Monthly until Dec 31, 2026"… */
export function describeRule(rule) {
    const r = normalizeRule(rule);
    if (r.frequency === 'none') return "Doesn't repeat";
    const { pattern, interval } = patternOf(r);
    let text;
    if (pattern === 'daily') text = 'Every day';
    else if (pattern === 'custom') text = interval === 1 ? 'Every day' : `Every ${interval} days`;
    else if (pattern === 'monthly') text = interval === 1 ? 'Monthly' : `Every ${plural(interval, 'month')}`;
    else {
        text = interval === 1 ? 'Weekly' : `Every ${plural(interval, 'week')}`;
        if (r.daysOfWeek.length) text += ` on ${r.daysOfWeek.map((d) => WEEKDAYS[d].label).join(', ')}`;
    }
    if (r.endDate) text += ` until ${fmtEnd(r.endDate)}`;
    return text;
}

export const describeRecurring = (recurring) => describeRule(fromRecurring(recurring));

/** True when two `recurring` values describe the same schedule. */
export function sameRecurring(a, b) {
    const x = fromRecurring(a);
    const y = fromRecurring(b);
    return JSON.stringify(normalizeRule(x)) === JSON.stringify(normalizeRule(y));
}
