import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, PictureInPicture2, GripHorizontal } from 'lucide-react';
import { DockButton, ParticipantTile, formatTime, streamFor, videoOn } from './callParts';
import { useSpeaking } from './useSpeaking';
import { useCallHeader, audioStreams } from './CallScreen';
import { canPopOut } from './floatingWindow';

/**
 * Who the mini call shows: whoever is talking, else someone with video, else the first
 * other person, else me. The last speaker stays until someone else talks.
 */
export function pickFeatured(participants, speaking, lastId) {
    const others = participants.filter(p => !p.isLocal);
    const talking = others.find(p => speaking.has(p.userId));
    if (talking) return talking;
    const last = lastId && participants.find(p => p.userId === lastId);
    if (last) return last;
    return others.find(p => p.videoEnabled) || others[0] || participants[0] || null;
}

/** The small call: one tile, the call name and time, and mute / camera / expand / leave. */
export function MiniCallBody({ ctx, floating = false, onExpand, onPopOut, dragHandleProps = null }) {
    const { participants, muted, toggleMute, cameraOn, toggleCamera, localStream, remoteStreams, screenStream } = ctx;
    const { title, seconds } = useCallHeader(ctx);
    const speaking = useSpeaking(audioStreams(participants, { localStream, remoteStreams }));
    const lastRef = useRef(null);
    const featured = pickFeatured(participants, speaking, lastRef.current);
    if (featured && speaking.has(featured.userId)) lastRef.current = featured.userId;

    return (
        <div className={`cs-mini-body${floating ? ' is-floating' : ''}`} data-testid={floating ? 'call-floating' : 'call-mini'}>
            <div className="cs-mini-head" {...(dragHandleProps || {})}>
                {!floating && <GripHorizontal size={13} className="cs-muted cs-grip" aria-hidden="true" />}
                <span className="hw-live-dot" />
                <span className="cs-mini-title">{title}</span>
                <span className="cs-time">{formatTime(seconds)}</span>
            </div>
            {featured && (
                <ParticipantTile
                    compact
                    participant={featured}
                    stream={streamFor(featured, { localStream, screenStream, remoteStreams })}
                    showVideo={videoOn(featured, { cameraOn, screenStream })}
                    mirror={featured.isLocal && !screenStream}
                    speaking={speaking.has(featured.userId) && featured.audioEnabled !== false}
                />
            )}
            <div className="cs-mini-dock">
                <DockButton small testId="mini-mute" icon={muted ? MicOff : Mic} label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute} danger={muted} />
                <DockButton small testId="mini-camera" icon={cameraOn ? Video : VideoOff} label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                    onClick={toggleCamera} active={cameraOn} unavailable={!!screenStream} />
                {!floating && onPopOut && canPopOut() && (
                    <DockButton small testId="mini-popout" icon={PictureInPicture2} label="Pop out" onClick={onPopOut} />
                )}
                <DockButton small testId="mini-expand" icon={Maximize2} label="Open the call" onClick={onExpand} />
                <DockButton small testId="mini-leave" icon={PhoneOff} label="Leave huddle" onClick={ctx.leaveHuddle} danger />
            </div>
        </div>
    );
}

const POS_KEY = 'oruinwan.miniCallPos';
const MARGIN = 12;

function loadPos() {
    try {
        const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
        return p && Number.isFinite(p.right) && Number.isFinite(p.bottom) ? p : null;
    } catch {
        return null;
    }
}

/** Keep the box on screen when the window shrinks. */
export function clampPos(pos, box, view) {
    const maxRight = Math.max(MARGIN, view.width - box.width - MARGIN);
    const maxBottom = Math.max(MARGIN, view.height - box.height - MARGIN);
    return {
        right: Math.min(Math.max(MARGIN, pos.right), maxRight),
        bottom: Math.min(Math.max(MARGIN, pos.bottom), maxBottom),
    };
}

/** The mini call inside the app: a small box you can drag anywhere. */
export default function MiniCall({ ctx, onPopOut }) {
    const boxRef = useRef(null);
    const [pos, setPos] = useState(() => loadPos() || { right: 16, bottom: 16 });
    const drag = useRef(null);

    const onPointerDown = useCallback((e) => {
        if (e.button !== 0 || e.target.closest('button')) return;
        const box = boxRef.current?.getBoundingClientRect();
        if (!box) return;
        drag.current = { x: e.clientX, y: e.clientY, start: pos, box };
        e.currentTarget.setPointerCapture?.(e.pointerId);
    }, [pos]);
    const onPointerMove = useCallback((e) => {
        const d = drag.current;
        if (!d) return;
        const next = { right: d.start.right - (e.clientX - d.x), bottom: d.start.bottom - (e.clientY - d.y) };
        setPos(clampPos(next, d.box, { width: window.innerWidth, height: window.innerHeight }));
    }, []);
    const onPointerUp = useCallback(() => {
        if (!drag.current) return;
        drag.current = null;
        setPos(p => { try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* not saved */ } return p; });
    }, []);

    useEffect(() => {
        const onResize = () => {
            const box = boxRef.current?.getBoundingClientRect();
            if (box) setPos(p => clampPos(p, box, { width: window.innerWidth, height: window.innerHeight }));
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return (
        <div ref={boxRef} className="cs-mini" style={{ right: pos.right, bottom: pos.bottom }} role="region" aria-label="You are in a call">
            <MiniCallBody
                ctx={ctx}
                onExpand={ctx.expandCall}
                onPopOut={onPopOut}
                dragHandleProps={{ onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, title: 'Drag to move' }}
            />
        </div>
    );
}
