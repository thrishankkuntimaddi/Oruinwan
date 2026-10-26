// Which messages just arrived, so the web and phone apps animate those (a short fade and rise)
// and never the history shown when a conversation opens or older messages loaded by scrolling up.

const timeOf = (at) => {
    const t = at instanceof Date ? at.getTime() : Date.parse(at || '');
    return Number.isFinite(t) ? t : 0;
};

/**
 * A tracker for one conversation. update(items) takes the messages in order, each
 * { id, tempId?, at }, and returns the Set of ids that arrived after the first look.
 *   - The first non-empty list is history: nothing in it is new.
 *   - A message older than the newest one seen (an older page) is not new.
 *   - A saved message that replaces its optimistic copy (same tempId) is not new again.
 */
export function createArrivals() {
    let seen = null;
    let newest = 0;
    const arrived = new Set();
    return {
        update(items = []) {
            if (!seen) {
                if (!items.length) return arrived;
                seen = new Set();
                for (const it of items) {
                    seen.add(String(it.id));
                    if (it.tempId) seen.add(String(it.tempId));
                    newest = Math.max(newest, timeOf(it.at));
                }
                return arrived;
            }
            for (const it of items) {
                const id = String(it.id);
                if (seen.has(id)) continue;
                seen.add(id);
                const replaces = it.tempId && seen.has(String(it.tempId));
                if (it.tempId) seen.add(String(it.tempId));
                const t = timeOf(it.at);
                // A second of slack for clocks: a message sent "now" is never older history.
                if (!replaces && (t === 0 || t >= newest - 1000)) arrived.add(id);
                newest = Math.max(newest, t);
            }
            return arrived;
        },
    };
}

/** For a count that changes (an unread badge): true when it went up. */
export function rose(previous, next) {
    return Number(next || 0) > Number(previous || 0);
}
