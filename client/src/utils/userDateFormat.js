/**
 * Dates and times in the user's chosen format (Settings → Language & region):
 *   region = { timezone: 'auto' | IANA zone, dateFormat, timeFormat: '12h' | '24h' }
 * Every function accepts either the region object or the whole preferences
 * object ({ region }). 'auto' (or an unknown zone) means the browser's zone.
 *
 * Date-only values (task due dates) are stored as UTC midnight: pass
 * { dateOnly: true } — or let isDateOnly() decide — to keep their calendar day.
 */

export const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY'];
export const TIME_FORMATS = ['12h', '24h'];
export const REGION_DEFAULTS = Object.freeze({ language: 'en', timezone: 'auto', dateFormat: 'MM/DD/YYYY', timeFormat: '12h' });

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const regionOf = (prefs) => {
    const r = prefs && typeof prefs === 'object' ? (prefs.region && typeof prefs.region === 'object' ? prefs.region : prefs) : {};
    return {
        timezone: typeof r.timezone === 'string' && r.timezone ? r.timezone : 'auto',
        dateFormat: DATE_FORMATS.includes(r.dateFormat) ? r.dateFormat : REGION_DEFAULTS.dateFormat,
        timeFormat: TIME_FORMATS.includes(r.timeFormat) ? r.timeFormat : REGION_DEFAULTS.timeFormat,
    };
};

// Intl formatters are expensive to build and chat lists format hundreds of times.
const cache = new Map();
function formatter(options) {
    const key = JSON.stringify(options);
    let f = cache.get(key);
    if (!f) {
        f = new Intl.DateTimeFormat('en-US', options);
        if (cache.size > 200) cache.clear();
        cache.set(key, f);
    }
    return f;
}

const validZones = new Map();
/** The IANA zone to format in, or undefined for the browser's own zone. */
export function resolveTimeZone(timezone) {
    if (!timezone || timezone === 'auto') return undefined;
    if (!validZones.has(timezone)) {
        let ok = true;
        try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); } catch { ok = false; }
        validZones.set(timezone, ok);
    }
    return validZones.get(timezone) ? timezone : undefined;
}

/** The browser's own zone, e.g. "Europe/Berlin" (or "UTC" if unknown). */
export function detectedTimeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

const toDate = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

/** True for values stored as UTC midnight (date-only fields such as due dates). */
export function isDateOnly(value) {
    const d = toDate(value);
    return !!d && d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

/** Calendar parts of `d` in `timeZone` (undefined = local). */
function calendarParts(d, timeZone) {
    const parts = formatter({ timeZone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'long' }).formatToParts(d);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const weekday = WEEKDAYS.indexOf(get('weekday'));
    return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), weekday };
}

const pad = (n) => String(n).padStart(2, '0');
const zoneFor = (region, opts) => (opts?.dateOnly ? 'UTC' : resolveTimeZone(region.timezone));

/**
 * A date in the chosen pattern: 09/28/2026, 28/09/2026, 2026-09-28, 28 Sep 2026.
 * { year: false } gives a compact form for cards (Sep 28 / 28 Sep / 09-28).
 */
export function formatDate(value, prefs, opts = {}) {
    const d = toDate(value);
    if (!d) return '';
    const { dateFormat } = regionOf(prefs);
    const { year, month, day } = calendarParts(d, zoneFor(regionOf(prefs), opts));
    if (opts.year === false) {
        switch (dateFormat) {
            case 'YYYY-MM-DD': return `${pad(month)}-${pad(day)}`;
            case 'MM/DD/YYYY': return `${MONTHS_SHORT[month - 1]} ${day}`;
            default: return `${day} ${MONTHS_SHORT[month - 1]}`;
        }
    }
    switch (dateFormat) {
        case 'DD/MM/YYYY': return `${pad(day)}/${pad(month)}/${year}`;
        case 'YYYY-MM-DD': return `${year}-${pad(month)}-${pad(day)}`;
        case 'DD MMM YYYY': return `${pad(day)} ${MONTHS_SHORT[month - 1]} ${year}`;
        default: return `${pad(month)}/${pad(day)}/${year}`;
    }
}

/** A clock time: "2:05 PM" (12h) or "14:05" (24h). */
export function formatTime(value, prefs) {
    const d = toDate(value);
    if (!d) return '';
    const region = regionOf(prefs);
    const timeZone = resolveTimeZone(region.timezone);
    return region.timeFormat === '24h'
        ? formatter({ timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
        : formatter({ timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
}

/** "09/28/2026, 2:05 PM" */
export function formatDateTime(value, prefs, opts = {}) {
    const d = toDate(value);
    if (!d) return '';
    return `${formatDate(d, prefs, opts)}, ${formatTime(d, prefs)}`;
}

/**
 * A day heading (chat date dividers) that follows the chosen order:
 * "Monday, September 28, 2026" / "Monday, 28 September 2026" / "Monday, 2026-09-28".
 */
export function formatDayHeading(value, prefs, opts = {}) {
    const d = toDate(value);
    if (!d) return '';
    const { dateFormat } = regionOf(prefs);
    const { year, month, day, weekday } = calendarParts(d, zoneFor(regionOf(prefs), opts));
    const wd = WEEKDAYS[weekday] || '';
    const body = dateFormat === 'MM/DD/YYYY' ? `${MONTHS_LONG[month - 1]} ${day}, ${year}`
        : dateFormat === 'YYYY-MM-DD' ? `${year}-${pad(month)}-${pad(day)}`
            : `${day} ${MONTHS_LONG[month - 1]} ${year}`;
    return wd ? `${wd}, ${body}` : body;
}

/** "YYYY-MM-DD" of the calendar day in the chosen zone (for grouping by day). */
export function dayKey(value, prefs, opts = {}) {
    const d = toDate(value);
    if (!d) return '';
    const { year, month, day } = calendarParts(d, zoneFor(regionOf(prefs), opts));
    return `${year}-${pad(month)}-${pad(day)}`;
}

/** Offset label for a zone right now, e.g. "GMT+5:30". */
export function zoneOffsetLabel(timezone, at = new Date()) {
    try {
        const parts = formatter({ timeZone: resolveTimeZone(timezone), timeZoneName: 'shortOffset', hour: 'numeric' }).formatToParts(at);
        return parts.find((p) => p.type === 'timeZoneName')?.value || '';
    } catch {
        return '';
    }
}
