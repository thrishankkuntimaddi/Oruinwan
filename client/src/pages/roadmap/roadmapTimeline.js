/**
 * Pure helpers for the roadmap timeline: quarter math, date <-> position mapping,
 * drag maths, lane grouping and progress. No React, no network (unit tested).
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export const STATUSES = [
    { value: 'planned', label: 'Planned', tone: undefined },
    { value: 'in_progress', label: 'In progress', tone: 'accent' },
    { value: 'at_risk', label: 'At risk', tone: 'warning' },
    { value: 'done', label: 'Done', tone: 'success' },
];

export const COLORS = ['accent', 'color-primary', 'color-success', 'color-warning', 'color-danger', 'text-muted'];

export const statusMeta = (status) => STATUSES.find((s) => s.value === status) || STATUSES[0];

const toDate = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const d = v instanceof Date ? new Date(v.getTime()) : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

/** UTC midnight of a date. */
export function startOfDay(d) {
    const x = toDate(d);
    if (!x) return null;
    return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

/** { year, q } (q = 1..4) of a date, in UTC. */
export function quarterOf(date) {
    const d = toDate(date);
    if (!d) return null;
    return { year: d.getUTCFullYear(), q: Math.floor(d.getUTCMonth() / 3) + 1 };
}

export const quarterKey = ({ year, q }) => `${year}-Q${q}`;

export function parseQuarterKey(key) {
    const m = /^(\d{4})-Q([1-4])$/.exec(String(key || ''));
    return m ? { year: Number(m[1]), q: Number(m[2]) } : null;
}

export const quarterStart = ({ year, q }) => new Date(Date.UTC(year, (q - 1) * 3, 1));
/** Exclusive end: the first day of the next quarter. */
export const quarterEnd = ({ year, q }) => new Date(Date.UTC(year, q * 3, 1));

export function addQuarters({ year, q }, n) {
    const idx = year * 4 + (q - 1) + n;
    return { year: Math.floor(idx / 4), q: (((idx % 4) + 4) % 4) + 1 };
}

/**
 * The span an item covers on the timeline: its own dates, else its quarter, else null
 * (unscheduled). An item with only one date gets a two-week bar.
 */
export function itemSpan(item) {
    let start = startOfDay(item?.startDate);
    let end = startOfDay(item?.endDate);
    if (!start && !end) {
        const q = parseQuarterKey(item?.quarter);
        if (!q) return null;
        return { start: quarterStart(q), end: new Date(quarterEnd(q).getTime() - DAY_MS), fromQuarter: true };
    }
    if (!start) start = new Date(end.getTime() - 13 * DAY_MS);
    if (!end) end = new Date(start.getTime() + 13 * DAY_MS);
    if (end < start) [start, end] = [end, start];
    return { start, end, fromQuarter: false };
}

/**
 * Whole quarters covering every scheduled item and today, at least `minQuarters` wide.
 * Returns { start, end, quarters: [{ key, label, start, end }] }; `end` is exclusive.
 */
export function buildRange(items = [], now = new Date(), { minQuarters = 4 } = {}) {
    const current = quarterOf(now);
    let first = current;
    let last = current;
    const idx = (x) => x.year * 4 + x.q;
    for (const it of items) {
        const span = itemSpan(it);
        if (!span) continue;
        const a = quarterOf(span.start);
        const b = quarterOf(span.end);
        if (idx(a) < idx(first)) first = a;
        if (idx(b) > idx(last)) last = b;
    }
    while (idx(last) - idx(first) + 1 < minQuarters) last = addQuarters(last, 1);
    const quarters = [];
    for (let cur = first; idx(cur) <= idx(last); cur = addQuarters(cur, 1)) {
        quarters.push({ key: quarterKey(cur), label: `Q${cur.q} ${cur.year}`, start: quarterStart(cur), end: quarterEnd(cur) });
    }
    return { start: quarters[0].start, end: quarters[quarters.length - 1].end, quarters };
}

/** Position of a date on the range as a percentage 0..100 (clamped). */
export function dateToPct(date, range) {
    const d = toDate(date);
    if (!d) return 0;
    const total = range.end.getTime() - range.start.getTime();
    const pct = ((d.getTime() - range.start.getTime()) / total) * 100;
    return Math.max(0, Math.min(100, pct));
}

/** Inverse of dateToPct, snapped to a UTC day. */
export function pctToDate(pct, range) {
    const total = range.end.getTime() - range.start.getTime();
    const t = range.start.getTime() + (Math.max(0, Math.min(100, pct)) / 100) * total;
    return startOfDay(new Date(t + DAY_MS / 2));
}

/** { left, width } percentages of an item's bar, or null when unscheduled. Min width 0.6%. */
export function barGeometry(item, range) {
    const span = itemSpan(item);
    if (!span) return null;
    const left = dateToPct(span.start, range);
    const right = dateToPct(new Date(span.end.getTime() + DAY_MS), range);
    return { left, width: Math.max(0.6, right - left) };
}

/** Whole days a horizontal drag of `dx` pixels moves on a track `trackWidth` pixels wide. */
export function pxToDays(dx, trackWidth, range) {
    if (!trackWidth) return 0;
    const days = (range.end.getTime() - range.start.getTime()) / DAY_MS;
    return Math.round((dx / trackWidth) * days);
}

/**
 * New { startDate, endDate } (ISO yyyy-mm-dd) after dragging by `days`.
 * mode: 'move' shifts both, 'start' / 'end' resize one edge (never past the other).
 */
export function applyDrag(item, mode, days) {
    const span = itemSpan(item);
    if (!span) return null;
    let start = new Date(span.start.getTime());
    let end = new Date(span.end.getTime());
    const shift = days * DAY_MS;
    if (mode === 'move') { start = new Date(start.getTime() + shift); end = new Date(end.getTime() + shift); }
    else if (mode === 'start') { start = new Date(Math.min(start.getTime() + shift, end.getTime())); }
    else if (mode === 'end') { end = new Date(Math.max(end.getTime() + shift, start.getTime())); }
    return { startDate: isoDay(start), endDate: isoDay(end) };
}

export function isoDay(d) {
    const x = toDate(d);
    return x ? x.toISOString().slice(0, 10) : '';
}

const ownerKey = (it) => String(it?.ownerId?._id || it?.ownerId || '');

/**
 * Lanes for the timeline. by: 'status' (fixed order, empty lanes kept) or 'owner'
 * (one lane per owner, alphabetical, "No owner" last).
 */
export function groupItems(items = [], by = 'status') {
    const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (by === 'owner') {
        const lanes = new Map();
        for (const it of sorted) {
            const key = ownerKey(it) || 'none';
            if (!lanes.has(key)) {
                const label = key === 'none' ? 'No owner' : (it.ownerId?.username || 'Unknown');
                lanes.set(key, { key, label, owner: key === 'none' ? null : it.ownerId, items: [] });
            }
            lanes.get(key).items.push(it);
        }
        return [...lanes.values()].sort((a, b) => {
            if (a.key === 'none') return 1;
            if (b.key === 'none') return -1;
            return a.label.localeCompare(b.label);
        });
    }
    return STATUSES.map((s) => ({ key: s.value, label: s.label, tone: s.tone, items: sorted.filter((it) => (it.status || 'planned') === s.value) }));
}

/** 0..100 progress of an item (server-computed `progress.percent`, else by status). */
export function progressOf(item) {
    const p = Number(item?.progress?.percent);
    if (Number.isFinite(p)) return Math.max(0, Math.min(100, Math.round(p)));
    return item?.status === 'done' ? 100 : 0;
}

/** One-line summary of what the progress is made of. */
export function progressLabel(item) {
    const t = item?.progress?.tasks;
    const m = item?.progress?.milestones;
    if (t && t.total > 0) return `${t.done}/${t.total} tasks done`;
    if (m && m.total > 0) return `${m.completed}/${m.total} milestones complete`;
    return item?.status === 'done' ? 'Done' : 'Nothing linked yet';
}

/** CSS colour of an item from its theme-token name. */
export const colorVar = (color) => `var(--${COLORS.includes(color) ? color : 'accent'})`;
