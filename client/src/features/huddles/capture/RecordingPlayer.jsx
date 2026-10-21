import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Trash2, RefreshCw, Film } from 'lucide-react';
import { useOptionalSocket } from '../../../contexts/SocketContext';
import { captureApi, errorText } from './captureApi';
import { formatBytes } from './recorderMime';
import './capture.css';

const fmtDuration = (sec) => {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(s / 60);
    return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : m ? `${m} min ${s % 60}s` : `${s}s`;
};

/**
 * The recording of a meeting or a huddle run, with a player. Playback URLs are
 * signed for 10 minutes, so a fresh one is fetched when the player errors.
 * `target` comes from captureTarget() / meetingTarget().
 */
export default function RecordingPlayer({ target: targetProp, canDelete = true, refreshKey = 0, compact = false }) {
    // Callers may build the target inline; only a different endpoint means a different recording.
    const targetKey = targetProp ? `${targetProp.kind}|${targetProp.base}${targetProp.query || ''}` : '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const target = useMemo(() => targetProp, [targetKey]);
    const socket = useOptionalSocket()?.socket || null;
    const [state, setState] = useState({ loading: true, data: null, error: null });
    const [deleting, setDeleting] = useState(false);
    const [confirm, setConfirm] = useState(false);
    // An expired signed URL fails to play: fetch a fresh one, once.
    const retried = useRef(0);
    const onMediaError = () => { if (retried.current < 1) { retried.current += 1; load(); } };

    const load = useCallback(() => {
        if (!target) return;
        setState((s) => ({ ...s, loading: true, error: null }));
        captureApi.recording(target)
            .then((data) => setState({ loading: false, data, error: null }))
            .catch((err) => setState({ loading: false, data: null, error: errorText(err, 'Could not load the recording') }));
    }, [target]);
    useEffect(() => { load(); }, [load, refreshKey]);

    // A recording uploaded or deleted by someone else shows up here.
    useEffect(() => {
        if (!socket || !target) return undefined;
        const mine = (p = {}) => (target.kind === 'meeting' ? String(p.meetingId) === String(target.id) : p.huddleId === target.id);
        const onChange = (p) => { if (mine(p)) load(); };
        const events = target.kind === 'meeting'
            ? ['meeting:recording_ready', 'meeting:recording_deleted']
            : ['huddle:recording_ready', 'huddle:recording_deleted'];
        events.forEach((e) => socket.on(e, onChange));
        return () => events.forEach((e) => socket.off(e, onChange));
    }, [socket, target, load]);

    const remove = async () => {
        setDeleting(true);
        try {
            await captureApi.deleteRecording(target);
            setState({ loading: false, data: null, error: null });
        } catch (err) {
            setState((s) => ({ ...s, error: errorText(err, 'Could not delete the recording') }));
        } finally {
            setDeleting(false);
            setConfirm(false);
        }
    };

    if (state.loading && !state.data) return <p className="hw-muted"><Loader2 size={12} className="animate-spin" /> Loading recording…</p>;
    if (!state.data) {
        return (
            <>
                {state.error && <p className="hw-error">{state.error}</p>}
                <p className="hw-muted" data-testid="recording-none">{compact ? 'No recording.' : 'No recording yet. The host can record the call from the call controls.'}</p>
            </>
        );
    }

    const rec = state.data.recording || {};
    const video = String(rec.mimeType || '').startsWith('video/');
    const meta = [rec.durationSec ? fmtDuration(rec.durationSec) : null, rec.size ? formatBytes(rec.size) : null,
        rec.uploadedAt ? new Date(rec.uploadedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null].filter(Boolean).join(' · ');

    return (
        <div data-testid="recording-player">
            {video
                ? <video className="cc-player" src={state.data.url} controls preload="metadata" onError={onMediaError} />
                : <audio className="cc-player" src={state.data.url} controls preload="metadata" onError={onMediaError} style={{ height: 40 }} />}
            <div className="hw-row" style={{ marginTop: 6 }}>
                <span className="hw-muted hw-grow"><Film size={11} style={{ verticalAlign: '-1px' }} /> {meta || 'Recording'}</span>
                <button type="button" className="gl-icon-btn" onClick={load} title="Reload player" aria-label="Reload player"><RefreshCw size={12} /></button>
                {canDelete && !confirm && (
                    <button type="button" className="gl-icon-btn gl-x-danger" onClick={() => setConfirm(true)} title="Delete recording" aria-label="Delete recording"><Trash2 size={12} /></button>
                )}
            </div>
            {confirm && (
                <div role="alertdialog" aria-label="Delete this recording?" className="gl-card gl-x-confirm" style={{ marginTop: 6 }}>
                    <span>Delete this recording for everyone?</span>
                    <button type="button" className="gl-btn gl-btn--sm" onClick={() => setConfirm(false)} disabled={deleting}>Cancel</button>
                    <button type="button" className="gl-btn gl-btn--sm gl-x-danger-solid" onClick={remove} disabled={deleting}>
                        {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                    </button>
                </div>
            )}
            {state.error && <p className="hw-error">{state.error}</p>}
        </div>
    );
}
