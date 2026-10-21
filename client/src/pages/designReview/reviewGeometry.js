/**
 * Pure helpers for design reviews: annotation coordinates (normalised 0..1 of the
 * rendered frame), video timestamps, live annotation list updates and status labels.
 */

/** Smaller than this (fraction of the frame) a drag counts as a click: a pin, not a box. */
export const MIN_BOX = 0.01;
/** Video annotations show for this long around their timestamp. */
export const VIDEO_WINDOW_MS = 2000;

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const round4 = (v) => Math.round(v * 10000) / 10000;

/** A pointer position relative to an element's rect, normalised to 0..1 (clamped). */
export function normalisePoint(clientX, clientY, rect) {
    if (!rect || !rect.width || !rect.height) return { x: 0, y: 0 };
    return { x: round4(clamp01((clientX - rect.left) / rect.width)), y: round4(clamp01((clientY - rect.top) / rect.height)) };
}

/**
 * Box from two normalised corners (any drag direction). Tiny drags become a pin
 * (w = h = 0). Always satisfies x + w <= 1 and y + h <= 1 like the server requires.
 */
export function normaliseRect(a, b) {
    const x1 = clamp01(Math.min(a.x, b.x));
    const y1 = clamp01(Math.min(a.y, b.y));
    const x2 = clamp01(Math.max(a.x, b.x));
    const y2 = clamp01(Math.max(a.y, b.y));
    let w = x2 - x1;
    let h = y2 - y1;
    if (w < MIN_BOX && h < MIN_BOX) return { x: round4(a.x), y: round4(a.y), w: 0, h: 0 };
    w = Math.min(round4(w), round4(1 - x1));
    h = Math.min(round4(h), round4(1 - y1));
    return { x: round4(x1), y: round4(y1), w, h };
}

/** CSS position of an annotation over its frame (percentages). */
export function annotationStyle(a) {
    const style = { left: `${clamp01(a.x) * 100}%`, top: `${clamp01(a.y) * 100}%` };
    if (a.w > 0 || a.h > 0) {
        style.width = `${clamp01(a.w) * 100}%`;
        style.height = `${clamp01(a.h) * 100}%`;
    }
    return style;
}

export const isPin = (a) => !(a?.w > 0 || a?.h > 0);

/** m:ss (or h:mm:ss) of a millisecond position. */
export function formatTimestamp(ms) {
    if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return '';
    const total = Math.max(0, Math.floor(Number(ms) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * Whether an annotation is drawn over the current frame: same PDF page, and for
 * videos within VIDEO_WINDOW_MS after its timestamp (annotations without one always show).
 */
export function visibleOn(a, { page = 1, timeMs = null, kind = 'image' } = {}) {
    if (kind === 'pdf' && (a.page || 1) !== page) return false;
    if (kind === 'video' && a.timeMs !== null && a.timeMs !== undefined && timeMs !== null) {
        return timeMs >= a.timeMs - 250 && timeMs <= a.timeMs + VIDEO_WINDOW_MS;
    }
    return true;
}

/** Thread order: open before resolved, then by video time / page, then oldest first. */
export function sortAnnotations(list = []) {
    return [...list].sort((a, b) => {
        if (Boolean(a.resolved) !== Boolean(b.resolved)) return a.resolved ? 1 : -1;
        const ta = a.timeMs ?? -1; const tb = b.timeMs ?? -1;
        if (ta !== tb) return ta - tb;
        if ((a.page || 1) !== (b.page || 1)) return (a.page || 1) - (b.page || 1);
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });
}

/** Apply a `design-review:annotation` socket event to a list (upsert by _id, remove on deleted). */
export function applyAnnotationEvent(list = [], event) {
    const a = event?.annotation;
    if (!a?._id) return list;
    if (event.action === 'deleted') return list.filter((x) => x._id !== a._id);
    const i = list.findIndex((x) => x._id === a._id);
    if (i === -1) return [...list, a];
    const next = list.slice();
    next[i] = { ...list[i], ...a };
    return next;
}

export const REVIEW_STATUS = {
    open: { label: 'In review', tone: 'accent' },
    changes_requested: { label: 'Changes requested', tone: 'warning' },
    approved: { label: 'Approved', tone: 'success' },
};
export const DECISION = {
    pending: { label: 'Pending', tone: undefined },
    approved: { label: 'Approved', tone: 'success' },
    changes_requested: { label: 'Changes requested', tone: 'warning' },
};

/** Reviewable kind of a mime type, or null (images, PDFs and videos only). */
export function reviewKind(mimeType = '') {
    const m = String(mimeType || '').toLowerCase();
    if (m.startsWith('image/')) return 'image';
    if (m === 'application/pdf') return 'pdf';
    if (m.startsWith('video/')) return 'video';
    return null;
}
