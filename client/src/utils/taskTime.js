/**
 * Task time tracking and blocker helpers (docs/api/tasks.md).
 */

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : '');

/** 409 TASK_BLOCKED → { message, blockers: [{ id, title, issueKey, status }] }, else null. */
export function blockedFromError(err) {
  const res = err?.response;
  const data = res?.data;
  if (!res || res.status !== 409 || !data || data.code !== 'TASK_BLOCKED') return null;
  const blockers = (Array.isArray(data.blockers) ? data.blockers : []).map((b) => ({
    id: idOf(b), title: b?.title || '', issueKey: b?.issueKey || '', status: b?.status || null,
  }));
  return { message: data.message || 'This task is blocked by open tasks', blockers };
}

/** The open timer session that belongs to `userId` (legacy sessions without a user count as anyone's). */
export function myOpenSession(sessions = [], userId) {
  const open = (sessions || []).filter((s) => s && s.start && !s.end);
  if (!userId) return open[open.length - 1] || null;
  const mine = open.filter((s) => !s.user || idOf(s.user) === String(userId));
  return mine[mine.length - 1] || null;
}

/** People other than `userId` whose timers are running, from GET /:id/time byUser. */
export function othersRunning(byUser = [], userId) {
  return (byUser || []).filter((u) => u.running && String(u.userId) !== String(userId || ''));
}

/**
 * Parse a duration typed by a person: "90" (minutes), "1h 30m", "1.5h", "45m", "1:30", "2h".
 * Returns seconds, or null when it can't be read. Server limits: 1 s … 24 h.
 */
export function parseDuration(input) {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s) return null;
  let m = s.match(/^(\d{1,2}):([0-5]\d)$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 60);
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|s|sec|secs|seconds?)\b/g;
  let total = 0;
  let matched = '';
  while ((m = re.exec(s))) {
    const n = Number(m[1]);
    const unit = m[2][0];
    total += unit === 'h' ? n * 3600 : unit === 'm' ? n * 60 : n;
    matched += m[0];
  }
  if (!matched || s.replace(/\s+/g, '') !== matched.replace(/\s+/g, '')) return null;
  return Math.round(total);
}

export const MAX_LOG_SECONDS = 24 * 3600;

/** Validation message for a manual log, or null when fine. */
export function logError(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return 'Enter a duration like 45m, 1h 30m or 1:30';
  if (seconds < 1) return 'Log at least one second';
  if (seconds > MAX_LOG_SECONDS) return 'You can log up to 24 hours at a time';
  return null;
}

/** "3h 05m" style for reports. */
export function fmtHours(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Percent of an estimate used (0 when there is no estimate). */
export function estimatePct(seconds, estimatedHours) {
  if (!estimatedHours || estimatedHours <= 0) return 0;
  return Math.round(((seconds || 0) / (estimatedHours * 3600)) * 100);
}

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** { from, to } ISO strings for a report range preset, relative to `now`. */
export function reportRange(preset, now = new Date()) {
  const end = new Date(now);
  if (preset === 'all') return { from: undefined, to: undefined };
  if (preset === 'week') {
    const s = startOfDay(now);
    const dow = (s.getDay() + 6) % 7; // Monday = 0
    s.setDate(s.getDate() - dow);
    return { from: s.toISOString(), to: end.toISOString() };
  }
  if (preset === 'month') {
    const s = startOfDay(now);
    s.setDate(1);
    return { from: s.toISOString(), to: end.toISOString() };
  }
  const days = preset === '30d' ? 30 : 7;
  const s = startOfDay(now);
  s.setDate(s.getDate() - (days - 1));
  return { from: s.toISOString(), to: end.toISOString() };
}

/** Sort the report's rows (largest first) and add each one's share of the total. */
export function reportRows(rows = [], totalSeconds = 0) {
  const total = totalSeconds || rows.reduce((n, r) => n + (r.seconds || 0), 0);
  return [...rows]
    .sort((a, b) => (b.seconds || 0) - (a.seconds || 0))
    .map((r) => ({ ...r, share: total ? Math.round(((r.seconds || 0) / total) * 100) : 0 }));
}

/** CSV text for the time report (one section per table). */
export function reportCsv(report) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['Person,Hours,Tasks'];
  for (const u of report?.byUser || []) {
    lines.push([q(u.user?.username || u.userId), ((u.seconds || 0) / 3600).toFixed(2), u.tasks ?? ''].join(','));
  }
  lines.push('', 'Task,Key,Hours,Estimated hours');
  for (const t of report?.byTask || []) {
    lines.push([q(t.title), q(t.issueKey), ((t.seconds || 0) / 3600).toFixed(2), t.estimatedHours ?? ''].join(','));
  }
  return lines.join('\n');
}
