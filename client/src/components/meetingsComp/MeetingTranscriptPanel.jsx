import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Loader2, Save, ListChecks, Upload, ChevronDown, ChevronRight, Captions } from 'lucide-react';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { useToast } from '../../contexts/ToastContext';
import { captureApi, errorText, meetingTarget } from '../../features/huddles/capture/captureApi';
import { mergeSegments, transcriptText } from '../../features/huddles/capture/captions';
import { MAX_RECORDING_BYTES, formatBytes } from '../../features/huddles/capture/recorderMime';
import TranscriptView from '../../features/huddles/capture/TranscriptView';
import RecordingPlayer from '../../features/huddles/capture/RecordingPlayer';
import MeetingAssistant from '../../features/huddles/capture/MeetingAssistant';
import '../../features/huddles/capture/capture.css';
import '../../features/huddles/workspace/huddleWorkspace.css';

const ACCEPT = '.webm,.mp4,.m4a,video/webm,audio/webm,video/mp4,audio/mp4';

/** Legacy pasted transcripts become plain lines for the assistant. */
export function legacySegments(text, startedAt) {
    const at = new Date(startedAt || Date.now()).toISOString();
    return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean)
        .map((line) => {
            const m = line.match(/^(?:\[[\d:]+\]\s*)?([^:]{1,40}):\s+(.+)$/);
            return m ? { speakerName: m[1].trim(), text: m[2], startedAt: at } : { speakerName: 'Transcript', text: line, startedAt: at };
        });
}

/**
 * The meeting page's "Transcript & summary" tab: recording player, the live
 * transcript (segments posted by people with captions on, updated over the
 * meeting room), AI summary, action item extraction and the AI assistant.
 */
export default function MeetingTranscriptPanel({ meeting, workspaceId, myId, onSaveTranscript, onGenerateSummary, onActionItems }) {
    const socket = useOptionalSocket()?.socket || null;
    const { showToast } = useToast();
    const target = useMemo(() => meetingTarget(meeting._id), [meeting._id]);

    const [segments, setSegments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [legacyText, setLegacyText] = useState(meeting.transcript || '');
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        captureApi.transcript(target)
            .then((d) => {
                if (cancelled) return;
                setSegments(d?.segments || []);
                if (!d?.segments?.length && d?.text) setLegacyText(d.text);
            })
            .catch((err) => { if (!cancelled) setLoadError(errorText(err, 'Could not load the transcript')); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [target]);

    useEffect(() => {
        if (!socket) return undefined;
        const onSegments = (p = {}) => {
            if (String(p.meetingId) === String(meeting._id)) setSegments((prev) => mergeSegments(prev, p.segments || []));
        };
        const onItems = (p = {}) => {
            if (String(p.meetingId) === String(meeting._id) && Array.isArray(p.actionItems)) onActionItems?.(p.actionItems);
        };
        socket.on('meeting:transcript_segments', onSegments);
        socket.on('meeting:action_items_updated', onItems);
        return () => {
            socket.off('meeting:transcript_segments', onSegments);
            socket.off('meeting:action_items_updated', onItems);
        };
    }, [socket, meeting._id, onActionItems]);

    /* Summary */
    const [summary, setSummary] = useState(meeting.summary || '');
    const [generating, setGenerating] = useState(false);
    const generate = async () => {
        setGenerating(true);
        try {
            setSummary(await onGenerateSummary());
            showToast('Summary generated', 'success');
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not generate a summary', 'error');
        } finally {
            setGenerating(false);
        }
    };

    /* Action items */
    const [extracting, setExtracting] = useState(false);
    const [extracted, setExtracted] = useState(null);
    const extract = async () => {
        setExtracting(true);
        try {
            const res = await captureApi.extractActionItems(target, true);
            setExtracted(res);
            if (res?.meeting?.actionItems) onActionItems?.(res.meeting.actionItems);
            showToast(res?.added ? `Added ${res.added} action item${res.added === 1 ? '' : 's'}` : 'No new action items found', res?.added ? 'success' : 'info');
        } catch (err) {
            showToast(errorText(err, 'Could not extract action items'), 'error');
        } finally {
            setExtracting(false);
        }
    };

    /* Upload a recording made elsewhere */
    const fileRef = useRef(null);
    const [uploading, setUploading] = useState(null); // progress 0..1
    const [recKey, setRecKey] = useState(0);
    const upload = useCallback(async (file) => {
        if (!file) return;
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

    /* Legacy text transcript */
    const [showLegacy, setShowLegacy] = useState(false);
    const [savingLegacy, setSavingLegacy] = useState(false);
    const saveLegacy = async () => {
        setSavingLegacy(true);
        try {
            await onSaveTranscript(legacyText);
            showToast('Transcript saved', 'success');
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not save the transcript', 'error');
        } finally {
            setSavingLegacy(false);
        }
    };

    const assistantSegments = segments.length ? segments : legacySegments(legacyText, meeting.startTime);
    const names = useMemo(() => Object.fromEntries((meeting.participants || []).map((p) => [String(p._id), p.firstName ? `${p.firstName} ${p.lastName || ''}`.trim() : p.username])), [meeting.participants]);
    const live = meeting.status === 'live';

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '24px', alignItems: 'start' }} data-testid="meeting-transcript-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                <div className="hw-section">
                    <span>Recording</span>
                    <button type="button" className="gl-x-link" onClick={() => fileRef.current?.click()} disabled={uploading !== null}>
                        {uploading !== null ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} {uploading !== null ? `Uploading ${Math.round(uploading * 100)}%` : 'Upload'}
                    </button>
                    <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
                </div>
                <RecordingPlayer target={target} refreshKey={recKey} />

                <div className="hw-section">
                    <span>Transcript</span>
                    {segments.length > 0 && (
                        <button type="button" className="gl-x-link" onClick={() => navigator.clipboard?.writeText(transcriptText(segments, meeting.startTime)).catch(() => {})}>Copy</button>
                    )}
                </div>
                {live && (
                    <p className="cc-note"><Captions size={11} style={{ verticalAlign: '-1px' }} /> People in the call add to this with live captions (the CC button in the call). New lines appear here as they are said.</p>
                )}
                {loadError && <p className="hw-error">{loadError}</p>}
                {loading ? <p className="hw-muted"><Loader2 size={12} className="animate-spin" /> Loading transcript…</p> : (
                    <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                        <TranscriptView segments={segments} startedAt={meeting.startTime} myId={myId} follow={live}
                            empty={legacyText ? 'No live transcript. A text transcript was added below.' : 'No transcript yet. Turn on live captions in the call, or add a text transcript below.'} />
                    </div>
                )}

                <button type="button" className="gl-x-link gl-x-link--muted" onClick={() => setShowLegacy((s) => !s)} aria-expanded={showLegacy} style={{ alignSelf: 'flex-start' }}>
                    {showLegacy ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Text transcript (paste or type)
                </button>
                {showLegacy && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <textarea className="gl-input" value={legacyText} onChange={(e) => setLegacyText(e.target.value)} rows={6}
                            placeholder="Paste or type the meeting transcript here…" style={{ resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 }} />
                        <button type="button" className="gl-btn gl-btn--sm" onClick={saveLegacy} disabled={savingLegacy} style={{ alignSelf: 'flex-start' }}>
                            {savingLegacy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save text transcript
                        </button>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                <div className="hw-section"><span>AI summary</span></div>
                <div className="cc-controls">
                    <button type="button" className="gl-btn gl-btn--sm gl-btn--primary" onClick={generate} disabled={generating}>
                        {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {generating ? 'Generating…' : summary ? 'Regenerate summary' : 'Generate summary'}
                    </button>
                    <button type="button" className="gl-btn gl-btn--sm" onClick={extract} disabled={extracting} title="Find action items in the transcript and add them to Action items">
                        {extracting ? <Loader2 size={12} className="animate-spin" /> : <ListChecks size={12} />} Extract action items
                    </button>
                </div>
                {summary ? <div className="cc-msg" style={{ borderLeft: '3px solid var(--accent)' }}>{summary}</div>
                    : <p className="hw-muted">No summary yet. It is written from the transcript (or the shared notes when there is none).</p>}
                {extracted && (
                    extracted.extracted?.length ? (
                        <ul className="cc-actions-list">
                            {extracted.extracted.map((a, i) => <li key={i}>{a.text}{a.assigneeId && names[String(a.assigneeId)] ? ` — ${names[String(a.assigneeId)]}` : ''}</li>)}
                        </ul>
                    ) : <p className="cc-note">No action items found in the {extracted.source === 'notes' ? 'shared notes' : 'transcript'}.</p>
                )}

                <MeetingAssistant
                    segments={assistantSegments}
                    target={target}
                    workspaceId={workspaceId}
                    title={meeting.title}
                    myId={myId}
                    ended={false}
                    names={names}
                />
            </div>
        </div>
    );
}
