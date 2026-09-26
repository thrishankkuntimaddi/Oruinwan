// Presence values arrive in several spellings: the presence service sends
// online/idle/offline, the connect handler and member API send active, and
// users can pick away/dnd/busy. Normalise them in one place.

const ONLINE = new Set(['online', 'active']);
const AWAY = new Set(['idle', 'away']);
const BUSY = new Set(['dnd', 'busy']);

/** One of 'online' | 'away' | 'busy' | 'offline' (the states Avatar can show). */
export function presenceState({ isOnline, status } = {}) {
    const s = String(status || '').toLowerCase();
    if (BUSY.has(s)) return 'busy';
    if (AWAY.has(s)) return 'away';
    if (ONLINE.has(s)) return 'online';
    return isOnline ? 'online' : 'offline';
}

const LABELS = { online: 'Active now', away: 'Away', busy: 'Do not disturb', offline: 'Offline' };

export function presenceLabel(presence) {
    return LABELS[presenceState(presence)];
}
