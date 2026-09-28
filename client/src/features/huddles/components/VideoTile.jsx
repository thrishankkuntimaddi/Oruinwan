import React, { useEffect, useRef } from 'react';

/** One participant's video, or their initial while their camera is off. */
export default function VideoTile({ stream, name = '', isLocal = false, cameraOn = true }) {
    const ref = useRef(null);
    const hasVideo = cameraOn && !!stream && stream.getVideoTracks().length > 0;

    useEffect(() => {
        if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
    }, [stream, hasVideo]);

    return (
        <div data-testid={isLocal ? 'video-tile-local' : 'video-tile-remote'} style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden', borderRadius: '2px', background: hasVideo ? '#000' : 'var(--bg-active)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {hasVideo ? (
                // Audio plays through the hidden <audio> element, so every video is muted.
                <video
                    ref={ref}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                    style={isLocal ? { transform: 'scaleX(-1)' } : undefined}
                />
            ) : (
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600 }}>
                    {(name || '?').charAt(0).toUpperCase()}
                </div>
            )}
            <span style={{ position: 'absolute', bottom: 4, left: 6, fontSize: '10px', color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '0 4px', borderRadius: '2px' }}>
                {isLocal ? 'You' : name}
            </span>
        </div>
    );
}
