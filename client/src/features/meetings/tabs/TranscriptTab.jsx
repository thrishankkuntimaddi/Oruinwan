import React, { useCallback, useRef, useState } from 'react';
import { Loader2, Upload, Captions, Copy } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { captureApi, errorText } from '../../huddles/capture/captureApi';
import { transcriptText } from '../../huddles/capture/captions';
import { MAX_RECORDING_BYTES, formatBytes } from '../../huddles/capture/recorderMime';
import TranscriptView from '../../huddles/capture/TranscriptView';
import RecordingPlayer from '../../huddles/capture/RecordingPlayer';
import LiveControls from '../../huddles/capture/LiveControls';
import { meetingPhase, meetingTimes } from '../meetingModel';
import '../../huddles/capture/capture.css';

const ACCEPT = '.webm,.mp4,.m4a,video/webm,audio/webm,video/mp4,audio/mp4';

/** Legacy pasted transcripts become plain speaker lines (for display and the assistant). */
export function legacySegments(text, startedAt) {
    const at = new Date(startedAt || Date.now()).toISOString();
    return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean)
        .map((line) => {
            const m = line.match(/^(?:\[[\d:]+\]\s*)?([^:]{1,40}):\s+(.+)$/);
            return m ? { speakerName: m[1].trim(), text: m[2], startedAt: at } : { speakerName: 'Transcript', text: line, startedAt: at };
        });
}

/**
 * Transcript: the recording, the live (or full) transcript, and — while I'm in
 * this meeting's call — my captions toggle and the recording controls.
 * `transcript` comes from useMeetingTranscript (shared with Summary & actions).
 */
export default function TranscriptTab({ meeting, transcript, myId, compact = false }) {
    const { showToast } = useToast();
    const { cap, liveHere, target, segments, legacyText, loading, error } = transcript;
    const phase = meetingPhase(meeting);
    const { start } = meetingTimes(meeting);
    const shown = segments.length ? segments : legacySegments(legacyText, start);

    const fileRef = useRef(null);
    const [uploading, setUploading] = useState(null);
    const [recKey, setRecKey] = useState(0);
    const upload = useCallback(async (file) => {
        if (!file || !target) return;
        if (file.size > MAX_RECORDING_BYTES) { showToast(`Recordings can be at most ${formatBytes(MAX_RECORDING_BYTES)}.`, 'error'); return; }
        setUploading(0);
        try {
            await captureApi.uploadRecording(target, file, { fileName: file.name, onProgress: setUploading });
            setRecKey((k) => k + 1);
            showToast('Recording uploaded', 'success');
        } catch (err) {
            showToast(errorText(err, 'Could not upload the recording'), 'error');
        } finally {
            setUploading(null);
        }
    }, [target, showToast]);

    const copy = () => navigator.clipboard?.writeText(transcriptText(shown, start)).then(() => showToast('Transcript copied', 'success')).catch(() => {});
    const recordingKey = recKey + (liveHere ? String(cap?.recording?.lastRecording?.uploadedAt || '') : '') + (meeting.recording?.uploadedAt || '');

    return (
        <div className="mt-cols" data-testid="meeting-tab-transcript">
            <div className="mt-stack">
                {liveHere && cap && (
                    <div className="mt-stack" style={{ gap: 6 }}>
                        <p className="mt-label"><span>In this call</span></p>
                        <LiveControls cap={cap} />
                    </div>
                )}
                <p className="mt-label">
                    <span>Recording</span>
                    {!liveHere && (
                        <button type="button" className="gl-x-link" onClick={() => fileRef.current?.click()} disabled={uploading !== null}>
                            {uploading !== null ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                            {uploading !== null ? `Uploading ${Math.round(uploading * 100)}%` : 'Upload'}
                        </button>
                    )}
                </p>
                <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
                {target && <RecordingPlayer target={target} compact={compact || liveHere} refreshKey={recordingKey} />}
            </div>
            <div className="mt-stack">
                <p className="mt-label">
                    <span>Transcript</span>
                    {shown.length > 0 && <button type="button" className="gl-x-link" onClick={copy}><Copy size={11} /> Copy</button>}
                </p>
                {phase === 'live' && !liveHere && (
                    <p className="mt-muted"><Captions size={11} style={{ verticalAlign: '-1px' }} /> People in the call add to this with live captions. New lines appear as they are said.</p>
                )}
                {error && <p className="mt-error">{error}</p>}
                {loading ? <p className="mt-muted"><Loader2 size={12} className="animate-spin" /> Loading transcript…</p> : (
                    <div className="mt-transcript">
                        <TranscriptView
                            segments={shown}
                            startedAt={start}
                            myId={myId}
                            interim={liveHere ? cap?.interim : ''}
                            follow={phase === 'live'}
                            empty={liveHere ? 'Nobody has captions on yet. Turn on yours to transcribe what you say.'
                                : phase === 'upcoming' ? 'The transcript appears here once the huddle starts and someone turns on live captions.'
                                    : 'This meeting has no transcript.'}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
