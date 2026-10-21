// Planning helpers, free of React: time totals, sprint boards, milestones and the timeline.
import { describeRecurring } from './recurrence.js';

const DAY = 86_400_000;

/** 3725 → "1h 2m", 59 → "59s", 0 → "0m". */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (s < 60) return s ? `${s}s` : '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** A running clock: "1:02:05" or "2:05". */
export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function recurrenceLabel(r) {
  if (!r) return 'Does not repeat';
  return describeRecurring({ isRecurring: true, ...r });
}

/**
 * The open timer session of this person (every member runs their own timer). Older sessions
 * without a `user` count as the caller's only when nobody else's is open.
 */
export function myOpenSession(timeTracking, me) {
  const open = (timeTracking?.sessions || []).filter((s) => s && s.start && !s.end);
  const userOf = (s) => (s.user && typeof s.user === 'object' ? String(s.user._id || s.user.id || '') : s.user ? String(s.user) : null);
  return open.find((s) => me && userOf(s) === String(me)) || (open.length === 1 && !userOf(open[0]) ? open[0] : null);
}

/** Hours + minutes typed in the "Log time" sheet → whole minutes (null when out of 1 min … 24 h). */
export function minutesFrom(hours, minutes) {
  const total = Math.round((Number(hours) || 0) * 60 + (Number(minutes) || 0));
  return total >= 1 && total <= 24 * 60 ? total : null;
}

/** Sprints a task can move into: not finished ones, active first. */
export function openSprints(sprints) {
  const order = { active: 0, planning: 1 };
  return (sprints || []).filter((s) => s.status in order).sort((a, b) => order[a.status] - order[b.status] || String(a.start).localeCompare(String(b.start)));
}

export const BOARD_STATUSES = ['todo', 'in_progress', 'review', 'blocked', 'done'];

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/** Tasks in a sprint grouped by status column (backlog joins To do). */
export function sprintBoard(tasks, sprintId) {
  const inSprint = (tasks || []).filter((t) => sameId(t.sprintId, sprintId) && t.status !== 'cancelled');
  return BOARD_STATUSES.map((status) => ({
    status,
    items: inSprint.filter((t) => (status === 'todo' ? t.status === 'todo' || t.status === 'backlog' : t.status === status)),
  }));
}

/** { total, done, percent } for a milestone (server counts when present, else from tasks). */
export function milestoneProgress(milestone, tasks) {
  let total;
  let done;
  if (milestone?.counts && Number.isFinite(milestone.counts.total)) {
    ({ total, done } = milestone.counts);
  } else {
    const mine = (tasks || []).filter((t) => sameId(t.milestoneId, milestone?.id));
    total = mine.length;
    done = mine.filter((t) => t.status === 'done').length;
  }
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

function dayStart(v) {
  const d = new Date(v);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * The timeline: tasks with a due date placed on a day axis. Each bar runs from the task's
 * start (or created date, at most `maxDays` before due) to its due date.
 * Returns { from, to, days, rows: [{ task, left, width }] } with left/width in percent.
 */
export function timelineRows(tasks, { now = Date.now(), maxDays = 21, minSpan = 14 } = {}) {
  const dated = (tasks || []).filter((t) => t.due && !Number.isNaN(new Date(t.due).getTime()));
  if (!dated.length) return { from: dayStart(now), to: dayStart(now) + minSpan * DAY, days: minSpan, rows: [] };
  const bars = dated.map((t) => {
    const end = dayStart(t.due) + DAY;
    let start = t.start ? dayStart(t.start) : end - DAY;
    if (Number.isNaN(start) || start >= end) start = end - DAY;
    start = Math.max(start, end - maxDays * DAY);
    return { task: t, start, end };
  });
  let from = Math.min(...bars.map((b) => b.start), dayStart(now));
  let to = Math.max(...bars.map((b) => b.end), dayStart(now) + DAY);
  if ((to - from) / DAY < minSpan) to = from + minSpan * DAY;
  const span = to - from;
  const rows = bars
    .sort((a, b) => a.end - b.end || a.start - b.start)
    .map((b) => ({ task: b.task, left: ((b.start - from) / span) * 100, width: Math.max(((b.end - b.start) / span) * 100, 1.5) }));
  return { from, to, days: Math.round(span / DAY), rows };
}

/** Workload bars: [{ ..., percent }] relative to the busiest person. */
export function workloadBars(list) {
  const max = Math.max(1, ...(list || []).map((w) => w.count || 0));
  return (list || []).map((w) => ({ ...w, percent: Math.round(((w.count || 0) / max) * 100) }));
}

// ---------------------------------------------------------------- time report

/** Periods of the time report; the same presets as the web's Time report. */
export const REPORT_RANGES = [
  { value: 'week', label: 'This week' },
  { value: '7d', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

/** { from, to } ISO strings for a report period, relative to `now` ('all' → no bounds). */
export function reportRange(preset, now = new Date()) {
  if (preset === 'all') return {};
  const s = new Date(now);
  s.setHours(0, 0, 0, 0);
  if (preset === 'week') s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  else if (preset === 'month') s.setDate(1);
  else s.setDate(s.getDate() - ((preset === '30d' ? 30 : 7) - 1));
  return { from: s.toISOString(), to: new Date(now).toISOString() };
}

/** Rows sorted by time (largest first), each with its share of the total in percent. */
export function reportRows(rows, totalSeconds) {
  const list = rows || [];
  const total = totalSeconds || list.reduce((n, r) => n + (r.seconds || 0), 0);
  return [...list]
    .sort((a, b) => (b.seconds || 0) - (a.seconds || 0))
    .map((r) => ({ ...r, share: total ? Math.round(((r.seconds || 0) / total) * 100) : 0 }));
}
