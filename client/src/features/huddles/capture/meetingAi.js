import { isMarker } from './captions';

/**
 * The in-call AI assistant answers from the transcript. /api/ai/conversation
 * takes up to 200 { sender, text } messages of at most 4000 characters each, so
 * consecutive lines of one speaker are merged and only the latest part of a
 * long meeting is sent.
 */
export const AI_MAX_MESSAGES = 200;
export const AI_MAX_TEXT = 4000;

export function buildAiMessages(segments = [], { myId, maxMessages = AI_MAX_MESSAGES, maxText = AI_MAX_TEXT } = {}) {
    const merged = [];
    for (const s of segments) {
        if (!s?.text || isMarker(s)) continue;
        const sender = s.speakerName || 'Speaker';
        const last = merged[merged.length - 1];
        if (last && last.sender === sender && last.text.length + s.text.length + 1 <= maxText) {
            last.text = `${last.text} ${s.text}`;
        } else {
            merged.push({ sender, text: String(s.text).slice(0, maxText), isMe: !!myId && String(s.speakerId) === String(myId) });
        }
    }
    return merged.slice(-maxMessages);
}

/** Quick questions offered in the assistant panel; `mode` is the /api/ai/conversation mode. */
export const QUICK_ASKS = [
    { id: 'summary', label: 'Summarise so far', mode: 'summary' },
    { id: 'decisions', label: 'Decisions made', mode: 'decisions' },
    { id: 'actions', label: 'Action items so far', mode: 'action_items' },
];

/** Body for aiService.conversation(); null when there is nothing to answer from. */
export function assistantRequest({ workspaceId, segments, question, mode, title, myId }) {
    const messages = buildAiMessages(segments, { myId });
    if (!messages.length) return null;
    const q = String(question || '').trim();
    return {
        workspaceId: workspaceId || undefined,
        messages,
        mode: mode || (q ? 'question' : 'summary'),
        question: q || undefined,
        title: title ? `Meeting: ${title}`.slice(0, 100) : 'Meeting transcript',
    };
}

/** Normalised action items from the summarize / extract endpoints. */
export function normaliseActionItems(list = [], names = {}) {
    return (Array.isArray(list) ? list : [])
        .map((a) => (typeof a === 'string' ? { text: a } : a))
        .filter((a) => a && String(a.text || '').trim())
        .map((a) => ({ text: String(a.text).trim(), assignee: a.assigneeId ? (names[String(a.assigneeId)] || null) : null, assigneeId: a.assigneeId || null }));
}
