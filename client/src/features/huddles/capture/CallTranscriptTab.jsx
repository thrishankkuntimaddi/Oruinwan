import React, { useEffect, useState } from 'react';
import { Captions, CaptionsOff, Circle, Square, Loader2, RefreshCw, Download, X } from 'lucide-react';
import useCallTranscript from './useCallTranscript';
import { formatBytes } from './recorderMime';
import { transcriptText } from './captions';
import TranscriptView from './TranscriptView';
import RecordingPlayer from './RecordingPlayer';
import './capture.css';

function useElapsed(since) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!since) return undefined;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [since]);
    if (!since) return '';
    const s = Math.max(0, Math.round((now - since) / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Captions and recording controls for the running call. */
function LiveControls({ cap }) {
    const { captions, recording } = cap;
    const elapsed = useElapsed(recording.state === 'recording' ? recording.startedAt : null);
    const [confirmRec, setConfirmRec] = useState(false);

    return (
        <>
            <div className="cc-controls">
                <button type="button" className="gl-btn gl-btn--sm" aria-pressed={captions.on} data-testid="captions-toggle"
                    disabled={!captions.supported}
                    title={captions.supported ? (captions.on ? 'Stop transcribing your microphone' : 'Transcribe your microphone for everyone') : captions.reason}
                    onClick={captions.on ? captions.stop : captions.start}>
                    {captions.on ? <CaptionsOff size={13} /> : <Captions size={13} />}
                    {captions.on ? 'Stop my captions' : 'Turn on my captions'}
                </button>
                {recording.isHost && recording.supported && (
                    recording.state === 'recording' ? (
                        <button type="button" className="gl-btn gl-btn--sm cc-btn-rec" aria-pressed="true" onClick={recording.stop} data-testid="record-stop">
                            <Square size={12} /> Stop recording · {elapsed}
                        </button>
                    ) : (
                        <button type="button" className="gl-btn gl-btn--sm cc-btn-rec" aria-pressed="false" data-testid="record-start"
                            disabled={recording.state === 'uploading'} onClick={() => setConfirmRec(true)}>
                            <Circle size={12} /> Record
                        </button>
                    )
                )}
            </div>
            {!captions.supported && <p className="cc-alert" role="note" data-testid="captions-unsupported">{captions.reason}</p>}
            {captions.error && (
                <p className="cc-alert cc-alert--danger" role="alert">
                    {captions.error}
                    <button type="button" className="gl-x-link" style={{ marginLeft: 8 }} onClick={captions.clearError}>Dismiss</button>
                </p>
            )}
            {captions.on && <p className="cc-note">Everyone in the call sees your captions; they are saved with the transcript. Muting pauses them.</p>}
            {!recording.isHost && <p className="cc-note">Only the person who started the call (or the meeting organiser) can record it.</p>}
            {recording.isHost && !recording.supported && <p className="cc-alert" role="note">This browser cannot record calls.</p>}

            {confirmRec && (
                <div role="alertdialog" aria-label="Start recording?" className="gl-card" style={{ padding: 12, margin: '6px 0' }}>
                    <p className="hw-muted" style={{ margin: '0 0 8px' }}>
                        Everyone in the call will be told that you are recording and asked to agree or leave.
                        The recording includes everyone’s audio and, if you are sharing your screen (or your camera is on), that video.
                        Start sharing before you record to include your screen.
                    </p>
                    <div className="hw-row" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="gl-btn gl-btn--sm" onClick={() => setConfirmRec(false)}>Cancel</button>
                        <button type="button" className="gl-btn gl-btn--sm gl-x-danger-solid" data-testid="record-confirm"
                            onClick={() => { setConfirmRec(false); recording.start(); }}>
                            <Circle size={12} /> Start recording
                        </button>
                    </div>
                </div>
            )}
            {recording.state === 'recording' && (
                <p className="cc-note"><span className="cc-rec-dot" style={{ display: 'inline-block', marginRight: 6 }} />Recording · {formatBytes(recording.bytes)}. It uploads when you stop or leave the call.</p>
            )}
            {recording.state === 'uploading' && (
                <div>
                    <p className="cc-note"><Loader2 size={11} className="animate-spin" /> Uploading the recording… {Math.round(recording.progress * 100)}%</p>
                    <div className="cc-progress"><span style={{ width: `${Math.round(recording.progress * 100)}%` }} /></div>
                </div>
            )}
            {recording.state === 'error' && (
                <div className="cc-alert cc-alert--danger" role="alert">
                    {recording.error}
                    {recording.failedUpload && (
                        <div className="hw-row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
                            <button type="button" className="gl-btn gl-btn--sm" onClick={recording.retryUpload}><RefreshCw size={12} /> Retry upload</button>
                            <a className="gl-btn gl-btn--sm" href={recording.failedUpload.url} download={recording.failedUpload.fileName}><Download size={12} /> Save a copy</a>
                            <button type="button" className="gl-btn gl-btn--sm" onClick={recording.discardFailed}><X size={12} /> Discard</button>
                        </div>
                    )}
                </div>
            )}
            {recording.state !== 'error' && recording.error && <p className="cc-alert" role="note">{recording.error}</p>}
            {cap.sendError && <p className="cc-alert cc-alert--danger" role="alert">{cap.sendError}</p>}
        </>
    );
}

/**
 * Huddle workspace tab: live captions, recording and the transcript of the call.
 * For a finished call it shows that run's recording and transcript.
 */
export default function CallTranscriptTab({ call, session, live }) {
    const { cap, isLiveHere, target, segments, loading, error } = useCallTranscript(call, session, live);
    const startedAt = session?.startedAt || call?.startTime;
    const copy = () => { navigator.clipboard?.writeText(transcriptText(segments, startedAt)).catch(() => {}); };

    if (!call) return null;
    return (
        <div data-testid="call-transcript-tab">
            {isLiveHere && <LiveControls cap={cap} />}

            <div className="hw-section"><span>Recording</span></div>
            {target && <RecordingPlayer target={target} compact={isLiveHere} refreshKey={isLiveHere ? (cap.recording.lastRecording?.uploadedAt || 0) : 0} />}

            <div className="hw-section">
                <span>Transcript</span>
                {segments.length > 0 && <button type="button" className="gl-x-link" onClick={copy}>Copy</button>}
            </div>
            {error && <p className="hw-error">{error}</p>}
            {loading
                ? <p className="hw-muted"><Loader2 size={12} className="animate-spin" /> Loading transcript…</p>
                : (
                    <TranscriptView
                        segments={segments}
                        startedAt={startedAt}
                        myId={cap?.me?.id}
                        interim={isLiveHere ? cap.interim : ''}
                        empty={isLiveHere ? 'Nobody has captions on yet. Turn on yours to transcribe what you say.' : 'This call has no transcript.'}
                    />
                )}
        </div>
    );
}
