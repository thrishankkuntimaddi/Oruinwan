// The Activity calendar's data: meetings and huddles, task due dates, message reminders and
// scheduled messages, as one list of dated events. No React here.

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};
export { dayKey };

/**
 * events: [{ id, kind: 'meeting' | 'huddle' | 'task' | 'reminder' | 'scheduled', title, at, end?, allDay?, ref }]
 * sorted by time.
 */
export function calendarEvents({ meetings = [], tasks = [], reminders = [], scheduled = [], me } = {}) {
  const out = [];
  for (const m of meetings) {
    const at = m.start || m.startedAt;
    if (!at) continue;
    out.push({ id: `m:${m.id}`, kind: m.kind === 'huddle' ? 'huddle' : 'meeting', title: m.title, at, end: m.end || m.endedAt || null, ref: m });
  }
  for (const t of tasks) {
    if (!t.due || ['done', 'cancelled'].includes(t.status)) continue;
    if (me && !t.assigneeIds?.includes(me) && t.createdBy !== me) continue;
    out.push({ id: `t:${t.id}`, kind: 'task', title: t.title, at: t.due, allDay: true, ref: t });
  }
  for (const r of reminders) {
    if (!r.at) continue;
    out.push({ id: `r:${r.id}`, kind: 'reminder', title: r.note || (r.message?.text ? `Reminder: ${String(r.message.text).slice(0, 60)}` : 'Reminder'), at: r.at, ref: r });
  }
  for (const s of scheduled) {
    if (!s.sendAt) continue;
    out.push({ id: `s:${s.id}`, kind: 'scheduled', title: s.text ? `Send: ${String(s.text).slice(0, 60)}` : 'Scheduled message', at: s.sendAt, ref: s });
  }
  return out.sort((a, b) => Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) || String(a.at).localeCompare(String(b.at)));
}

/** Map of "y-m-d" → events that day. */
export function eventsByDay(events) {
  const map = new Map();
  for (const e of events) {
    const k = dayKey(e.at);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }
  return map;
}

/** A month's weeks, Monday first; padding days are null. */
export function monthWeeks(year, month) {
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(pad).fill(null), ...Array.from({ length: count }, (_, i) => new Date(year, month, i + 1))];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
