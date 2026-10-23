import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { closeOsNotification, playChime, showOsNotification } from '../../notifications/osNotifier';
import { useHuddleContext } from '../HuddleContext';
import HuddleWorkspacePanel from '../workspace/HuddleWorkspacePanel';
import CallScreen, { CallConnecting } from '../call/CallScreen';
import MiniCall, { MiniCallBody } from '../call/MiniCall';
import { ConflictDialog, ElsewherePill } from '../call/CallDialogs';
import { openFloatingWindow } from '../call/floatingWindow';
import { HuddleStartedBanner, IncomingCall, ringLabel } from '../call/IncomingCall';
import { startRingtone } from '../call/ringtone';
import { announceRing, announceRingEnd, desktopRings, onRingAction } from '../call/ringBridge';
import '../workspace/huddleWorkspace.css';
import '../call/callScreen.css';
import '../call/incomingCall.css';

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

/** The page is behind other windows or another tab: an OS notification is the only way to be seen. */
function pageAway() {
    if (typeof document === 'undefined') return false;
    try { return document.hidden || !document.hasFocus(); } catch { return document.hidden; }
}

/**
 * While a call rings for me: the ringtone, and an OS notification when the app is in the
 * background (clicking it brings the app forward to answer). Both stop when the ring stops.
 */
function useRinging(ring) {
    const id = ring?.huddleId || null;
    useEffect(() => {
        if (!id) return undefined;
        const stop = startRingtone();
        const tag = `oruinwan:call:${id}`;
        // The desktop app shows its own ring notification (with Accept / Decline).
        announceRing(ring);
        if (pageAway() && !desktopRings()) {
            showOsNotification({
                title: ring.kind === 'group_dm' && ring.title ? ring.title : (ring.from?.name || 'Incoming call'),
                body: `${ring.kind === 'group_dm' ? `${ring.from?.name || 'Someone'} · ` : ''}${ringLabel(ring)}`,
                tag,
                requireInteraction: true,
                route: { type: 'system', workspaceId: ring.workspaceId || undefined, dmSessionId: ring.dmId || undefined },
            });
        }
        return () => {
            stop();
            closeOsNotification(tag);
            announceRingEnd(id);
        };
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * App-wide call chrome: the full call screen or the small floating one, the call in its own
 * window, "switch / move here?" questions, "in a call on another device", the ring for an
 * incoming DM call, and the meeting panel.
 */
export default function HuddleDock() {
    const ctx = useHuddleContext();
    const navigate = useNavigate();
    const { floating, open: popOut, close: closeFloating } = useFloatingCall(ctx.active);

    // A DM / group-DM call ringing for me, and a channel huddle someone started.
    const ring = ctx.incomingCall;
    const banner = ctx.huddleBanner;
    useRinging(ring);
    const bannerId = banner?.huddleId || null;
    useEffect(() => { if (bannerId) playChime(); }, [bannerId]);

    const workspacePath = (r) => `/workspace/${r.workspaceId || ctx.workspaceId}`;
    const answer = useCallback(() => {
        const r = ctx.incomingCall;
        if (!r) return;
        ctx.dismissIncomingCall();
        try { window.focus(); } catch { /* the desktop app brings itself forward */ }
        if (r.dmId) navigate(`${workspacePath(r)}/dm/${r.dmId}`);
        ctx.joinHuddle({ id: r.huddleId, dmId: r.dmId || null, channelId: r.channelId || null, video: r.video }, { quiet: true }).catch(() => {});
    }, [ctx, navigate]); // eslint-disable-line react-hooks/exhaustive-deps
    // Accept / Decline / Open from the desktop app's ring notification.
    const ringRef = useRef(ring);
    ringRef.current = ring;
    useEffect(() => onRingAction(({ huddleId, action }) => {
        if (ringRef.current?.huddleId !== huddleId) return;
        if (action === 'accept') answer();
        else if (action === 'decline') ctx.declineIncomingCall();
        else try { window.focus(); } catch { /* the app brings itself forward */ }
    }), [answer, ctx.declineIncomingCall]); // eslint-disable-line react-hooks/exhaustive-deps

    const joinFromBanner = () => {
        const b = ctx.huddleBanner;
        if (!b) return;
        ctx.dismissHuddleBanner();
        if (b.channelId) navigate(`${workspacePath(b)}/channel/${b.channelId}`);
        ctx.joinHuddle({ id: b.huddleId, channelId: b.channelId || null, video: b.video }, { quiet: true }).catch(() => {});
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
            {!ctx.active && <IncomingCall ring={ring} onAccept={answer} onDecline={ctx.declineIncomingCall} />}
            {!ctx.active && !ring && <HuddleStartedBanner banner={banner} onJoin={joinFromBanner} onDismiss={ctx.dismissHuddleBanner} />}
            {ctx.workspaceOpen && ctx.panelCall && <HuddleWorkspacePanel />}
        </>
    );
}
