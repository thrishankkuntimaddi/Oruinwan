// Small date helpers. Everything works from wall-clock time (Date.now()).

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function toDate(v) {
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** "now", "5m", "3h", "Tue", "12 Mar" — compact labels for list rows. */
export function shortAgo(value, now = Date.now()) {
  const d = toDate(value);
  if (!d) return '';
  const diff = now - d.getTime();
  if (diff < MIN) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m`;
  if (diff < DAY && isSameDay(d, now)) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 6 * DAY) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function clock(value) {
  const d = toDate(value);
  return d ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
}

/** "Today", "Yesterday", "Monday, 3 March" — chat day dividers. */
export function dayLabel(value, now = Date.now()) {
  const d = toDate(value);
  if (!d) return '';
  const today = startOfDay(now).getTime();
  const day = startOfDay(d).getTime();
  if (day === today) return 'Today';
  if (day === today - DAY) return 'Yesterday';
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Due-date label plus a tone for colouring: overdue / today / soon / later. */
export function dueLabel(value, now = Date.now()) {
  const d = toDate(value);
  if (!d) return null;
  const days = Math.round((startOfDay(d) - startOfDay(now)) / DAY);
  if (days < 0) return { text: days === -1 ? 'Yesterday' : `${-days}d overdue`, tone: 'overdue' };
  if (days === 0) return { text: 'Today', tone: 'today' };
  if (days === 1) return { text: 'Tomorrow', tone: 'soon' };
  if (days < 7) return { text: d.toLocaleDateString(undefined, { weekday: 'short' }), tone: 'soon' };
  return { text: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), tone: 'later' };
}

export function greeting(now = new Date()) {
  const h = new Date(now).getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export const ms = { MIN, HOUR, DAY };
