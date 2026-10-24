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

// ---------------------------------------------------------------- the meeting page

/** The meeting page's tabs, same names and order as the web (and inside a call). */
export const MEETING_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'notes', label: 'Notes' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'summary', label: 'Summary & actions' },
  { value: 'whiteboard', label: 'Whiteboard' },
  { value: 'brainstorm', label: 'Brainstorm' },
];

const OLD_TABS = { actions: 'summary', board: 'brainstorm' };
/** A tab name from a link or an older build ("actions", "board") → one of MEETING_TABS. */
export function meetingTab(name, fallback = 'overview') {
  const v = OLD_TABS[name] || name;
  return MEETING_TABS.some((t) => t.value === v) ? v : fallback;
}

export const STATUS_LABEL = { scheduled: 'Scheduled', live: 'Live now', completed: 'Ended', cancelled: 'Cancelled' };

/** "42 min", "1 h 5 min", "under a minute". */
export function durationLabel(sec) {
  const s = Number(sec);
  if (sec == null || !Number.isFinite(s) || s < 0) return null;
  if (s < 60) return 'under a minute';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

/** "# design", "DM with Carol", "Workspace". */
export function conversationLabel(c) {
  if (!c) return null;
  if (c.kind === 'channel') return c.name ? `# ${c.name}` : 'A channel';
  if (c.kind === 'dm') return c.name ? `DM with ${c.name}` : 'A direct message';
  return 'Workspace';
}

const shortDate = (iso) => new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** The second line of a meeting in a list. */
export function meetingSubtitle(m, now = Date.now()) {
  const parts = [];
  if (m.status === 'live') {
    parts.push('Live now');
    if (m.startedAt) parts.push(`started ${new Date(m.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
  } else if (m.status === 'completed' || m.status === 'cancelled') {
    const at = m.startedAt || m.start || m.endedAt;
    if (at) parts.push(shortDate(at));
    if (m.status === 'cancelled') parts.push('Cancelled');
    else parts.push(durationLabel(m.durationSec));
  } else {
    parts.push(meetingWhen(m.start, m.duration, now));
    parts.push(`${m.duration} min`);
  }
  if (m.kind === 'huddle') parts.push('Huddle');
  if (m.conversation && m.conversation.kind !== 'workspace') parts.push(conversationLabel(m.conversation));
  return parts.filter(Boolean).join(' · ');
}

/** The summary's text (an object now; a plain string in an older cached copy). */
export const summaryText = (s) => (typeof s === 'string' ? s : s?.text || '');

/** The load failed because the caller may not open this meeting (channel/DM members only). */
export const isAccessError = (err) => err?.status === 403;

/** Merges a list page into what is shown, without duplicates (live updates can add rows twice). */
export function mergePage(list, page) {
  const seen = new Set(list.map((m) => m.id));
  return [...list, ...page.filter((m) => !seen.has(m.id))];
}

// ---------------------------------------------------------------- whiteboard strokes

/** The board's coordinate space (the web's canvas): strokes are stored in it. */
export const BOARD_W = 1200;
export const BOARD_H = 700;

let strokeSeq = 0;
export const newStrokeId = () => `s-${Date.now().toString(36)}-${(strokeSeq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** One decimal, like the web. */
export const roundPoint = ({ x, y }) => ({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });

function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Whether `pos` touches the stroke (within `radius` plus half its width). */
export function strokeHit(stroke, pos, radius = 8) {
  const pts = stroke?.points;
  if (!Array.isArray(pts) || !pts.length || !pos) return false;
  const reach = radius + (Number(stroke.lineWidth) || 3) / 2;
  if (pts.length === 1) return Math.hypot(pos.x - pts[0].x, pos.y - pts[0].y) <= reach;
  for (let i = 1; i < pts.length; i++) if (distToSegment(pos, pts[i - 1], pts[i]) <= reach) return true;
  return false;
}

// ---------------------------------------------------------------- clashes and priority
// Server: features/meetings/conflicts.js (POST /v2/meetings/conflicts; meeting.priority / .conflicts).

export const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];
const PRIORITY_LABEL = Object.fromEntries(PRIORITIES.map((p) => [p.value, p.label]));
export const normalizePriority = (p) => (PRIORITY_LABEL[p] ? p : 'normal');
export const priorityLabel = (p) => PRIORITY_LABEL[normalizePriority(p)];

const hm = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const timeRange = (start, end) => `${hm(start)}–${hm(end)}`;

/** "Asha is busy 9:00–9:30 (Design review · High priority)", organiser ("You are") first. */
export function clashLines(result, nameOf = () => null) {
  if (!result || !Array.isArray(result.attendees)) return [];
  const people = [...result.attendees].sort((a, b) => Number(Boolean(b.isOrganizer)) - Number(Boolean(a.isOrganizer)));
  const out = [];
  for (const a of people) {
    for (const c of a.conflicts || []) {
      const who = a.isOrganizer ? 'You are' : `${a.name || nameOf(a.userId) || 'Someone'} is`;
      out.push({ key: `${a.userId}:${c.meetingId}`, text: `${who} busy ${timeRange(c.start, c.end)} (${c.title || 'Busy'} · ${priorityLabel(c.priority)} priority)` });
    }
  }
  return out;
}

/** Free slots from a clash check: [{ start, end }] (ISO), future ones only. */
export function clashSuggestions(result, now = Date.now()) {
  return (result?.suggestions || [])
    .filter((s) => s?.start && new Date(s.end).getTime() > now)
    .map((s) => ({ start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString() }));
}

/** The list marker: "Clashes with Standup" (my own clash) or "2 people double-booked"; null when none. */
export function clashMarker(m) {
  const list = Array.isArray(m?.conflicts) ? m.conflicts : [];
  if (!list.length || m.status === 'cancelled' || m.status === 'completed') return null;
  const mine = list.filter((c) => c.mine);
  if (mine.length) return `Clashes with ${mine[0].title || 'another meeting'}${mine.length > 1 ? ` +${mine.length - 1}` : ''}`;
  const n = new Set(list.flatMap((c) => c.userIds || [])).size || list.length;
  return `${n} ${n === 1 ? 'person' : 'people'} double-booked`;
}
