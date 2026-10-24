import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, Hand, X, Monitor, Pin, PinOff } from 'lucide-react';

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
 * One participant: their video when it is on (and the tile is on screen), otherwise their
 * initials. A ring shows who is speaking. Audio never goes through tiles: it plays through
 * hidden <audio> elements (useHuddle), so every <video> is muted and a tile that is off
 * screen (another page, scrolled out of the filmstrip) can drop its video safely.
 *
 * `size` ({ w, h }) sizes the tile from the layout; without it the tile is 16:9 (mini call).
 */
/**
 * True while the stream has a video track that is actually delivering frames. A remote track
 * is "muted" until its first frames arrive and again when the sender stops sending (camera off,
 * screen share ended), and showing a <video> then is a black tile; show the initials instead.
 */
export function useLiveVideo(stream) {
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!stream) return undefined;
        const bump = () => setTick(t => t + 1);
        let tracks = [];
        const watch = () => {
            tracks.forEach(t => { t.removeEventListener?.('mute', bump); t.removeEventListener?.('unmute', bump); t.removeEventListener?.('ended', bump); });
            tracks = stream.getVideoTracks();
            tracks.forEach(t => { t.addEventListener?.('mute', bump); t.addEventListener?.('unmute', bump); t.addEventListener?.('ended', bump); });
            bump();
        };
        watch();
        stream.addEventListener?.('addtrack', watch);
        stream.addEventListener?.('removetrack', watch);
        return () => {
            stream.removeEventListener?.('addtrack', watch);
            stream.removeEventListener?.('removetrack', watch);
            tracks.forEach(t => { t.removeEventListener?.('mute', bump); t.removeEventListener?.('unmute', bump); t.removeEventListener?.('ended', bump); });
        };
    }, [stream]);
    return !!stream && stream.getVideoTracks().some(t => (t.readyState ?? 'live') === 'live' && !t.muted);
}

export function ParticipantTile({
    participant, stream, showVideo, mirror, connection, speaking = false, compact = false,
    size = null, fit = 'cover', visible = true, pinned = false, onPin = null, screen = false, testId,
}) {
    const ref = useRef(null);
    const live = useLiveVideo(stream);
    const hasVideo = visible && showVideo && !!stream && live;
    const name = participant.username || 'Guest';
    const label = participant.isLocal ? 'You' : name;
    const isAudioOn = participant.audioEnabled !== false;
    const status = !participant.isLocal ? CONNECTION_LABELS[connection] : null;
    const weak = !participant.isLocal && (connection === 'disconnected' || connection === 'failed');
    const small = compact || (size && size.w < 240);
    const tiny = size && size.w < 150;

    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        if (el.srcObject !== stream) el.srcObject = stream || null;
        // Detach when the tile goes off screen or the stream changes.
        return () => { el.srcObject = null; };
    }, [stream, hasVideo]);

    const avatar = size ? Math.round(Math.max(28, Math.min(88, size.h * 0.42))) : null;
    const style = size ? { width: size.w, height: size.h, aspectRatio: 'auto' } : undefined;
    const cls = ['cs-tile', speaking && 'is-speaking', small && 'is-compact', tiny && 'is-tiny', weak && 'is-weak',
        pinned && 'is-pinned', hasVideo && 'has-video'].filter(Boolean).join(' ');

    return (
        <div
            data-testid={testId || (participant.isLocal ? 'video-tile-local' : 'video-tile-remote')}
            data-user={participant.userId}
            data-video={hasVideo ? 'on' : 'off'}
            className={cls}
            style={style}
            title={participant.isLocal ? `${name} (you)` : name}
        >
            {hasVideo ? (
                <video ref={ref} autoPlay playsInline muted className="cs-video"
                    style={{ objectFit: fit, ...(mirror ? { transform: 'scaleX(-1)' } : {}) }} />
            ) : (
                <div className="cs-avatar" style={avatar ? { width: avatar, height: avatar } : undefined}>
                    <span style={avatar ? { fontSize: Math.round(avatar * 0.34) } : undefined}>{getInitials(name)}</span>
                </div>
            )}
            <div className={`cs-name${hasVideo ? ' on-video' : ''}`}>
                {isAudioOn ? <Mic size={12} aria-label="Mic on" /> : <MicOff size={12} className="cs-danger" aria-label="Muted" />}
                {screen && <Monitor size={12} aria-label="Screen" />}
                <span>{screen ? `${label === 'You' ? 'Your' : `${label}’s`} screen` : label}</span>
            </div>
            {participant.handRaised && (
                <div className="cs-hand" title="Hand raised" aria-label="Hand raised"><Hand size={11} />{!small && ' Hand raised'}</div>
            )}
            <div className="cs-tile-tr">
                {status && !tiny && (
                    <div className={`cs-status${connection === 'failed' ? ' is-failed' : ''}`}>
                        {connection !== 'failed' && <Spinner size={9} />}
                        {!small && status}
                    </div>
                )}
                {onPin && (
                    <button type="button" className={`cs-pin${pinned ? ' is-on' : ''}`} data-testid="tile-pin"
                        onClick={() => onPin(participant.userId)}
                        title={pinned ? 'Unpin' : screen ? 'Pin this screen to the main stage' : `Pin ${label === 'You' ? 'yourself' : label} to the main stage`}
                        aria-label={pinned ? `Unpin ${label}` : `Pin ${label}`} aria-pressed={pinned}>
                        {pinned ? <PinOff size={13} /> : <Pin size={13} />}
                    </button>
                )}
            </div>
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
