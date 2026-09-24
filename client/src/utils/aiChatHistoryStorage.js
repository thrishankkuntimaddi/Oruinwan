// Per-user storage for ChttrixAI chat history (cleared on logout).
export const AI_HISTORY_KEY_PREFIX = 'chttrixai_chat_history';
const LEGACY_GLOBAL_KEY = AI_HISTORY_KEY_PREFIX;

export const aiHistoryKey = (userId) => (userId ? `${AI_HISTORY_KEY_PREFIX}:${userId}` : null);

export function readAiHistory(key) {
    if (!key) return [];
    try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeAiHistory(key, items) {
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* quota / private mode */ }
}

/** Remove every stored AI history (all users + legacy global key). */
export function clearAllAiHistory() {
    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const k = localStorage.key(i);
            if (k === LEGACY_GLOBAL_KEY || (k && k.startsWith(`${AI_HISTORY_KEY_PREFIX}:`))) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
}
