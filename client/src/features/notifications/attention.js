/**
 * Where is the user looking? Small browser-side helpers the notification
 * policy feeds on:
 *   - tab visibility + focus,
 *   - the thread panel that is open (ThreadPanel registers itself),
 *   - other tabs of the app (BroadcastChannel) and which tab is the one that
 *     shows OS notifications (Web Locks leader; every tab if unsupported).
 */

// ── Open thread ────────────────────────────────────────────────────────────
let openThreadId = null;

export function setOpenThread(parentId) {
    openThreadId = parentId ? String(parentId) : null;
}

/** Clear only if `parentId` is still the open one (panels can swap quickly). */
export function clearOpenThread(parentId) {
    if (!parentId || openThreadId === String(parentId)) openThreadId = null;
}

export function getOpenThread() {
    return openThreadId;
}

// ── This tab ───────────────────────────────────────────────────────────────
export function tabIsVisible() {
    return typeof document === 'undefined' || document.visibilityState === 'visible';
}

export function tabHasFocus() {
    try {
        return typeof document === 'undefined' || document.hasFocus();
    } catch {
        return true;
    }
}

export function tabIsActive() {
    return tabIsVisible() && tabHasFocus();
}

/** Run `cb` whenever visibility or focus changes. Returns an unsubscribe. */
export function onAttentionChange(cb) {
    if (typeof window === 'undefined') return () => {};
    const handler = () => cb(tabIsActive());
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('focus', handler);
    window.addEventListener('blur', handler);
    return () => {
        document.removeEventListener('visibilitychange', handler);
        window.removeEventListener('focus', handler);
        window.removeEventListener('blur', handler);
    };
}

// ── Other tabs ─────────────────────────────────────────────────────────────
const CHANNEL_NAME = 'oruinwan-notify';
const LOCK_NAME = 'oruinwan-notify-leader';
const HEARTBEAT_MS = 4000;
const ACTIVE_STALE_MS = 12000;

const tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const peers = new Map(); // tabId -> { active, ts }
let channel = null;
let leader = false;
let started = false;

function broadcast() {
    if (!channel) return;
    try { channel.postMessage({ tabId, active: tabIsActive(), ts: Date.now() }); } catch { /* closed */ }
}

/** Start cross-tab coordination once per page (idempotent). */
export function startTabCoordination() {
    if (started || typeof window === 'undefined') return;
    started = true;

    if (typeof BroadcastChannel !== 'undefined') {
        try {
            channel = new BroadcastChannel(CHANNEL_NAME);
            channel.onmessage = (e) => {
                const d = e?.data;
                if (!d || d.tabId === tabId) return;
                if (d.bye) peers.delete(d.tabId);
                else peers.set(d.tabId, { active: !!d.active, ts: Date.now() });
                if (d.hello) broadcast();
            };
            channel.postMessage({ tabId, active: tabIsActive(), ts: Date.now(), hello: true });
        } catch {
            channel = null;
        }
    }

    // The tab holding the lock shows OS notifications; the lock is released
    // automatically when the tab closes or crashes, and the next tab takes over.
    const locks = typeof navigator !== 'undefined' ? navigator.locks : null;
    if (locks?.request) {
        locks.request(LOCK_NAME, () => {
            leader = true;
            return new Promise(() => {}); // hold for the life of the page
        }).catch(() => { leader = true; });
    } else {
        leader = true;
    }

    onAttentionChange(broadcast);
    // Active tabs re-announce themselves so a crashed active tab goes stale.
    setInterval(() => { if (tabIsActive()) broadcast(); }, HEARTBEAT_MS);
    window.addEventListener('pagehide', () => {
        try { channel?.postMessage({ tabId, bye: true }); } catch { /* closed */ }
    });
}

export function isLeaderTab() {
    return leader;
}

/** Is another tab of the app visible and focused right now? */
export function anotherTabIsActive() {
    const now = Date.now();
    for (const p of peers.values()) {
        if (p.active && now - p.ts < ACTIVE_STALE_MS) return true;
    }
    return false;
}
