import React, { useState, useEffect, useContext } from 'react';
import { Mic, MicOff, PhoneOff, ChevronDown, ChevronUp, Radio, Video, VideoOff, PanelRight, Monitor, MonitorOff, Hand } from 'lucide-react';
import { HuddleContext } from '../HuddleContext';
import HuddleParticipants from './HuddleParticipants';
import VideoTile from './VideoTile';

function formatDuration(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

const canShareScreen = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

/** The call controls of the huddle in the open channel or DM. */
export default function HuddleOverlay({
    active = false,
    participants = [],
    muted = false,
    channelName = '',
    isDM = false,
    onToggleMute,
    onLeave,
    cameraOn = false,
    onToggleCamera,
    localStream = null,
    remoteStreams = {},
}) {
    const [minimised, setMinimised] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    // The app-wide call (when there is one): this overlay shows it, so the floating pill hides.
    const ctx = useContext(HuddleContext);
    const callId = active ? ctx?.huddleId : null;
    const registerInlineUI = ctx?.registerInlineUI;
    useEffect(() => (callId && registerInlineUI ? registerInlineUI(callId) : undefined), [callId, registerInlineUI]);

    useEffect(() => {
        if (!active) { setElapsed(0); return undefined; }
        const t = setInterval(() => setElapsed(s => s + 1), 1000);
        return () => clearInterval(t);
    }, [active]);

    if (!active) return null;

    // The call outlives this overlay (page changes), so show time since the call really started.
    const startedAt = ctx?.session?.huddleId === callId && ctx?.session?.startedAt ? new Date(ctx.session.startedAt).getTime() : null;
    const shownSeconds = startedAt ? Math.max(elapsed, Math.floor((Date.now() - startedAt) / 1000)) : elapsed;

    const screenStream = ctx?.screenStream || null;
    const sharing = !!screenStream;
    // Show tiles as soon as anyone has a camera or a screen on (voice huddles can add video).
    const anyVideo = sharing || cameraOn || participants.some(p => !p.isLocal && p.videoEnabled);
    const title = isDM ? (channelName ? `Call with ${channelName}` : 'Direct message call') : (channelName ? `# ${channelName.replace(/^#\s*/, '')}` : 'Huddle');
    const raisedCount = participants.filter(p => p.handRaised).length;

    const toggleScreen = async () => {
        if (!ctx) return;
        if (sharing) { ctx.stopScreenShare(); return; }
        try { await ctx.startScreenShare(); } catch { /* the user closed the picker */ }
    };

    const btn = {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 10px',
        fontSize: '12px', fontWeight: 600, borderRadius: '2px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
    };
    const neutral = { background: 'var(--bg-active)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' };
    const on = { background: 'var(--accent)', color: 'var(--bg-base)', border: '1px solid var(--accent)' };
    const off = { background: 'transparent', color: 'var(--state-danger)', border: '1px solid var(--state-danger)' };

    return (
        <div
            data-testid="huddle-overlay"
            style={{
                position: 'fixed', bottom: '16px', left: '16px', zIndex: 50, display: 'flex', flexDirection: 'column',
                width: minimised ? 208 : anyVideo ? 384 : 300, minWidth: 208, maxWidth: 'calc(100vw - 32px)', overflow: 'hidden',
                background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: '2px',
                boxShadow: 'var(--card-shadow)', fontFamily: 'Inter, system-ui, sans-serif', transition: 'width 200ms ease',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', borderLeft: '3px solid var(--state-success)' }}>
                <Radio size={13} style={{ color: 'var(--state-success)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {title}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatDuration(shownSeconds)}
                        {sharing ? ' · sharing your screen' : ''}
                        {raisedCount > 0 ? ` · ${raisedCount} ${raisedCount === 1 ? 'hand' : 'hands'} up` : ''}
                    </p>
                </div>
                <button
                    onClick={() => setMinimised(m => !m)}
                    style={{ display: 'flex', padding: '4px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    title={minimised ? 'Expand' : 'Minimise'}
                >
                    {minimised ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
            </div>

            {!minimised && (
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
                    </p>
                    {anyVideo ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' }}>
                            {participants.map(p => (
                                <VideoTile
                                    key={p.userId}
                                    isLocal={!!p.isLocal}
                                    name={p.username}
                                    handRaised={!!p.handRaised}
                                    stream={p.isLocal ? (screenStream || localStream) : remoteStreams[p.userId]}
                                    cameraOn={p.isLocal ? (sharing || cameraOn) : !!p.videoEnabled}
                                    mirror={p.isLocal && !sharing}
                                />
                            ))}
                        </div>
                    ) : (
                        <HuddleParticipants participants={participants} />
                    )}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', flexWrap: 'wrap' }}>
                <button onClick={onToggleMute} title={muted ? 'Unmute' : 'Mute'} data-testid="huddle-mute" style={{ ...btn, ...(muted ? off : neutral), flex: 1 }}>
                    {muted ? <MicOff size={13} /> : <Mic size={13} />}
                    <span>{muted ? 'Unmute' : 'Mute'}</span>
                </button>

                {onToggleCamera && (
                    <button
                        onClick={onToggleCamera}
                        disabled={sharing}
                        data-testid="huddle-camera"
                        title={sharing ? 'Stop sharing to change the camera' : cameraOn ? 'Turn camera off' : 'Turn camera on'}
                        aria-pressed={cameraOn}
                        style={{ ...btn, ...(cameraOn ? on : neutral), opacity: sharing ? 0.5 : 1, cursor: sharing ? 'not-allowed' : 'pointer' }}
                    >
                        {cameraOn ? <Video size={13} /> : <VideoOff size={13} />}
                    </button>
                )}

                {ctx?.startScreenShare && canShareScreen() && (
                    <button
                        onClick={toggleScreen}
                        data-testid="huddle-screen"
                        title={sharing ? 'Stop sharing screen' : 'Share screen'}
                        aria-pressed={sharing}
                        style={{ ...btn, ...(sharing ? on : neutral) }}
                    >
                        {sharing ? <MonitorOff size={13} /> : <Monitor size={13} />}
                    </button>
                )}

                {ctx?.toggleHand && (
                    <button
                        onClick={ctx.toggleHand}
                        data-testid="huddle-hand"
                        title={ctx.handRaised ? 'Lower hand' : 'Raise hand'}
                        aria-pressed={!!ctx.handRaised}
                        style={{ ...btn, ...(ctx.handRaised ? on : neutral) }}
                    >
                        <Hand size={13} />
                    </button>
                )}

                {ctx?.openWorkspace && (
                    <button
                        onClick={() => (ctx.workspaceOpen ? ctx.closeWorkspace() : ctx.openWorkspace())}
                        title="Huddle workspace: notes, tasks, chat, wrap-up"
                        aria-label="Huddle workspace"
                        aria-pressed={!!ctx.workspaceOpen}
                        data-testid="huddle-open-workspace"
                        style={{ ...btn, ...(ctx.workspaceOpen ? on : neutral) }}
                    >
                        <PanelRight size={13} />
                    </button>
                )}

                <button
                    onClick={onLeave}
                    title="Leave huddle"
                    data-testid="huddle-leave"
                    style={{ ...btn, background: 'var(--state-danger)', color: '#fff', border: '1px solid var(--state-danger)' }}
                >
                    <PhoneOff size={13} />
                    <span>Leave</span>
                </button>
            </div>
        </div>
    );
}
