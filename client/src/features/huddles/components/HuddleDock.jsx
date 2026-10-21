import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Phone, Video } from 'lucide-react';
import { playChime } from '../../notifications/osNotifier';
import { useHuddleContext } from '../HuddleContext';
import HuddleWorkspacePanel from '../workspace/HuddleWorkspacePanel';
import CallScreen, { CallConnecting } from '../call/CallScreen';
import MiniCall, { MiniCallBody } from '../call/MiniCall';
import { ConflictDialog, ElsewherePill } from '../call/CallDialogs';
import { openFloatingWindow } from '../call/floatingWindow';
import '../workspace/huddleWorkspace.css';
import '../call/callScreen.css';

/**
 * The floating call window (desktop app window or browser Picture-in-Picture). `auto` marks a
 * window the desktop app opened by itself when you switched away, which closes again when you
 * come back.
 */
function useFloatingCall(active) {
    const [floating, setFloating] = useState(null); // { win, auto }
    const ref = useRef(null);
    ref.current = floating;

    const close = useCallback(() => {
        const f = ref.current;
        ref.current = null;
        setFloating(null);
        try { f?.win?.close(); } catch { /* already closed */ }
    }, []);

    const open = useCallback(async ({ auto = false } = {}) => {
        if (ref.current) return true;
        const win = await openFloatingWindow();
        if (!win) return false;
        const gone = () => { if (ref.current?.win === win) { ref.current = null; setFloating(null); } };
        win.addEventListener('pagehide', gone);
        win.addEventListener('unload', gone);
        ref.current = { win, auto };
        setFloating({ win, auto });
        return true;
    }, []);

    // A call that ends closes its window.
    useEffect(() => { if (!active) close(); }, [active, close]);

    // The desktop app calls this when its window is minimised or loses focus, and again when
    // it comes back (desktop/electron/main.js).
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        window.__oruinwanCallAway = (away) => {
            if (away && active) open({ auto: true });
            else if (!away && ref.current?.auto) close();
        };
        return () => { delete window.__oruinwanCallAway; };
    }, [active, open, close]);

    return { floating, open, close };
}

/**
 * App-wide call chrome: the full call screen or the small floating one, the call in its own
 * window, "switch / move here?" questions, "in a call on another device", the ring for an
 * incoming DM call, and the meeting panel.
 */
export default function HuddleDock() {
    const ctx = useHuddleContext();
    const navigate = useNavigate();
    const location = useLocation();
    const { floating, open: popOut, close: closeFloating } = useFloatingCall(ctx.active);

    // A DM call ringing for me (the DM page itself shows its own "Join" bar).
    const ring = ctx.incomingCall;
    const ringHere = ring && location.pathname.includes(`/dm/${ring.dmId}`);
    useEffect(() => {
        if (!ring || ringHere) return undefined;
        playChime();
        const t = setInterval(playChime, 3000);
        return () => clearInterval(t);
    }, [ring, ringHere]);
    const answer = () => {
        const r = ctx.incomingCall;
        if (!r) return;
        ctx.dismissIncomingCall();
        navigate(`/workspace/${r.workspaceId || ctx.workspaceId}/dm/${r.dmId}`);
        ctx.joinHuddle({ id: r.huddleId, dmId: r.dmId, video: r.video }, { quiet: true }).catch(() => {});
    };

    const expandFromFloating = () => {
        closeFloating();
        ctx.expandCall();
        try { window.focus(); } catch { /* the app brings itself forward */ }
    };

    const full = ctx.active && ctx.callView === 'full';
    const mini = ctx.active && ctx.callView === 'mini' && !floating;

    return (
        <>
            {!ctx.active && ctx.connecting && <CallConnecting label={ctx.connecting.label} onCancel={ctx.leaveHuddle} />}
            {full && <CallScreen ctx={ctx} onPopOut={() => popOut()} />}
            {mini && <MiniCall ctx={ctx} onPopOut={() => popOut()} />}
            {floating && ctx.active && createPortal(
                <MiniCallBody ctx={ctx} floating onExpand={expandFromFloating} />,
                floating.win.document.body,
            )}
            {!ctx.active && <ElsewherePill call={ctx.callElsewhere} onMove={() => ctx.moveCallHere().catch(() => {})} />}
            <ConflictDialog conflict={ctx.conflict} onAnswer={ctx.resolveConflict} />
            {ring && !ringHere && (
                <div className="hw-ring" data-testid="huddle-ring" role="alertdialog" aria-label="Incoming call">
                    <span className="hw-ring-icon">{ring.video ? <Video size={16} /> : <Phone size={16} />}</span>
                    <div className="hw-ring-text">
                        <p className="hw-ring-title">{ring.startedBy?.username || 'Someone'} is calling</p>
                        <p className="hw-ring-sub">{ring.video ? 'Video call' : 'Voice call'} · direct message</p>
                    </div>
                    <div className="hw-ring-actions">
                        <button type="button" className="gl-btn" onClick={ctx.dismissIncomingCall}>Decline</button>
                        <button type="button" className="gl-btn gl-btn--primary" data-testid="huddle-ring-join" onClick={answer}>Join</button>
                    </div>
                </div>
            )}
            {ctx.workspaceOpen && ctx.panelCall && <HuddleWorkspacePanel />}
        </>
    );
}
