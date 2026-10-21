import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Video, Hand, X } from 'lucide-react';

/** 1:05 or 1:02:03. */
export function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const mm = h ? String(m).padStart(2, '0') : String(m);
    return `${h ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`;
}

export function getInitials(name = '') {
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export const CONNECTION_LABELS = {
    new: 'Connecting…',
    connecting: 'Connecting…',
    disconnected: 'Reconnecting…',
    failed: 'Connection failed',
};

export const Spinner = ({ size = 14, color = 'currentColor' }) => (
    <span style={{ width: size, height: size, border: `2px solid ${color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block', flexShrink: 0 }} />
);

/** The stream shown for a participant: my screen or camera, or their stream. */
export function streamFor(p, { localStream, screenStream, remoteStreams }) {
    return p.isLocal ? (screenStream || localStream) : remoteStreams?.[p.userId];
}

/** Whether a participant's video is on (my screen share counts as video). */
export function videoOn(p, { cameraOn, screenStream }) {
    return p.isLocal ? (!!screenStream || cameraOn) : !!p.videoEnabled;
}

/**
 * One participant: their video when it is on, otherwise their initials. A ring shows who is
 * speaking. Audio plays through hidden <audio> elements, so every <video> is muted.
 */
export function ParticipantTile({ participant, stream, showVideo, mirror, connection, speaking = false, compact = false }) {
    const ref = useRef(null);
    const hasVideo = showVideo && !!stream && stream.getVideoTracks().length > 0;
    const label = participant.isLocal ? 'You' : (participant.username || 'Guest');
    const isAudioOn = participant.audioEnabled !== false;
    const status = !participant.isLocal ? CONNECTION_LABELS[connection] : null;

    useEffect(() => {
        if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
    }, [stream, hasVideo]);

    return (
        <div
            data-testid={participant.isLocal ? 'video-tile-local' : 'video-tile-remote'}
            className={`cs-tile${speaking ? ' is-speaking' : ''}${compact ? ' is-compact' : ''}`}
            title={label}
        >
            {hasVideo ? (
                <video ref={ref} autoPlay playsInline muted className="cs-video" style={mirror ? { transform: 'scaleX(-1)' } : undefined} />
            ) : (
                <div className="cs-avatar"><span>{getInitials(participant.username || label)}</span></div>
            )}
            <div className={`cs-name${hasVideo ? ' on-video' : ''}`}>
                {isAudioOn ? <Mic size={12} /> : <MicOff size={12} className="cs-danger" />}
                <span>{label}</span>
            </div>
            {participant.handRaised && (
                <div className="cs-hand" title="Hand raised"><Hand size={11} />{!compact && ' Hand raised'}</div>
            )}
            {status && !compact && (
                <div className={`cs-status${connection === 'failed' ? ' is-failed' : ''}`}>
                    {connection !== 'failed' && <Spinner size={9} />}
                    {status}
                </div>
            )}
        </div>
    );
}

/**
 * A dock button. "Unavailable" buttons stay focusable and keep their tooltip
 * (a disabled <button> would swallow the hover), but do nothing.
 */
export function DockButton({ icon: Icon, label, onClick, active = false, danger = false, unavailable = false, badge, wide = false, testId, small = false }) {
    const cls = ['cs-btn', active && 'is-active', danger && 'is-danger', wide && 'is-wide', small && 'is-small', unavailable && 'is-unavailable']
        .filter(Boolean).join(' ');
    return (
        <button
            type="button"
            className={cls}
            data-testid={testId}
            title={label}
            aria-label={label}
            aria-disabled={unavailable || undefined}
            aria-pressed={active || undefined}
            onClick={unavailable ? undefined : onClick}
        >
            <Icon size={small ? 15 : 19} />
            {badge !== undefined && <span className="cs-badge">{badge}</span>}
        </button>
    );
}

export function ParticipantsPanel({ participants, peerStates, onClose }) {
    return (
        <aside data-testid="huddle-participants-panel" className="cs-people">
            <div className="cs-people-head">
                <span>Participants ({participants.length})</span>
                <button type="button" className="gl-icon-btn" onClick={onClose} title="Close participants" aria-label="Close participants">
                    <X size={15} />
                </button>
            </div>
            <ul>
                {participants.map(p => {
                    const status = p.isLocal ? null : CONNECTION_LABELS[peerStates?.[p.userId]];
                    return (
                        <li key={p.userId}>
                            <span className="cs-people-avatar">{getInitials(p.username || '?')}</span>
                            <div className="cs-people-text">
                                <p>{p.username || 'Guest'}{p.isLocal ? ' (you)' : ''}</p>
                                {status && <p className="cs-people-sub">{status}</p>}
                            </div>
                            {p.handRaised ? <Hand size={14} className="cs-accent" aria-label="Hand raised" /> : null}
                            {p.videoEnabled ? <Video size={14} className="cs-muted" /> : null}
                            {p.audioEnabled === false
                                ? <MicOff size={14} className="cs-danger" aria-label="Muted" />
                                : <Mic size={14} className="cs-muted" aria-label="Mic on" />}
                        </li>
                    );
                })}
            </ul>
        </aside>
    );
}
