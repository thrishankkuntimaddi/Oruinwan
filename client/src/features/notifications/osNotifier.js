/**
 * OS-level alerts (browser Notification API or the desktop app bridge) and
 * the in-app chime. One notification per `tag` (conversation): a newer one
 * replaces it silently (`renotify: false`); all are closed when the user
 * comes back to the app.
 */

const open = new Map(); // tag -> Notification

export function osNotificationsAvailable() {
    if (typeof window === 'undefined') return false;
    if (window.chttrixDesktop?.notify) return true;
    return typeof window.Notification !== 'undefined' && window.Notification.permission === 'granted';
}

/**
 * Show (or replace) the OS notification for `tag`.
 * route: { type, workspaceId, channelId, dmSessionId } for the desktop app.
 */
export function showOsNotification({ title, body, tag, silent = false, onClick, route = {} }) {
    if (typeof window === 'undefined') return false;
    try {
        if (window.chttrixDesktop?.notify) {
            // The desktop app formats 'message'/'mention' from senderName/preview/channelName.
            window.chttrixDesktop.notify({
                type: route.type || 'system',
                title,
                body,
                senderName: route.senderName || title,
                preview: body,
                channelName: route.channelName,
                silent,
                workspaceId: route.workspaceId,
                channelId: route.channelId,
                dmSessionId: route.dmSessionId,
            });
            return true;
        }
        if (typeof window.Notification === 'undefined' || window.Notification.permission !== 'granted') return false;
        const n = new window.Notification(title, {
            body,
            icon: '/icons/oruinwan-192.png',
            tag: tag || undefined,
            renotify: false,
            silent,
        });
        if (tag) open.set(tag, n);
        n.onclick = () => {
            try { window.focus(); } catch { /* ignore */ }
            try { onClick?.(); } catch { /* ignore */ }
            n.close();
        };
        n.onclose = () => { if (tag && open.get(tag) === n) open.delete(tag); };
        return true;
    } catch {
        // Some mobile browsers only allow notifications from a service worker.
        return false;
    }
}

/** Close every OS notification this tab opened (the user is back). */
export function closeOsNotifications() {
    for (const n of open.values()) {
        try { n.close(); } catch { /* ignore */ }
    }
    open.clear();
}

let audioCtx = null;
let lastChime = 0;

/** A short, quiet two-note chime for in-app message toasts (throttled). */
export function playChime() {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    if (now - lastChime < 1500) return;
    lastChime = now;
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = audioCtx || new Ctx();
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
        const t = audioCtx.currentTime;
        [[880, 0], [1320, 0.09]].forEach(([freq, offset]) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, t + offset);
            gain.gain.exponentialRampToValueAtTime(0.05, t + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.18);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(t + offset);
            osc.stop(t + offset + 0.2);
        });
    } catch {
        // Autoplay policy or no audio device: stay silent.
    }
}
