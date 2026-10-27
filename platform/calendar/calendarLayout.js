// Calendar layout shared by the web and phone apps: month grids, week days, the hour grid and
// side-by-side placement of overlapping events. No React, no DOM. Weeks start on Monday.
//
// An event is { id, kind, title, at, end?, allDay? } with ISO (or Date-parsable) times.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_EVENT_MINUTES = 30;

export const startOfDay = (d) => {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
};
export const addDays = (d, n) => {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate() + n);
};
export const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};

/** Monday of the week `d` is in. */
export function startOfWeek(d) {
  const x = startOfDay(d);
  return addDays(x, -((x.getDay() + 6) % 7));
}

/** The 7 days of the week `d` is in, Monday first. */
export function weekDays(d) {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * A month as 6 weeks of 7 days (Monday first), with the days from the months around it:
 * [[{ date, inMonth }]].
 */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, w * 7 + i);
    return { date, inMonth: date.getMonth() === month };
  }));
}

/** Events on a given day (an event spanning midnight shows on each day it covers). */
export function eventsOn(events, day) {
  const from = startOfDay(day).getTime();
  const to = from + DAY_MS;
  return (events || []).filter((e) => {
    const s = new Date(e.at).getTime();
    if (e.allDay) return s >= from && s < to;
    const end = e.end ? new Date(e.end).getTime() : s + DEFAULT_EVENT_MINUTES * 60000;
    return s < to && end > from;
  });
}

/** Map of dayKey → events, for month views. */
export function eventsByDay(events) {
  const map = new Map();
  for (const e of events || []) {
    const k = dayKey(e.at);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }
  return map;
}

/**
 * One day's timed events placed on the hour grid:
 * [{ event, top, height, column, columns }] where top/height are minutes from midnight (clamped
 * to the day) and overlapping events sit side by side (column of columns).
 */
export function layoutDay(events, day, { minMinutes = 20 } = {}) {
  const from = startOfDay(day).getTime();
  const items = eventsOn(events, day)
    .filter((e) => !e.allDay)
    .map((e) => {
      const s = new Date(e.at).getTime();
      const end = e.end ? new Date(e.end).getTime() : s + DEFAULT_EVENT_MINUTES * 60000;
      const top = Math.max(0, (s - from) / 60000);
      const bottom = Math.min(24 * 60, Math.max(top + minMinutes, (end - from) / 60000));
      return { event: e, top, height: bottom - top };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);

  // Groups of events that overlap each other; within a group, each takes the first free column.
  const out = [];
  let group = [];
  let groupEnd = -1;
  const flush = () => {
    const cols = [];
    for (const it of group) {
      let c = cols.findIndex((end) => end <= it.top);
      if (c === -1) { c = cols.length; cols.push(0); }
      cols[c] = it.top + it.height;
      it.column = c;
    }
    for (const it of group) out.push({ ...it, columns: cols.length });
    group = [];
    groupEnd = -1;
  };
  for (const it of items) {
    if (group.length && it.top >= groupEnd) flush();
    group.push(it);
    groupEnd = Math.max(groupEnd, it.top + it.height);
  }
  if (group.length) flush();
  return out;
}

/** "Oct 26 – Nov 1, 2026" / "October 2026" / "Tuesday, October 27" for the toolbar. */
export function rangeTitle(view, cursor, locale) {
  const d = new Date(cursor);
  if (view === 'month') return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  if (view === 'day') return d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  if (view === 'agenda') return 'Upcoming';
  const days = weekDays(d);
  const a = days[0];
  const b = days[6];
  const sameMonth = a.getMonth() === b.getMonth();
  const left = a.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  const right = b.toLocaleDateString(locale, sameMonth ? { day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  return `${left} – ${right}`;
}

/** Moves the cursor one step of the view (month, week or day) forward (+1) or back (-1). */
export function stepCursor(view, cursor, dir) {
  const d = new Date(cursor);
  if (view === 'month') return new Date(d.getFullYear(), d.getMonth() + dir, 1);
  if (view === 'week' || view === 'agenda') return addDays(d, 7 * dir);
  return addDays(d, dir);
}

/** Upcoming events from `from` for `days` days, grouped by day: [{ day, events }]. */
export function agenda(events, from = new Date(), days = 30) {
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const day = addDays(startOfDay(from), i);
    const list = eventsOn(events, day);
    if (list.length) out.push({ day, events: list });
  }
  return out;
}

/** "9 AM" / "13:00" labels for the hour grid. */
export function hourLabel(h, locale) {
  return new Date(2000, 0, 1, h).toLocaleTimeString(locale, { hour: 'numeric' });
}
