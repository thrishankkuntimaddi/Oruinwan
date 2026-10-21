import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, PhoneOff, PanelRight, Phone, Video } from 'lucide-react';
import { playChime } from '../../notifications/osNotifier';
import { useHuddleContext, callTitle } from '../HuddleContext';
import HuddleWorkspacePanel from '../workspace/HuddleWorkspacePanel';
import { formatDuration } from '../workspace/wrapUp';
import '../workspace/huddleWorkspace.css';

/** Where "return to the call" goes. */
function callPath(call, workspaceId) {
    const ws = call?.workspaceId || workspaceId;
    if (!ws) return null;
    if (call?.channelId) return `/workspace/${ws}/channel/${call.channelId}`;
    if (call?.dmId) return `/workspace/${ws}/dm/${call.dmId}`;
    return `/workspace/${ws}/huddles`;
}

/**
 * App-wide huddle chrome: a small "in huddle" pill whenever you are in a call
 * that no page is showing (so you can go back or leave), and the huddle
 * workspace panel when it is open.
 */
export default function HuddleDock() {
    const ctx = useHuddleContext();
    const navigate = useNavigate();
    const location = useLocation();
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!ctx.active) return undefined;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [ctx.active]);

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

    const call = ctx.selectedHuddle || ctx.panelCall;
    const shownByPage = ctx.huddleId && ctx.inlineUIs[ctx.huddleId] > 0;
    const showPill = ctx.active && !shownByPage;
    const started = ctx.session?.startedAt || call?.startTime;
    const path = callPath(call || ctx.callScope, ctx.workspaceId);

    return (
        <>
            {showPill && (
                <div className="hw-pill" data-testid="huddle-pill" role="region" aria-label="You are in a huddle">
                    <button type="button" className="hw-pill-main" title="Back to the huddle"
                        onClick={() => { if (path && location.pathname !== path) navigate(path); }}>
                        <span className="hw-live-dot" />
                        <span className="hw-pill-title">{callTitle({ ...(call || {}), channelName: call?.channelName || ctx.session?.channelName })}</span>
                        {started && <span className="hw-pill-time">{formatDuration(Math.round((now - new Date(started).getTime()) / 1000))}</span>}
                    </button>
                    <button type="button" className="gl-icon-btn" onClick={ctx.toggleMute} aria-pressed={ctx.muted}
                        title={ctx.muted ? 'Unmute' : 'Mute'} aria-label={ctx.muted ? 'Unmute' : 'Mute'}
                        style={ctx.muted ? { color: 'var(--state-danger)' } : undefined}>
                        {ctx.muted ? <MicOff size={13} /> : <Mic size={13} />}
                    </button>
                    <button type="button" className="gl-icon-btn" aria-pressed={ctx.workspaceOpen}
                        onClick={() => (ctx.workspaceOpen ? ctx.closeWorkspace() : ctx.openWorkspace())}
                        title={ctx.workspaceOpen ? 'Hide the meeting panel' : 'Meeting panel: notes, agenda, transcript and recap'} aria-label="Meeting panel">
                        <PanelRight size={13} />
                    </button>
                    <button type="button" className="gl-icon-btn hw-pill-leave" onClick={ctx.leaveHuddle} title="Leave huddle" aria-label="Leave huddle">
                        <PhoneOff size={13} />
                    </button>
                </div>
            )}
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
