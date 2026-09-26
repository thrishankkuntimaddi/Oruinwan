import React, { useEffect, useRef } from 'react';

/** One participant's video, or their initial while their camera is off. */
export default function VideoTile({ stream, name = '', isLocal = false, cameraOn = true }) {
    const ref = useRef(null);
    const hasVideo = cameraOn && !!stream && stream.getVideoTracks().length > 0;

    useEffect(() => {
        if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
    }, [stream, hasVideo]);

    return (
        <div data-testid={isLocal ? 'video-tile-local' : 'video-tile-remote'} className="relative bg-black/60 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
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
                <div className="h-10 w-10 rounded-full bg-white/15 text-white flex items-center justify-center text-sm font-semibold">
                    {(name || '?').charAt(0).toUpperCase()}
                </div>
            )}
            <span className="absolute bottom-1 left-1.5 text-[10px] text-white/80 bg-black/40 px-1 rounded">
                {isLocal ? 'You' : name}
            </span>
        </div>
    );
}
