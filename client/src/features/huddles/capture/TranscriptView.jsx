import React, { useEffect, useRef } from 'react';
import { isMarker, offsetLabel } from './captions';
import './capture.css';

/** The full transcript: one line per segment, newest at the bottom. */
export default function TranscriptView({ segments = [], startedAt, myId, interim = '', follow = true, empty = 'Nothing has been transcribed yet.' }) {
    const endRef = useRef(null);
    useEffect(() => {
        if (follow) endRef.current?.scrollIntoView?.({ block: 'nearest' });
    }, [segments.length, interim, follow]);

    if (!segments.length && !interim) return <p className="hw-muted" data-testid="transcript-empty">{empty}</p>;
    const start = startedAt || segments[0]?.startedAt;
    return (
        <div className="cc-transcript" data-testid="transcript-view">
            {segments.map((s, i) => (
                <div key={`${s.speakerId || ''}-${s.startedAt}-${i}`} className={`cc-line${isMarker(s) ? ' cc-line--marker' : ''}`}>
                    <span className="cc-line-time">{offsetLabel(s.startedAt, start)}</span>
                    <span>
                        <span className="cc-line-who">{myId && String(s.speakerId) === String(myId) ? 'You' : (s.speakerName || 'Speaker')}</span>
                        <span className="cc-line-text">{s.text}</span>
                    </span>
                </div>
            ))}
            {interim && (
                <div className="cc-line cc-line--interim">
                    <span className="cc-line-time">…</span>
                    <span><span className="cc-line-who">You</span><span className="cc-line-text">{interim}</span></span>
                </div>
            )}
            <div ref={endRef} />
        </div>
    );
}
