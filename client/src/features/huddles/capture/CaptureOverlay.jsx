import React, { useEffect, useMemo, useState } from 'react';
import { X, PhoneOff, Check, Captions } from 'lucide-react';
import { useCallCapture } from './CallCaptureContext';
import { recentCaptions } from './captions';
import './capture.css';

/** Re-render every second while captions are showing, so old lines fade out. */
function useNow(active) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!active) return undefined;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [active]);
    return now;
}

/** Asks me to acknowledge that someone else is recording or transcribing the call. */
export function ConsentDialog({ pending, onAccept, onLeave }) {
    if (!pending.length) return null;
    const recording = pending.filter((p) => p.kind === 'recording');
    const captions = pending.filter((p) => p.kind === 'captions');
    return (
        <div className="gl-x-overlay cc-consent-scrim" data-testid="capture-consent">
            <div className="gl-card gl-x-dialog cc-consent" role="alertdialog" aria-modal="true" aria-labelledby="cc-consent-title" aria-describedby="cc-consent-body">
                <h2 id="cc-consent-title">
                    {recording.length ? <span className="cc-rec-dot" aria-hidden="true" /> : <span className="cc-cc-mark" aria-hidden="true">CC</span>}
                    {recording.length ? 'This call is being recorded' : 'Live captions are on'}
                </h2>
                <div id="cc-consent-body">
                    <ul>
                        {recording.map((p) => <li key={`r${p.userId}`}><strong>{p.name}</strong> is recording the call audio (and any shared screen).</li>)}
                        {captions.map((p) => <li key={`c${p.userId}`}><strong>{p.name}</strong> turned on live captions; what they say is transcribed and saved with the meeting.</li>)}
                    </ul>
                    <p>
                        {recording.length
                            ? 'What you say while the recording runs is saved and can be played back by people in this workspace.'
                            : 'Your own speech is only transcribed if you turn captions on yourself.'}
                        {' '}If you don’t agree, you can leave the call.
                    </p>
                </div>
                <div className="cc-actions">
                    <button type="button" className="gl-btn gl-x-danger" onClick={onLeave} data-testid="capture-consent-leave">
                        <PhoneOff size={13} /> Leave call
                    </button>
                    <button type="button" className="gl-btn gl-btn--primary" onClick={() => onAccept(pending)} data-testid="capture-consent-accept" autoFocus>
                        <Check size={13} /> Stay in the call
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Global call chrome for capture: the "being recorded / captions on" banner
 * everyone sees, the consent dialog, and the live caption strip.
 */
export default function CaptureOverlay() {
    const cap = useCallCapture();
    const [hideStrip, setHideStrip] = useState(false);
    const showStrip = !!cap?.live && !!cap.anyoneTranscribing && !hideStrip;
    const now = useNow(showStrip);
    const lines = useMemo(() => (showStrip ? recentCaptions(cap.segments, { now }) : []), [showStrip, cap?.segments, now]);
    useEffect(() => { if (!cap?.anyoneTranscribing) setHideStrip(false); }, [cap?.anyoneTranscribing]);

    if (!cap?.live) return null;
    const recordingOn = cap.recording.state === 'recording' || [...cap.captureState.values()].some((v) => v.recording);

    return (
        <>
            {cap.bannerText && (
                <div className="cc-banner" role="status" aria-live="polite" data-testid="capture-banner">
                    {recordingOn ? <span className="cc-rec-dot" aria-hidden="true" /> : <span className="cc-cc-mark" aria-hidden="true">CC</span>}
                    <span className="cc-banner-text">{cap.bannerText}</span>
                    {cap.anyoneTranscribing && hideStrip && (
                        <button type="button" className="gl-icon-btn" onClick={() => setHideStrip(false)} title="Show captions" aria-label="Show captions">
                            <Captions size={13} />
                        </button>
                    )}
                </div>
            )}
            {showStrip && (lines.length > 0 || cap.interim) && (
                <div className="cc-strip" aria-live="polite" aria-label="Live captions" data-testid="caption-strip">
                    <button type="button" className="gl-icon-btn cc-strip-close" onClick={() => setHideStrip(true)} title="Hide captions" aria-label="Hide captions">
                        <X size={12} />
                    </button>
                    {lines.map((s) => (
                        <p key={`${s.speakerId}-${s.startedAt}`} className="cc-strip-line">
                            <span className="cc-strip-who">{String(s.speakerId) === cap.me.id ? 'You' : (s.speakerName || 'Speaker')}</span>
                            {s.text}
                        </p>
                    ))}
                    {cap.interim && (
                        <p className="cc-strip-line cc-strip-interim"><span className="cc-strip-who">You</span>{cap.interim}</p>
                    )}
                </div>
            )}
            <ConsentDialog pending={cap.pending} onAccept={cap.acknowledge} onLeave={() => cap.leaveCall?.()} />
        </>
    );
}
