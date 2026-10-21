/**
 * Pure helpers for the one meeting record (docs/api/meetings-unified.md).
 * Every call — a scheduled meeting or a quick huddle from a chat — has one
 * record; these helpers read it the same way on the meeting page, in the
 * in-call side panel and in the Huddles lists. No React here, so it is unit-tested.
 */

/** The shared tab set, same names and order everywhere. */
export const MEETING_TAB_IDS = ['overview', 'agenda', 'notes', 'transcript', 'summary', 'whiteboard', 'brainstorm'];
export const MEETING_TAB_LABELS = {
    overview: 'Overview',
    agenda: 'Agenda',
    notes: 'Notes',
    transcript: 'Transcript',
    summary: 'Summary & actions',
    whiteboard: 'Whiteboard',
    brainstorm: 'Brainstorm',
    chat: 'Chat',
};

/** Old tab names (links, bookmarks) → the current ones. */
const TAB_ALIASES = { actions: 'summary', recap: 'summary', 'action-items': 'summary', wrapup: 'summary', assistant: 'summary', tasks: 'summary' };

export function normaliseTab(tab, { allowChat = false } = {}) {
    const t = TAB_ALIASES[tab] || tab;
    if (MEETING_TAB_IDS.includes(t)) return t;
    if (allowChat && t === 'chat') return t;
    return null;
}

export const idOf = (v) => {
    if (v == null) return null;
    if (typeof v === 'object') return v._id != null ? String(v._id) : v.id != null ? String(v.id) : null;
    return String(v);
};

export const meetingIdOf = (m) => (m ? idOf(m.id || m._id) : null);

/**
 * meeting.summary is an object now ({ text, generatedAt, by, source, messageId, channelId, dmId }).
 * Older responses (and POST /:id/summarize) still give a plain string. Always returns an object or null.
 */
export function normaliseSummary(summary) {
    if (summary == null) return null;
    if (typeof summary === 'string') return summary.trim() ? { text: summary, generatedAt: null, by: null, source: null, messageId: null, channelId: null, dmId: null } : null;
    if (typeof summary !== 'object') return null;
    const text = typeof summary.text === 'string' ? summary.text : '';
    return {
        text,
        generatedAt: summary.generatedAt || null,
        by: idOf(summary.by),
        source: summary.source || null,
        messageId: summary.messageId || null,
        channelId: summary.channelId ? idOf(summary.channelId) : null,
        dmId: summary.dmId ? idOf(summary.dmId) : null,
    };
}

/** The summary's text, whatever shape it came in. */
export const summaryText = (summary) => normaliseSummary(summary)?.text || '';

const SUMMARY_SOURCE = { ai: 'AI summary', 'wrap-up': 'Posted wrap-up', manual: 'Edited by hand' };
export const summarySourceLabel = (summary) => SUMMARY_SOURCE[normaliseSummary(summary)?.source] || 'Summary';

/** 'upcoming' | 'live' | 'ended' | 'cancelled' */
export function meetingPhase(m) {
    if (!m) return 'upcoming';
    if (m.status === 'live') return 'live';
    if (m.status === 'completed') return 'ended';
    if (m.status === 'cancelled') return 'cancelled';
    return 'upcoming';
}

export const PHASE_LABEL = { upcoming: 'Upcoming', live: 'Live', ended: 'Ended', cancelled: 'Cancelled' };
export const PHASE_TONE = { upcoming: 'accent', live: 'success', ended: undefined, cancelled: 'danger' };

/** When it is/was: start, end and length (seconds) — from what happened when it happened. */
export function meetingTimes(m, now = Date.now()) {
    if (!m) return { start: null, end: null, durationSec: null, plannedMin: null };
    const startedAt = m.startedAt ? new Date(m.startedAt) : null;
    const scheduledStart = m.scheduledStart ? new Date(m.scheduledStart) : (m.kind !== 'huddle' && m.startTime ? new Date(m.startTime) : null);
    const start = startedAt || scheduledStart || (m.startTime ? new Date(m.startTime) : null);
    const end = m.endedAt ? new Date(m.endedAt) : (m.scheduledEnd && !startedAt ? new Date(m.scheduledEnd) : null);
    let durationSec = Number.isFinite(m.durationSec) ? m.durationSec : null;
    if (durationSec == null && m.status === 'live' && startedAt) durationSec = Math.max(0, Math.round((now - startedAt.getTime()) / 1000));
    const plannedMin = m.kind === 'huddle' ? null : (Number(m.duration) || null);
    return { start, end, durationSec, plannedMin, scheduledStart };
}

/** Where the meeting belongs: { kind: 'channel'|'dm'|'workspace', id, name }. */
export function meetingConversation(m) {
    if (!m) return { kind: 'workspace', id: null, name: null };
    const c = m.conversation;
    if (c && (c.kind === 'channel' || c.kind === 'dm') && c.id) return { kind: c.kind, id: String(c.id), name: c.name || null };
    const channelId = idOf(m.channelId);
    if (channelId) return { kind: 'channel', id: channelId, name: m.channelName || (typeof m.channelId === 'object' ? m.channelId.name : null) || null };
    const dmId = idOf(m.dmSessionId);
    if (dmId) return { kind: 'dm', id: dmId, name: null };
    return { kind: 'workspace', id: c?.id ? String(c.id) : null, name: null };
}

export function conversationLabel(conv) {
    if (!conv || conv.kind === 'workspace') return 'Workspace';
    if (conv.kind === 'channel') return conv.name ? `# ${String(conv.name).replace(/^#\s*/, '')}` : '# channel';
    return conv.name ? `Direct message with ${conv.name}` : 'Direct message';
}

export function conversationPath(workspaceId, conv) {
    if (!workspaceId || !conv || !conv.id || conv.kind === 'workspace') return null;
    return `/workspace/${workspaceId}/${conv.kind === 'dm' ? 'dm' : 'channel'}/${conv.id}`;
}

export function meetingPath(workspaceId, meetingId, tab) {
    if (!workspaceId || !meetingId) return null;
    return `/workspace/${workspaceId}/meetings/${meetingId}${tab && tab !== 'overview' ? `?tab=${tab}` : ''}`;
}

export const meetingTitle = (m) => (m?.title && String(m.title).trim()) || (m?.kind === 'huddle' ? 'Huddle' : 'Meeting');

export function personName(p) {
    if (!p || typeof p !== 'object') return 'Someone';
    if (p.firstName) return `${p.firstName} ${p.lastName || ''}`.trim();
    return p.username || p.name || 'Someone';
}

/** Everyone involved, as cards { id, name } (organiser first, no duplicates). */
export function meetingPeople(m) {
    if (!m) return [];
    const seen = new Map();
    const add = (p, fallbackName) => {
        const id = idOf(p);
        if (!id || seen.has(id)) return;
        seen.set(id, { id, name: typeof p === 'object' ? personName(p) : (fallbackName || 'Someone') });
    };
    if (m.createdBy && typeof m.createdBy === 'object') add(m.createdBy);
    (m.participants || []).forEach((p) => { if (p && typeof p === 'object') add(p); });
    (m.attendees || []).forEach((a) => add({ _id: a.userId, username: a.username }));
    return Array.from(seen.values());
}

/** One action item in one shape (server gives id/_id, assigneeId/assignedTo, done/status). */
export function normaliseActionItem(a) {
    if (!a || typeof a !== 'object') return null;
    const status = a.status || (a.done ? 'done' : 'pending');
    return {
        id: idOf(a.id || a._id) || a.clientId || null,
        text: String(a.text || ''),
        assigneeId: idOf(a.assigneeId !== undefined ? a.assigneeId : a.assignedTo),
        assigneeName: a.assignedTo && typeof a.assignedTo === 'object' ? personName(a.assignedTo) : null,
        dueDate: a.dueDate || null,
        done: typeof a.done === 'boolean' ? a.done : status === 'done',
        status,
        taskId: a.taskId ? idOf(a.taskId) : null,
        source: a.source || 'manual',
    };
}

export const normaliseActionItems = (items) => (Array.isArray(items) ? items.map(normaliseActionItem).filter((a) => a && a.id) : []);

/** 403 → 'forbidden', 404 → 'not_found', otherwise 'error'. */
export function meetingErrorKind(err) {
    const status = err?.response?.status ?? err?.status;
    if (status === 403) return 'forbidden';
    if (status === 404 || status === 400) return 'not_found';
    return 'error';
}

export const errorText = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/** Merge a socket/REST patch into a meeting held in state (ignores other meetings). */
export function patchMeeting(prev, meetingId, patch) {
    if (!prev || String(meetingIdOf(prev)) !== String(meetingId)) return prev;
    return { ...prev, ...patch };
}

/** "Huddles" list URL tab names (old ones kept working). */
export function huddlesTab(raw) {
    if (raw === 'upcoming' || raw === 'scheduled') return 'upcoming';
    if (raw === 'past' || raw === 'history') return 'past';
    return 'live';
}

/** Short "when" line for list rows. */
export function meetingWhenLabel(m, locale) {
    const { start, durationSec, plannedMin } = meetingTimes(m);
    if (!start) return '';
    const when = start.toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (m.status === 'completed' && Number.isFinite(durationSec)) return `${when} · ${Math.max(1, Math.round(durationSec / 60))} min`;
    if (plannedMin) return `${when} · ${plannedMin} min`;
    return when;
}
