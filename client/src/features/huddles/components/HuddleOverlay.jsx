import React, { useState, useEffect, useContext } from 'react';
import { Mic, MicOff, PhoneOff, ChevronDown, ChevronUp, Radio, Video, VideoOff, PanelRight } from 'lucide-react';
import { HuddleContext } from '../HuddleContext';
import HuddleParticipants from './HuddleParticipants';
import VideoTile from './VideoTile';

function formatDuration(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

export default function HuddleOverlay({
    active = false,
    participants = [],
    muted = false,
    channelName = '',
    onToggleMute,
    onLeave,
    isVideo = false,
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
        if (!active) { setElapsed(0); return; }
        const t = setInterval(() => setElapsed(s => s + 1), 1000);
        return () => clearInterval(t);
    }, [active]);

    if (!active) return null;

    // The call outlives this overlay (page changes), so show time since the call really started.
    const startedAt = ctx?.session?.huddleId === callId && ctx?.session?.startedAt ? new Date(ctx.session.startedAt).getTime() : null;
    const shownSeconds = startedAt ? Math.max(elapsed, Math.floor((Date.now() - startedAt) / 1000)) : elapsed;

    const btn = {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 10px',
        fontSize: '12px', fontWeight: 600, borderRadius: '2px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
    };
    const neutral = { background: 'var(--bg-active)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' };
    const off = { background: 'transparent', color: 'var(--state-danger)', border: '1px solid var(--state-danger)' };

    return (
        <div
            data-testid="huddle-overlay"
            style={{
                position: 'fixed', bottom: '16px', left: '16px', zIndex: 50, display: 'flex', flexDirection: 'column',
                width: minimised ? 208 : isVideo ? 384 : 256, minWidth: 208, overflow: 'hidden',
                background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: '2px',
                boxShadow: 'var(--card-shadow)', fontFamily: 'Inter, system-ui, sans-serif', transition: 'width 200ms ease',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', borderLeft: '3px solid var(--state-success)' }}>
                <Radio size={13} style={{ color: 'var(--state-success)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {channelName ? `# ${channelName.replace(/^#\s*/, '')}` : 'Huddle'}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatDuration(shownSeconds)}</p>
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
                    {isVideo ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' }}>
                            {participants.map(p => (
                                <VideoTile
                                    key={p.userId}
                                    isLocal={!!p.isLocal}
                                    name={p.username}
                                    stream={p.isLocal ? localStream : remoteStreams[p.userId]}
                                    cameraOn={p.isLocal ? cameraOn : p.videoEnabled !== false}
                                />
                            ))}
                        </div>
                    ) : (
                        <HuddleParticipants participants={participants} />
                    )}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>
                <button onClick={onToggleMute} title={muted ? 'Unmute' : 'Mute'} style={{ ...btn, ...(muted ? off : neutral), flex: 1 }}>
                    {muted ? <MicOff size={13} /> : <Mic size={13} />}
                    <span>{muted ? 'Unmute' : 'Mute'}</span>
                </button>

                {isVideo && onToggleCamera && (
                    <button
                        onClick={onToggleCamera}
                        title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                        style={{ ...btn, ...(cameraOn ? neutral : off) }}
                    >
                        {cameraOn ? <Video size={13} /> : <VideoOff size={13} />}
                    </button>
                )}

                {ctx?.openWorkspace && (
                    <button
                        onClick={() => (ctx.workspaceOpen ? ctx.closeWorkspace() : ctx.openWorkspace())}
                        title="Huddle workspace: notes, tasks, chat, wrap-up"
                        aria-label="Huddle workspace"
                        aria-pressed={!!ctx.workspaceOpen}
                        data-testid="huddle-open-workspace"
                        style={{ ...btn, ...(ctx.workspaceOpen ? { background: 'var(--accent)', color: '#0c0c0c', border: '1px solid var(--accent)' } : neutral) }}
                    >
                        <PanelRight size={13} />
                    </button>
                )}

                <button
                    onClick={onLeave}
                    title="Leave huddle"
                    style={{ ...btn, background: 'var(--state-danger)', color: '#fff', border: '1px solid var(--state-danger)' }}
                >
                    <PhoneOff size={13} />
                    <span>Leave</span>
                </button>
            </div>
        </div>
    );
}
