// Meeting helpers, free of React.

/** Sticky note colours from the app's own palette (gold, amber, green, blue). */
export const STICKY_COLORS = ['#f5c46b', '#f39a6b', '#8fd1ad', '#9cc4fe'];

/** "Tue, Mar 3, 10:30 AM", or "Now" while it runs. */
export function meetingWhen(iso, duration = 30, now = Date.now()) {
  if (!iso) return 'No time set';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'No time set';
  if (d.getTime() <= now && d.getTime() + duration * 60000 > now) return 'Now';
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** '2026-03-03' + '10:30' (local) → ISO string, or null. */
export function combineDateTime(date, time) {
  if (!date || !time) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const out = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(out.getTime()) ? null : out.toISOString();
}

/** Applies a brainstorm:update ({ action: add|update|delete, item | itemId }) to the note list. */
export function applyBrainstormEvent(list, payload, map = (x) => x) {
  const action = payload?.action;
  if (action === 'delete') return list.filter((n) => n.id !== String(payload.itemId));
  if (!payload?.item) return list;
  const item = map(payload.item);
  if (!item?.id) return list;
  const at = list.findIndex((n) => n.id === item.id);
  if (at >= 0) return list.map((n, i) => (i === at ? { ...n, ...item } : n));
  return action === 'add' || action === 'update' ? [...list, item] : list;
}
