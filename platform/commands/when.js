// "tomorrow", "friday 3pm", "in 2 hours", "5pm", "2026-11-02": the times people type in slash
// commands (/remind, /later, /task … due friday). Shared by the web app and the phone app.
// Times are in the device's local time zone.

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_SHORT = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const UNITS = [
    [/^(m|min|mins|minute|minutes)$/, 60_000],
    [/^(h|hr|hrs|hour|hours)$/, 3_600_000],
    [/^(d|day|days)$/, 86_400_000],
    [/^(w|wk|wks|week|weeks)$/, 7 * 86_400_000],
];
const PARTS_OF_DAY = { morning: 9, noon: 12, midday: 12, afternoon: 14, evening: 18, tonight: 20, night: 20, midnight: 0 };

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function weekdayOf(word) {
    const w = word.replace(/[.,]$/, '');
    const full = WEEKDAYS.indexOf(w);
    if (full >= 0) return full;
    return Object.prototype.hasOwnProperty.call(WEEKDAY_SHORT, w) ? WEEKDAY_SHORT[w] : -1;
}

/** "5pm", "5:30 pm", "17:00", "noon" at tokens[i] → { hour, minute, used } or null. */
function readTime(tokens, i) {
    let j = i;
    if (tokens[j] === 'at') j += 1;
    const t = tokens[j];
    if (!t) return null;
    if (Object.prototype.hasOwnProperty.call(PARTS_OF_DAY, t) && t !== 'tonight') return { hour: PARTS_OF_DAY[t], minute: 0, used: j - i + 1 };
    let m = t.match(/^(\d{1,2})(?::(\d{2}))?(am|pm|a|p)?$/);
    if (!m) return null;
    let suffix = m[3];
    let used = j - i + 1;
    if (!suffix && /^(am|pm|a\.m\.|p\.m\.)$/.test(tokens[j + 1] || '')) {
        suffix = tokens[j + 1][0];
        used += 1;
    }
    let hour = Number(m[1]);
    const minute = m[2] ? Number(m[2]) : 0;
    if (minute > 59) return null;
    if (suffix) {
        if (hour < 1 || hour > 12) return null;
        const pm = suffix[0] === 'p';
        if (hour === 12) hour = pm ? 12 : 0;
        else if (pm) hour += 12;
    } else {
        // A bare number is only a time with minutes ("17:00") or after "at" ("at 5").
        if (!m[2] && tokens[i] !== 'at') return null;
        if (hour > 23) return null;
        // "at 5" during the working day reads as 5pm.
        if (!m[2] && hour >= 1 && hour <= 7) hour += 12;
    }
    return { hour, minute, used };
}

/** "tomorrow", "friday", "next monday", "2026-11-02", "nov 2" at tokens[i] → { day, used } or null. */
function readDay(tokens, i, now) {
    const t = tokens[i];
    if (!t) return null;
    const today = startOfDay(now);
    if (t === 'today') return { day: today, used: 1 };
    if (t === 'tonight') return { day: today, used: 1, hour: 20 };
    if (t === 'tomorrow' || t === 'tmrw' || t === 'tmr' || t === 'tomorow') return { day: addDays(today, 1), used: 1 };
    if (t === 'next' && (tokens[i + 1] === 'week' || tokens[i + 1] === 'wk')) {
        const ahead = ((1 - today.getDay() + 7) % 7) || 7;
        return { day: addDays(today, ahead), used: 2 };
    }
    let used = 0;
    let word = t;
    if (t === 'next' || t === 'this' || t === 'on') {
        used = 1;
        word = tokens[i + 1] || '';
    }
    const wd = weekdayOf(word);
    if (wd >= 0) {
        let ahead = (wd - today.getDay() + 7) % 7;
        if (ahead === 0) ahead = 7; // "friday" on a Friday is next week's
        return { day: addDays(today, ahead), used: used + 1 };
    }
    if (used) return null;
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (d.getMonth() !== Number(m[2]) - 1) return null;
        return { day: d, used: 1 };
    }
    // "nov 2" / "2 nov" / "november 2nd"
    const monthOf = (w) => MONTHS.indexOf(String(w || '').slice(0, 3));
    const dayNum = (w) => {
        const x = String(w || '').match(/^(\d{1,2})(st|nd|rd|th)?,?$/);
        return x ? Number(x[1]) : 0;
    };
    let mon = monthOf(t);
    let dn = dayNum(tokens[i + 1]);
    if (!(mon >= 0 && /^[a-z]{3,9}$/.test(t) && dn)) {
        dn = dayNum(t);
        mon = dn ? monthOf(tokens[i + 1]) : -1;
        if (!(mon >= 0 && /^[a-z]{3,9}$/.test(tokens[i + 1] || ''))) return null;
    }
    let d = new Date(today.getFullYear(), mon, dn);
    if (d.getMonth() !== mon) return null;
    if (d < today) d = new Date(today.getFullYear() + 1, mon, dn);
    return { day: d, used: 2 };
}

const tokenize = (text) => String(text || '').trim().split(/\s+/).filter(Boolean);
const lower = (tokens) => tokens.map((t) => t.toLowerCase());

/**
 * Reads a time at the start of `text`. Returns { at: Date, hasTime, used, rest } (`used` is the
 * number of words read, `rest` what follows) or null when it doesn't start with a time.
 * A day without a time is at `defaultHour` (9:00); a time without a day is today, or tomorrow
 * once it has passed.
 */
export function parseWhen(text, { now = new Date(), defaultHour = 9 } = {}) {
    const raw = tokenize(text);
    const tokens = lower(raw);
    if (!tokens.length) return null;
    const done = (at, hasTime, used) => ({ at, hasTime, used, rest: raw.slice(used).join(' ') });

    // "in 2 hours", "in a minute", "in 30m", "in 1h30m"? (just one unit)
    if (tokens[0] === 'in') {
        const n = tokens[1] === 'a' || tokens[1] === 'an' ? 1 : Number(tokens[1]);
        let unitWord = tokens[2];
        let used = 3;
        const glued = String(tokens[1] || '').match(/^(\d+(?:\.\d+)?)([a-z]+)$/);
        let amount = n;
        if (glued) {
            amount = Number(glued[1]);
            unitWord = glued[2];
            used = 2;
        }
        const unit = UNITS.find(([re]) => re.test(unitWord || ''));
        if (unit && amount > 0 && Number.isFinite(amount)) return done(new Date(now.getTime() + amount * unit[1]), true, used);
        if (tokens[1] === 'half' && tokens[2] === 'an' && tokens[3] === 'hour') return done(new Date(now.getTime() + 1_800_000), true, 4);
        return null;
    }

    // Day then optional time, or time then optional day.
    const day = readDay(tokens, 0, now);
    if (day) {
        const time = readTime(tokens, day.used);
        if (time) return done(at(day.day, time.hour, time.minute), true, day.used + time.used);
        if (day.hour != null) return done(at(day.day, day.hour, 0), true, day.used);
        return done(at(day.day, defaultHour, 0), false, day.used);
    }
    const time = readTime(tokens, 0);
    if (time) {
        let i = time.used;
        if (tokens[i] === 'on') i += 1;
        const after = readDay(tokens, i, now);
        if (after) return done(at(after.day, time.hour, time.minute), true, i + after.used);
        let when = at(startOfDay(now), time.hour, time.minute);
        if (when <= now) when = at(addDays(startOfDay(now), 1), time.hour, time.minute);
        return done(when, true, time.used);
    }
    return null;
}

function at(day, hour, minute) {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
}

/**
 * A time at the end of `text` ("Fix login tomorrow", "Ship it due friday 5pm"): the longest
 * trailing run of words that is a whole time. Returns { at, hasTime, before } or null.
 * `lead` words ("due", "by") right before the time are dropped.
 */
export function parseTrailingWhen(text, { now = new Date(), defaultHour = 9, lead = ['due', 'by', 'on'] } = {}) {
    const raw = tokenize(text);
    for (let i = 0; i < raw.length; i += 1) {
        const tail = raw.slice(i).join(' ');
        const hit = parseWhen(tail, { now, defaultHour });
        if (hit && hit.used === raw.length - i) {
            let start = i;
            while (start > 0 && lead.includes(raw[start - 1].toLowerCase())) start -= 1;
            return { at: hit.at, hasTime: hit.hasTime, before: raw.slice(0, start).join(' ') };
        }
    }
    return null;
}

const pad = (n) => String(n).padStart(2, '0');
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function clockText(d) {
    const h = d.getHours();
    return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "today 5:00 PM", "tomorrow", "Fri 9:00 AM", "Mon, Nov 2" (no time when `hasTime` is false). */
export function whenText(date, { now = new Date(), hasTime = true } = {}) {
    const d = new Date(date);
    const days = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
    let day;
    if (days === 0) day = 'today';
    else if (days === 1) day = 'tomorrow';
    else if (days > 1 && days < 7) day = SHORT_DAYS[d.getDay()];
    else day = `${SHORT_DAYS[d.getDay()]}, ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}${d.getFullYear() !== now.getFullYear() ? `, ${d.getFullYear()}` : ''}`;
    return hasTime ? `${day} ${clockText(d)}` : day;
}

/** Local calendar date as "2026-11-02". */
export function isoDay(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
