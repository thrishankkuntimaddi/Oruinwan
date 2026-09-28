import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Square, Send, Trash2, X, RotateCw, Circle } from 'lucide-react';
import { pickRecordingMimeType, extensionForMime, baseMime, describeMediaError, formatClock, canRecord } from '../../../../utils/mediaRecording';

export const MAX_VIDEO_NOTE_SECONDS = 60;
const SIZE = 168;

/**
 * Records a short round camera "video note" (up to 60 s): live camera preview, record,
 * watch it back, then send. onRecorded({ file, duration, mimeType, width, height }).
 */
export default function VideoNoteRecorder({ onRecorded, onCancel }) {
    const [phase, setPhase] = useState('starting'); // starting | ready | recording | preview | error
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState(null);
    const [blobUrl, setBlobUrl] = useState(null);

    const liveRef = useRef(null);
    const streamRef = useRef(null);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const resultRef = useRef(null);
    const startedAtRef = useRef(0);
    const stoppedAtRef = useRef(0);
    const timerRef = useRef(null);
    const genRef = useRef(0);
    const discardRef = useRef(false);

    const release = useCallback(() => {
        clearInterval(timerRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
    }, []);

    const openCamera = useCallback(async () => {
        const gen = ++genRef.current;
        setError(null);
        setPhase('starting');
        if (!canRecord()) { setError('Recording isn’t supported in this browser.'); setPhase('error'); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                audio: { echoCancellation: true, noiseSuppression: true },
            });
            if (gen !== genRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
            streamRef.current = stream;
            if (liveRef.current) { liveRef.current.srcObject = stream; liveRef.current.play?.().catch(() => {}); }
            setPhase('ready');
        } catch (err) {
            if (gen !== genRef.current) return;
            release();
            setError(describeMediaError(err, 'camera'));
            setPhase('error');
        }
    }, [release]);

    useEffect(() => {
        openCamera();
        return () => {
            genRef.current += 1;
            discardRef.current = true;
            try { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); } catch { /* stopped */ }
            release();
        };
    }, [openCamera, release]);

    // Attach the stream once the <video> exists (phase changes re-render it).
    useEffect(() => {
        if ((phase === 'ready' || phase === 'recording') && liveRef.current && streamRef.current && liveRef.current.srcObject !== streamRef.current) {
            liveRef.current.srcObject = streamRef.current;
            liveRef.current.play?.().catch(() => {});
        }
    }, [phase]);

    useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

    const stop = useCallback(() => {
        if (!stoppedAtRef.current) stoppedAtRef.current = performance.now();
        clearInterval(timerRef.current);
        const rec = recorderRef.current;
        if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch { /* stopped */ } }
    }, []);

    const record = () => {
        const stream = streamRef.current;
        if (!stream) return;
        chunksRef.current = [];
        discardRef.current = false;
        const mimeType = pickRecordingMimeType('video');
        let rec;
        try {
            rec = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 1_000_000 } : undefined);
        } catch (err) {
            setError(describeMediaError(err, 'camera'));
            setPhase('error');
            return;
        }
        recorderRef.current = rec;
        rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
        rec.onstop = () => {
            const duration = Math.max(1, Math.round(((stoppedAtRef.current || performance.now()) - startedAtRef.current) / 1000));
            if (discardRef.current) return;
            const settings = stream.getVideoTracks()[0]?.getSettings?.() || {};
            const type = rec.mimeType || mimeType || 'video/webm';
            const blob = new Blob(chunksRef.current, { type });
            resultRef.current = { blob, duration: Math.min(duration, MAX_VIDEO_NOTE_SECONDS), mimeType: type, width: settings.width, height: settings.height };
            release();
            setBlobUrl(URL.createObjectURL(blob));
            setElapsed(Math.min(duration, MAX_VIDEO_NOTE_SECONDS));
            setPhase('preview');
        };
        rec.start(500);
        startedAtRef.current = performance.now();
        stoppedAtRef.current = 0;
        setElapsed(0);
        setPhase('recording');
        timerRef.current = setInterval(() => {
            const s = Math.floor((performance.now() - startedAtRef.current) / 1000);
            setElapsed(s);
            if (s >= MAX_VIDEO_NOTE_SECONDS) stop();
        }, 250);
    };

    const cancel = () => {
        genRef.current += 1;
        discardRef.current = true;
        stop();
        release();
        onCancel?.();
    };

    const retake = () => {
        setBlobUrl(null);
        resultRef.current = null;
        openCamera();
    };

    const send = () => {
        const r = resultRef.current;
        if (!r) return;
        const type = baseMime(r.mimeType);
        const file = new File([r.blob], `video-note-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${extensionForMime(type)}`, { type });
        onRecorded?.({ file, duration: r.duration, mimeType: type, width: r.width, height: r.height });
    };

    const circle = {
        width: SIZE, height: SIZE, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        background: '#000', border: `3px solid ${phase === 'recording' ? 'var(--state-danger)' : 'var(--border-accent)'}`,
        position: 'relative',
    };
    const btn = (title, Icon, onClick, { color = 'var(--text-secondary)', testId, primary } = {}) => (
        <button type="button" onClick={onClick} title={title} aria-label={title} data-testid={testId}
            style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 2, cursor: 'pointer', fontSize: 12,
                border: primary ? 'none' : '1px solid var(--border-default)',
                background: primary ? 'var(--accent)' : 'none', color: primary ? '#0c0c0c' : color,
            }}>
            <Icon size={14} /> {title}
        </button>
    );

    return (
        <div data-testid="video-note-recorder" style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: 10, marginBottom: 6,
            background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: 2,
        }}>
            <div style={circle}>
                {phase === 'preview' && blobUrl ? (
                    <video key="preview" data-testid="video-note-preview" src={blobUrl} autoPlay loop playsInline muted
                        title="Click to hear it" onClick={(e) => { e.currentTarget.muted = !e.currentTarget.muted; e.currentTarget.play().catch(() => {}); }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
                ) : (
                    <video key="live" ref={liveRef} muted playsInline autoPlay
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                )}
                {phase === 'starting' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 11 }}>
                        <Camera size={20} />
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Video note</div>
                {phase === 'error' ? (
                    <div role="alert" style={{ fontSize: 12, color: 'var(--state-danger)' }}>{error}</div>
                ) : (
                    <div data-testid="video-note-timer" style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {phase === 'starting' && 'Starting camera…'}
                        {phase === 'ready' && `Up to ${MAX_VIDEO_NOTE_SECONDS} seconds`}
                        {phase === 'recording' && <><span style={{ color: 'var(--state-danger)' }}>●</span> {formatClock(elapsed)} / {formatClock(MAX_VIDEO_NOTE_SECONDS)}</>}
                        {phase === 'preview' && `Preview · ${formatClock(elapsed)}`}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {phase === 'ready' && btn('Record', Circle, record, { color: 'var(--state-danger)', testId: 'video-note-record' })}
                    {phase === 'recording' && btn('Stop', Square, stop, { color: 'var(--state-danger)', testId: 'video-note-stop' })}
                    {phase === 'preview' && btn('Send', Send, send, { primary: true, testId: 'video-note-send' })}
                    {phase === 'preview' && btn('Retake', RotateCw, retake)}
                    {phase === 'error' && btn('Try again', RotateCw, openCamera)}
                    {btn(phase === 'preview' || phase === 'recording' ? 'Discard' : 'Cancel', phase === 'preview' || phase === 'recording' ? Trash2 : X, cancel, { testId: 'video-note-cancel' })}
                </div>
            </div>
        </div>
    );
}
