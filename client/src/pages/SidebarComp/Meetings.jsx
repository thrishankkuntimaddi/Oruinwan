import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, PhoneOff,
    Users, PanelRight, Hand, Radio, Calendar, X, AlertTriangle, RotateCcw,
} from 'lucide-react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useHuddleContext, meetingHuddleId, meetingConversationPath, callTitle } from '../../features/huddles/HuddleContext';
import { useToast } from '../../contexts/ToastContext';
import { useScheduledMeetings } from '../../hooks/useScheduledMeetings';
import ScheduleMeetingModal from '../../features/messaging/chatWindowComp/modals/ScheduleMeetingModal';
import api from '../../services/api';

const FONT = 'Inter, system-ui, sans-serif';

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const mm = h ? String(m).padStart(2, '0') : String(m);
    return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

function getInitials(name = '') {
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

const CONNECTION_LABELS = {
    new: 'Connecting…',
    connecting: 'Connecting…',
    disconnected: 'Reconnecting…',
    failed: 'Connection failed',
};

const primaryButton = (disabled) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '11px 20px',
    background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '2px', color: '#0c0c0c', fontWeight: 700, fontSize: '14px',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, fontFamily: FONT, whiteSpace: 'nowrap',
});
const secondaryButton = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '10px 20px',
    background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: '2px', color: 'var(--text-primary)',
    fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
};

const Spinner = ({ size = 14, color = 'currentColor' }) => (
    <span style={{ width: size, height: size, border: `2px solid ${color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block', flexShrink: 0 }} />
);

const CenteredPanel = ({ children }) => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px', background: 'var(--bg-base)', fontFamily: FONT }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '380px', width: '100%' }}>
            {children}
        </div>
    </div>
);

const IconBadge = ({ icon: Icon, tone = 'accent' }) => (
    <div style={{
        width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
        background: tone === 'danger' ? 'var(--bg-active)' : 'var(--accent-dim)',
        border: `1px solid ${tone === 'danger' ? 'var(--state-danger)' : 'var(--border-accent)'}`,
    }}>
        <Icon size={28} style={{ color: tone === 'danger' ? 'var(--state-danger)' : 'var(--accent)' }} />
    </div>
);

const LandingView = ({ onStart, onStartVideo, onSchedule, starting }) => (
    <CenteredPanel>
        <IconBadge icon={Radio} />
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
            Huddles
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '14px', lineHeight: 1.6 }}>
            Start a quick call with your workspace, or join one that is live now from the list on the left.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '260px' }}>
            <button onClick={onStart} disabled={starting} style={primaryButton(starting)}>
                {starting ? <><Spinner color="#0c0c0c" /> Starting…</> : <><Mic size={16} /> Start huddle</>}
            </button>
            <button onClick={onStartVideo} disabled={starting} style={{ ...secondaryButton, opacity: starting ? 0.6 : 1 }}>
                <Video size={15} /> Start video huddle
            </button>
            <button onClick={onSchedule} style={{ ...secondaryButton, border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <Calendar size={14} /> Schedule a meeting
            </button>
        </div>
    </CenteredPanel>
);

const ConnectingView = ({ label }) => (
    <CenteredPanel>
        <div style={{ marginBottom: '20px', color: 'var(--accent)' }}><Spinner size={40} color="var(--accent)" /></div>
        <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>{label || 'Connecting'}…</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            If your browser asks, allow access to your microphone.
        </p>
    </CenteredPanel>
);

const ErrorView = ({ message, onRetry, onBack }) => (
    <CenteredPanel>
        <IconBadge icon={AlertTriangle} tone="danger" />
        <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Couldn't connect</h3>
        <p data-testid="huddle-connect-error" style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>{message}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '220px' }}>
            <button onClick={onRetry} style={primaryButton(false)}><RotateCcw size={14} /> Try again</button>
            <button onClick={onBack} style={secondaryButton}>Back</button>
        </div>
    </CenteredPanel>
);

/** One participant: their video when it is on, otherwise their initials. */
const ParticipantTile = ({ participant, stream, showVideo, mirror, connection }) => {
    const ref = useRef(null);
    const hasVideo = showVideo && !!stream && stream.getVideoTracks().length > 0;
    const label = participant.isLocal ? 'You' : (participant.username || 'Guest');
    const isAudioOn = participant.audioEnabled !== false;
    const status = !participant.isLocal ? CONNECTION_LABELS[connection] : null;

    useEffect(() => {
        if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
    }, [stream, hasVideo]);

    return (
        <div data-testid={participant.isLocal ? 'room-tile-local' : 'room-tile-remote'}
            style={{ position: 'relative', aspectRatio: '16 / 9', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {hasVideo ? (
                // Audio plays through hidden <audio> elements, so the video is muted.
                <video ref={ref} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000', transform: mirror ? 'scaleX(-1)' : undefined }} />
            ) : (
                <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>{getInitials(participant.username || label)}</span>
                </div>
            )}
            <div style={{ position: 'absolute', left: '10px', bottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '2px', background: hasVideo ? 'rgba(0,0,0,0.6)' : 'var(--bg-base)', border: hasVideo ? 'none' : '1px solid var(--border-default)' }}>
                {isAudioOn
                    ? <Mic size={12} style={{ color: hasVideo ? '#fff' : 'var(--text-secondary)' }} />
                    : <MicOff size={12} style={{ color: 'var(--state-danger)' }} />}
                <span style={{ fontSize: '12px', fontWeight: 600, color: hasVideo ? '#fff' : 'var(--text-primary)' }}>{label}</span>
            </div>
            {status && (
                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 8px', borderRadius: '2px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', fontSize: '11px', color: connection === 'failed' ? 'var(--state-danger)' : 'var(--text-secondary)' }}>
                    {connection !== 'failed' && <Spinner size={9} />}
                    {status}
                </div>
            )}
        </div>
    );
};

/**
 * A dock button. "Unavailable" buttons stay focusable and keep their tooltip
 * (a disabled <button> would swallow the hover), but do nothing.
 */
const DockButton = ({ icon: Icon, label, onClick, active = false, danger = false, unavailable = false, badge, wide = false, testId }) => {
    const bg = danger ? 'var(--state-danger)' : active ? 'var(--accent)' : 'var(--bg-active)';
    const color = danger ? '#fff' : active ? '#0c0c0c' : 'var(--text-primary)';
    return (
        <button
            type="button"
            data-testid={testId}
            title={label}
            aria-label={label}
            aria-disabled={unavailable || undefined}
            aria-pressed={active || undefined}
            onClick={unavailable ? undefined : onClick}
            style={{
                position: 'relative', width: wide ? 64 : 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: bg, color, border: `1px solid ${danger ? 'var(--state-danger)' : active ? 'var(--accent)' : 'var(--border-default)'}`,
                borderRadius: '2px', cursor: unavailable ? 'not-allowed' : 'pointer', opacity: unavailable ? 0.45 : 1, transition: 'background 120ms ease',
            }}
        >
            <Icon size={19} />
            {badge !== undefined && (
                <span style={{ position: 'absolute', top: '-6px', right: '-6px', minWidth: '16px', height: '16px', padding: '0 4px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--text-primary)', color: 'var(--bg-base)' }}>
                    {badge}
                </span>
            )}
        </button>
    );
};

const ParticipantsPanel = ({ participants, peerStates, onClose }) => (
    <aside data-testid="huddle-participants-panel" style={{ width: '260px', flexShrink: 0, borderLeft: '1px solid var(--border-default)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Participants ({participants.length})</span>
            <button onClick={onClose} title="Close participants" aria-label="Close participants" style={{ display: 'flex', padding: '4px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={15} />
            </button>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: '6px 0', overflowY: 'auto' }}>
            {participants.map(p => {
                const status = p.isLocal ? null : CONNECTION_LABELS[peerStates[p.userId]];
                return (
                    <li key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                            {getInitials(p.username || '?')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.username || 'Guest'}{p.isLocal ? ' (you)' : ''}
                            </p>
                            {status && <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{status}</p>}
                        </div>
                        {p.videoEnabled ? <Video size={14} style={{ color: 'var(--text-secondary)' }} /> : null}
                        {p.audioEnabled === false
                            ? <MicOff size={14} style={{ color: 'var(--state-danger)' }} aria-label="Muted" />
                            : <Mic size={14} style={{ color: 'var(--text-secondary)' }} aria-label="Mic on" />}
                    </li>
                );
            })}
        </ul>
    </aside>
);

const ActiveRoom = ({ huddle, onLeave }) => {
    const { showToast } = useToast();
    const {
        participants, muted, toggleMute, isVideo, cameraOn, toggleCamera,
        localStream, remoteStreams, screenStream, startScreenShare, stopScreenShare, peerStates,
    } = huddle;
    const [now, setNow] = useState(Date.now());
    const [showParticipants, setShowParticipants] = useState(false);
    // The call keeps running when you leave this page, so time it from its real start.
    const started = huddle.session?.startedAt || huddle.selectedHuddle?.startTime;
    const duration = started ? Math.max(0, Math.floor((now - new Date(started).getTime()) / 1000)) : 0;

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // This page shows the call, so the floating "in huddle" pill hides while it is open.
    const { huddleId, registerInlineUI } = huddle;
    useEffect(() => (huddleId && registerInlineUI ? registerInlineUI(huddleId) : undefined), [huddleId, registerInlineUI]);

    const hasCameraTrack = !!localStream && localStream.getVideoTracks().length > 0;
    const sharing = !!screenStream;
    const cameraLabel = !isVideo
        ? 'Camera is available in video huddles'
        : !hasCameraTrack ? 'No camera available'
            : sharing ? 'Stop sharing to change the camera'
                : cameraOn ? 'Turn camera off' : 'Turn camera on';
    const screenLabel = !isVideo
        ? 'Screen sharing is available in video huddles'
        : !hasCameraTrack ? 'Screen sharing needs a camera connection'
            : sharing ? 'Stop sharing screen' : 'Share screen';

    const handleScreen = async () => {
        if (sharing) { stopScreenShare(); return; }
        try {
            const ok = await startScreenShare();
            if (!ok) showToast('Screen sharing is not available in this huddle.', 'info');
        } catch (err) {
            if (err?.name === 'NotAllowedError') return; // the user closed the picker
            showToast(err?.message || 'Could not share your screen.', 'error');
        }
    };

    const count = participants.length;
    const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;

    return (
        <div data-testid="huddle-room" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)', fontFamily: FONT }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--state-success)', flexShrink: 0 }} />
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {huddle.selectedHuddle?.channelName || huddle.selectedHuddle?.channelId || huddle.selectedHuddle?.dmId
                            ? callTitle(huddle.selectedHuddle)
                            : (huddle.selectedHuddle?.title || 'Huddle')}
                    </h3>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatTime(duration)}</span>
                    {sharing && (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', padding: '2px 8px', border: '1px solid var(--border-accent)', borderRadius: '2px', flexShrink: 0 }}>
                            Sharing your screen
                        </span>
                    )}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {isVideo ? 'Video huddle' : 'Voice huddle'} · {count} {count === 1 ? 'participant' : 'participants'}
                </span>
            </header>

            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: '12px', maxWidth: cols === 1 ? '720px' : '1200px', margin: '0 auto' }}>
                        {participants.map(p => (
                            <ParticipantTile
                                key={p.userId}
                                participant={p}
                                stream={p.isLocal ? (screenStream || localStream) : remoteStreams[p.userId]}
                                showVideo={p.isLocal ? (sharing || cameraOn) : p.videoEnabled !== false && isVideo}
                                mirror={p.isLocal && !sharing}
                                connection={peerStates[p.userId]}
                            />
                        ))}
                    </div>
                    {count <= 1 && (
                        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Waiting for others to join. Teammates see this huddle under Live now.
                        </p>
                    )}
                </main>
                {showParticipants && (
                    <ParticipantsPanel participants={participants} peerStates={peerStates} onClose={() => setShowParticipants(false)} />
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 16px 16px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <DockButton testId="room-mute" icon={muted ? MicOff : Mic} label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute} danger={muted} />
                    <DockButton testId="room-camera" icon={isVideo && cameraOn ? Video : VideoOff} label={cameraLabel} onClick={toggleCamera}
                        unavailable={!isVideo || !hasCameraTrack || sharing} />
                    <DockButton testId="room-screen" icon={sharing ? MonitorOff : Monitor} label={screenLabel} onClick={handleScreen}
                        active={sharing} unavailable={!isVideo || !hasCameraTrack} />
                    <DockButton icon={Hand} label="Raise hand: coming soon" unavailable />
                    <DockButton testId="room-workspace" icon={PanelRight} label={huddle.workspaceOpen ? 'Hide huddle workspace' : 'Notes, tasks, chat and wrap-up'}
                        onClick={() => (huddle.workspaceOpen ? huddle.closeWorkspace() : huddle.openWorkspace())} active={!!huddle.workspaceOpen} />
                    <span style={{ width: '1px', height: '28px', background: 'var(--border-default)', margin: '0 4px' }} />
                    <DockButton testId="room-participants" icon={Users} label={showParticipants ? 'Hide participants' : 'Show participants'}
                        onClick={() => setShowParticipants(s => !s)} active={showParticipants} badge={count} />
                    <DockButton testId="room-leave" icon={PhoneOff} label="Leave huddle" onClick={onLeave} danger wide />
                </div>
            </div>
        </div>
    );
};

const Meetings = () => {
    const { showToast } = useToast();
    const { workspaceId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const huddle = useHuddleContext();
    const {
        active, startHuddle, joinHuddle, leaveHuddle, connecting, connectError, dismissConnectError, activeWorkspaceHuddles,
    } = huddle;

    const { createMeeting } = useScheduledMeetings(workspaceId);
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    const params = new URLSearchParams(location.search);
    const meetingParam = params.get('meeting');
    const joinParam = params.get('join');
    const startParam = params.get('start');
    const handledRef = useRef(null);

    const clearParams = useCallback(() => {
        const next = new URLSearchParams(location.search);
        ['meeting', 'join', 'start'].forEach(k => next.delete(k));
        const qs = next.toString();
        navigate(`/workspace/${workspaceId}/huddles${qs ? `?${qs}` : ''}`, { replace: true });
    }, [location.search, navigate, workspaceId]);

    // ?meeting=<id>: the call for a scheduled meeting (one fixed huddle per meeting).
    useEffect(() => {
        if (!meetingParam || handledRef.current === `meeting:${meetingParam}`) return;
        handledRef.current = `meeting:${meetingParam}`;
        const stateTitle = location.state?.meetingTitle;
        (async () => {
            let meeting = null;
            try {
                const { data } = await api.post(`/api/v2/meetings/${meetingParam}/join`, {});
                meeting = data.meeting;
            } catch (err) {
                showToast(err?.response?.data?.message || 'Could not open that meeting.', 'error');
                clearParams();
                return;
            }
            const path = meetingConversationPath(workspaceId, meeting);
            if (path) {
                // Meetings scheduled in a conversation meet in that conversation's huddle.
                showToast('This meeting happens in its conversation. Start or join the huddle there.', 'info');
                navigate(path, { replace: true });
                return;
            }
            clearParams();
            try {
                await startHuddle(meeting?.title || stateTitle || 'Meeting', { huddleId: meetingHuddleId(meetingParam) });
            } catch { /* the error view offers Retry */ }
        })();
    }, [meetingParam, location.state, workspaceId, startHuddle, showToast, clearParams, navigate]);

    // ?start=1: "Start huddle" pressed elsewhere (e.g. from a meeting page's sidebar).
    useEffect(() => {
        if (!startParam || handledRef.current === 'start') return;
        handledRef.current = 'start';
        clearParams();
        if (!active) startHuddle('Workspace huddle').catch(() => {});
    }, [startParam, active, startHuddle, clearParams]);

    // ?join=<huddleId>: join a live workspace huddle once it shows up in the list.
    useEffect(() => {
        if (!joinParam || handledRef.current === `join:${joinParam}`) return undefined;
        const target = activeWorkspaceHuddles.find(h => h.id === joinParam);
        if (target) {
            handledRef.current = `join:${joinParam}`;
            clearParams();
            joinHuddle(target).catch(() => {});
            return undefined;
        }
        const t = setTimeout(() => {
            handledRef.current = `join:${joinParam}`;
            clearParams();
            showToast('That huddle has already ended.', 'info');
        }, 4000);
        return () => clearTimeout(t);
    }, [joinParam, activeWorkspaceHuddles, joinHuddle, clearParams, showToast]);

    const handleStart = (video) => {
        startHuddle(video ? 'Workspace video huddle' : 'Workspace huddle', { video }).catch(() => { /* error view */ });
    };

    const handleSchedule = useCallback(async (payload) => {
        await createMeeting(payload);
        showToast('Meeting scheduled', 'success');
    }, [createMeeting, showToast]);

    const modal = showScheduleModal && (
        <ScheduleMeetingModal
            onSchedule={handleSchedule}
            onClose={() => setShowScheduleModal(false)}
        />
    );

    if (active) {
        return <ActiveRoom huddle={huddle} onLeave={leaveHuddle} />;
    }

    if (connecting) return <ConnectingView label={connecting.label} />;

    if (connectError) {
        return (
            <ErrorView
                message={connectError.message}
                onRetry={connectError.retry}
                onBack={dismissConnectError}
            />
        );
    }

    return (
        <>
            <LandingView
                onStart={() => handleStart(false)}
                onStartVideo={() => handleStart(true)}
                onSchedule={() => setShowScheduleModal(true)}
                starting={!!connecting}
            />
            {modal}
        </>
    );
};

export default Meetings;
