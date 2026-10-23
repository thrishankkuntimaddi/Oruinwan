/**
 * The desktop app's side of an incoming call (client/src/desktop/bridge.js + the Electron preload
 * listen to these). In a browser nobody listens, so they are harmless there.
 *
 *  - `oruinwan:ring`      { huddleId, title, body, video }  a call started ringing here
 *  - `oruinwan:ring-end`  { huddleId }                      it stopped (answered, declined, ended, timed out)
 *  - `oruinwan:ring-action` (from the app) { huddleId, action: 'accept' | 'decline' | 'open' }
 */
import { ringLabel } from './IncomingCall';

const win = () => (typeof window !== 'undefined' ? window : null);

function dispatch(name, detail) {
    const w = win();
    if (!w || typeof w.dispatchEvent !== 'function' || typeof w.CustomEvent !== 'function') return;
    try { w.dispatchEvent(new w.CustomEvent(name, { detail })); } catch { /* no event support */ }
}

/** What the desktop app's ring notification shows. */
export function ringDetail(ring) {
    const group = ring?.kind === 'group_dm';
    return {
        huddleId: ring.huddleId,
        title: group && ring.title ? ring.title : (ring.from?.name || 'Incoming call'),
        body: `${group ? `${ring.from?.name || 'Someone'} · ` : ''}${ringLabel(ring)}`,
        video: !!ring.video,
    };
}

export function announceRing(ring) {
    if (ring?.huddleId) dispatch('oruinwan:ring', ringDetail(ring));
}

export function announceRingEnd(huddleId) {
    if (huddleId) dispatch('oruinwan:ring-end', { huddleId });
}

/** Run `handler({ huddleId, action })` for Accept / Decline / Open from the desktop app. Returns an unsubscribe. */
export function onRingAction(handler) {
    const w = win();
    if (!w || typeof w.addEventListener !== 'function') return () => {};
    const listener = (e) => {
        const d = e?.detail || {};
        if (!d.huddleId || !['accept', 'decline', 'open'].includes(d.action)) return;
        handler({ huddleId: String(d.huddleId), action: d.action });
    };
    w.addEventListener('oruinwan:ring-action', listener);
    return () => w.removeEventListener('oruinwan:ring-action', listener);
}

/** Inside the desktop app, which shows its own ring notification (with Accept / Decline). */
export function desktopRings() {
    const w = win();
    return !!(w && (w.oruinwanDesktop || w.electronAPI?.isDesktop));
}
