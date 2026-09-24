/**
 * Pure helpers shared by the chat message toolbar (channel + DM items).
 */

/** Readable text of a message. Messages are E2EE so `text` is usually empty. */
export function getMessageText(msg) {
    if (!msg) return '';
    return msg.decryptedContent || msg.text || msg.payload?.text || '';
}

const normId = (id) => String(id?._id || id || '');

/** Is `userId` in the message's bookmarkedBy list? */
export function isBookmarkedBy(bookmarkedBy, userId) {
    if (!Array.isArray(bookmarkedBy) || !userId) return false;
    return bookmarkedBy.some(id => normId(id) === normId(userId));
}

/**
 * Next bookmarkedBy array after toggling `userId` (optimistic update).
 * Returns `{ bookmarkedBy, bookmarked }`.
 */
export function toggleBookmarkedBy(bookmarkedBy, userId) {
    const list = Array.isArray(bookmarkedBy) ? bookmarkedBy : [];
    if (isBookmarkedBy(list, userId)) {
        return { bookmarked: false, bookmarkedBy: list.filter(id => normId(id) !== normId(userId)) };
    }
    return { bookmarked: true, bookmarkedBy: [...list, userId] };
}

/** Has the message ever been edited (so a history exists)? */
export function hasEditHistory(msg) {
    if (!msg) return false;
    return (Array.isArray(msg.editHistory) && msg.editHistory.length > 0)
        || (Number(msg.version) > 1)
        || !!msg.editedAt;
}

/** Title for a task created from a message: first non-empty line, max 120 chars. */
export function taskTitleFromText(text) {
    const first = String(text || '').split('\n').map(s => s.trim()).find(Boolean) || '';
    return first.length > 120 ? `${first.slice(0, 117)}...` : first;
}

/** Reminder presets resolved against `now` (Date). */
export function resolveReminderPreset(key, now = new Date()) {
    const d = new Date(now.getTime());
    switch (key) {
        case '20m': return new Date(d.getTime() + 20 * 60 * 1000);
        case '1h': return new Date(d.getTime() + 60 * 60 * 1000);
        case '3h': return new Date(d.getTime() + 3 * 60 * 60 * 1000);
        case 'tomorrow': {
            d.setDate(d.getDate() + 1);
            d.setHours(9, 0, 0, 0);
            return d;
        }
        case 'nextweek': {
            // Next Monday (always in the future; a Monday goes to the following one).
            const day = d.getDay(); // 0 = Sun
            const delta = ((8 - day) % 7) || 7;
            d.setDate(d.getDate() + delta);
            d.setHours(9, 0, 0, 0);
            return d;
        }
        default: return null;
    }
}

/** Human readable reminder time, e.g. "Tomorrow at 9:00 AM". */
export function formatReminderTime(date, now = new Date()) {
    const d = new Date(date);
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((startOf(d) - startOf(now)) / 86400000);
    if (days === 0) return `today at ${time}`;
    if (days === 1) return `tomorrow at ${time}`;
    return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`;
}
