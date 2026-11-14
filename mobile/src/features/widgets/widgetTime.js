// Time labels for the widgets (short: they sit in a small card).
export { dueLabel } from '../../lib/time.js';

/** "Now", "Today 3:30 PM", "Tomorrow 9:00 AM", "Mon 10:00 AM", "12 Dec". */
export function meetingTimeLabel(iso, duration = 30, now = Date.now()) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  const t = d.getTime();
  if (t <= now && t + duration * 60000 > now) return 'Now';
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const day = (x) => new Date(new Date(x).toDateString()).getTime();
  const days = Math.round((day(t) - day(now)) / 86_400_000);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
