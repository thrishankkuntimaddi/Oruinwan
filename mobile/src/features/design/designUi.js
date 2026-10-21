// Design review helpers: pin coordinates, which pins show, live event reducers. No React here.

export const REVIEW_STATUS = {
  open: { label: 'In review', tone: 'text-info', chip: 'bg-info/15 text-info' },
  changes_requested: { label: 'Changes requested', tone: 'text-warning', chip: 'bg-warning/15 text-warning' },
  approved: { label: 'Approved', tone: 'text-success', chip: 'bg-success/12 text-success' },
};

export const DECISION_LABEL = { pending: 'Waiting', approved: 'Approved', changes_requested: 'Requested changes' };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const round4 = (v) => Math.round(v * 10_000) / 10_000;

/**
 * A tap on the rendered page/frame → normalised { x, y } (0..1, top-left origin), or null when
 * the tap is outside it. `rect` is the element's getBoundingClientRect().
 */
export function pinFromPoint(rect, clientX, clientY) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x: round4(clamp01(x)), y: round4(clamp01(y)) };
}

/** Where a pin is drawn: percentages for CSS (a box's centre for boxes). */
export function pinPosition(a) {
  const x = clamp01(Number(a.x) || 0) + (Number(a.w) > 0 ? Number(a.w) / 2 : 0);
  const y = clamp01(Number(a.y) || 0) + (Number(a.h) > 0 ? Number(a.h) / 2 : 0);
  return { left: `${round4(clamp01(x) * 100)}%`, top: `${round4(clamp01(y) * 100)}%` };
}

/** Pins numbered by when they were made (1, 2, …), so numbers don't shift when one is resolved. */
export function numberAnnotations(list) {
  const sorted = (list || []).slice().sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')) || String(a.id).localeCompare(String(b.id)));
  return new Map(sorted.map((a, i) => [a.id, i + 1]));
}

/** How close (ms) a video pin must be to the playhead to show on the frame. */
export const VIDEO_WINDOW_MS = 1500;

/** Pins to draw for this version / page / video time. */
export function visibleAnnotations(list, { versionNumber, page = 1, timeMs = null, showResolved = true, kind = 'image' } = {}) {
  return (list || []).filter((a) => {
    if (versionNumber != null && a.versionNumber != null && a.versionNumber !== versionNumber) return false;
    if (!showResolved && a.resolved) return false;
    if (kind === 'pdf' && (a.page || 1) !== page) return false;
    if (kind === 'video' && timeMs != null && a.timeMs != null && Math.abs(a.timeMs - timeMs) > VIDEO_WINDOW_MS) return false;
    return true;
  });
}

/** Pages that have pins (PDFs), with open counts, for the page switcher. */
export function pagesWithPins(list) {
  const pages = new Map();
  for (const a of list || []) {
    const p = a.page || 1;
    const cur = pages.get(p) || { page: p, total: 0, open: 0 };
    cur.total += 1;
    if (!a.resolved) cur.open += 1;
    pages.set(p, cur);
  }
  return [...pages.values()].sort((a, b) => a.page - b.page);
}

/**
 * Applies a `design-review:annotation` event ({ action, annotation }) to the list (upsert by id;
 * `deleted` removes). `map` turns the server shape into the app's.
 */
export function applyAnnotationEvent(list, payload, map) {
  const raw = payload?.annotation;
  const id = raw && String(raw._id || raw.id || '');
  if (!id) return list;
  const current = list || [];
  if (payload.action === 'deleted') return current.filter((a) => a.id !== id);
  const next = map(raw);
  if (!next) return current;
  const at = current.findIndex((a) => a.id === id);
  if (at < 0) return [...current, next];
  const copy = current.slice();
  copy[at] = next;
  return copy;
}

/** Live viewers set from a `design-review:presence` event. */
export function applyPresence(viewers, payload, me) {
  const id = payload?.userId && String(payload.userId);
  if (!id || id === me) return viewers;
  const set = new Set(viewers || []);
  if (payload.action === 'left') set.delete(id);
  else set.add(id);
  return [...set];
}

/** Summary line for the list ("2 open · 5 comments"). */
export function countsLabel(counts) {
  if (!counts) return '';
  const parts = [];
  if (counts.open) parts.push(`${counts.open} open`);
  if (counts.total) parts.push(`${counts.total} comment${counts.total === 1 ? '' : 's'}`);
  return parts.join(' · ') || 'No comments yet';
}

/** mm:ss for a video pin. */
export function formatTime(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** My reviewer entry, if I'm a reviewer. */
export const myReviewer = (review, me) => (review?.reviewers || []).find((r) => r.user?.id === me) || null;

/** Who may resolve / reopen a pin: its author, the review's creator, any reviewer. */
export function canResolve(annotation, review, me) {
  if (!me) return false;
  return annotation?.author?.id === me || review?.creator?.id === me || Boolean(myReviewer(review, me));
}

/** Who may delete a pin: its author, the review creator, a workspace admin (canManage covers creator + admins). */
export const canDeleteAnnotation = (annotation, review, me) => Boolean(me && (annotation?.author?.id === me || review?.permissions?.canManage));
