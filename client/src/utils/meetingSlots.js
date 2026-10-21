/**
 * "Find a time" answers from POST /api/v2/meetings/suggest-time, in any of the shapes
 * the server has used:
 *   { suggestedStart, suggestedEnd, durationMinutes, note }      (one slot)
 *   [{ start, end, score }, ...]                                 (several slots)
 *   { slots: [{ start, end, score }], note? }                    (several slots, wrapped)
 * normalizeTimeSuggestions turns any of them into [{ start: Date, end: Date, score }],
 * best first, with past and unreadable slots dropped.
 */

const toDate = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

function readSlot(raw, durationMinutes) {
    if (!raw || typeof raw !== 'object') return null;
    const start = toDate(raw.start ?? raw.startTime ?? raw.suggestedStart);
    if (!start) return null;
    let end = toDate(raw.end ?? raw.endTime ?? raw.suggestedEnd);
    if (!end || end <= start) end = new Date(start.getTime() + (Number(durationMinutes) || 30) * 60000);
    const score = Number.isFinite(Number(raw.score)) ? Number(raw.score) : null;
    return { start, end, score };
}

export function normalizeTimeSuggestions(data, { durationMinutes = 30, now = Date.now(), limit = 5 } = {}) {
    let list = [];
    if (Array.isArray(data)) list = data;
    else if (data && Array.isArray(data.slots)) list = data.slots;
    else if (data && Array.isArray(data.suggestions)) list = data.suggestions;
    else if (data && typeof data === 'object') list = [data];

    const seen = new Set();
    const slots = [];
    for (const raw of list) {
        const slot = readSlot(raw, durationMinutes);
        if (!slot) continue;
        if (slot.end.getTime() <= now) continue;
        const key = slot.start.getTime();
        if (seen.has(key)) continue;
        seen.add(key);
        slots.push(slot);
    }
    const scored = slots.some(s => s.score !== null);
    slots.sort((a, b) => (scored ? (b.score ?? -Infinity) - (a.score ?? -Infinity) : 0) || a.start - b.start);
    return slots.slice(0, limit);
}

/** The server's free-text note for people, when it sent one (developer placeholders are left out). */
export const suggestionNote = (data) => {
    const note = data && !Array.isArray(data) && typeof data.note === 'string' ? data.note.trim() : '';
    return /placeholder|integrate/i.test(note) ? '' : note;
};

/** "Tue 21 Oct · 14:30–15:00" in the viewer's locale. */
export function formatSlot({ start, end }) {
    const day = start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const t = (d) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${day} · ${t(start)}–${t(end)}`;
}

/** 0..1 scores as a short label; nothing when the server sent no score. */
export function slotFit(score) {
    if (score === null || score === undefined) return '';
    const s = score > 1 ? score / 100 : score;
    if (s >= 0.85) return 'Everyone free';
    if (s >= 0.6) return 'Most people free';
    return 'Some conflicts';
}
