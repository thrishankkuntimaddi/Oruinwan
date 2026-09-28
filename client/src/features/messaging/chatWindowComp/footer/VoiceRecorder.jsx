import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Send, Trash2, X, RotateCw } from 'lucide-react';
import { pickRecordingMimeType, extensionForMime, baseMime, describeMediaError, formatClock, canRecord } from '../../../../utils/mediaRecording';

export const MAX_VOICE_SECONDS = 5 * 60;
const BARS = 18;

/**
 * Records a voice note. Opens straight into recording (the click that opened it is the
 * permission gesture), shows the time and a live input level, stops by itself at 5:00,
 * then lets you listen back before sending. onRecorded({ file, duration, mimeType })
 * hands the recording to the composer's upload list.
 */
export default function VoiceRecorder({ onRecorded, onCancel }) {
  const [phase, setPhase] = useState('starting'); // starting | recording | preview | error
  const [elapsed, setElapsed] = useState(0);
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(null);
  const [levels, setLevels] = useState(() => Array(BARS).fill(0.1));

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const resultRef = useRef(null); // { blob, duration, mimeType }
  const startedAtRef = useRef(0);
  const stoppedAtRef = useRef(0); // when Stop was pressed (onstop can fire a little later)
  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const audioCtxRef = useRef(null);
  const discardRef = useRef(false);
  const genRef = useRef(0); // bumps on close so a late getUserMedia result is dropped

  const releaseDevices = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (!stoppedAtRef.current) stoppedAtRef.current = performance.now();
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch { /* already stopped */ }
    }
    clearInterval(timerRef.current);
  }, []);

  const start = useCallback(async () => {
    const gen = ++genRef.current;
    setError(null);
    setPhase('starting');
    chunksRef.current = [];
    discardRef.current = false;
    if (!canRecord()) {
      setError('Recording isn’t supported in this browser.');
      setPhase('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (gen !== genRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      const mimeType = pickRecordingMimeType('audio');
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const duration = Math.max(1, Math.round(((stoppedAtRef.current || performance.now()) - startedAtRef.current) / 1000));
        releaseDevices();
        if (discardRef.current) return;
        const type = rec.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        resultRef.current = { blob, duration: Math.min(duration, MAX_VOICE_SECONDS), mimeType: type };
        setBlobUrl(URL.createObjectURL(blob));
        setElapsed(Math.min(duration, MAX_VOICE_SECONDS));
        setPhase('preview');
      };

      // Live input level for the bars.
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          audioCtxRef.current = ctx;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          ctx.createMediaStreamSource(stream).connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          let last = 0;
          const tick = (now = 0) => {
            // ~12 updates a second is enough for the meter and keeps re-renders cheap.
            if (now - last > 80) {
              last = now;
              analyser.getByteFrequencyData(data);
              setLevels(Array.from({ length: BARS }, (_, i) => Math.max(0.1, (data[i + 1] || 0) / 255)));
            }
            rafRef.current = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch { /* level meter is optional */ }

      rec.start(250);
      startedAtRef.current = performance.now();
      stoppedAtRef.current = 0;
      setElapsed(0);
      setPhase('recording');
      timerRef.current = setInterval(() => {
        const s = Math.floor((performance.now() - startedAtRef.current) / 1000);
        setElapsed(s);
        if (s >= MAX_VOICE_SECONDS) stop();
      }, 250);
    } catch (err) {
      if (gen !== genRef.current) return;
      releaseDevices();
      setError(describeMediaError(err, 'microphone'));
      setPhase('error');
    }
  }, [releaseDevices, stop]);

  // Start recording as soon as the recorder opens; release the mic when it closes.
  useEffect(() => {
    start();
    return () => {
      genRef.current += 1;
      discardRef.current = true;
      stop();
      releaseDevices();
    };
  }, [start, stop, releaseDevices]);

  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  const cancel = () => {
    genRef.current += 1;
    discardRef.current = true;
    stop();
    releaseDevices();
    onCancel?.();
  };

  const send = () => {
    const r = resultRef.current;
    if (!r) return;
    const type = baseMime(r.mimeType);
    const file = new File([r.blob], `voice-note-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${extensionForMime(type)}`, { type });
    onRecorded?.({ file, duration: r.duration, mimeType: type });
  };

  const redo = () => {
    setBlobUrl(null);
    resultRef.current = null;
    start();
  };

  const iconBtn = (title, Icon, onClick, color = 'var(--text-secondary)', testId) => (
    <button type="button" onClick={onClick} title={title} aria-label={title} data-testid={testId}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 2, background: 'none', border: 'none', cursor: 'pointer', color, flexShrink: 0 }}>
      <Icon size={15} />
    </button>
  );

  return (
    <div data-testid="voice-recorder" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      backgroundColor: 'var(--bg-active)', borderRadius: 2,
      padding: '6px 10px', border: '1px solid var(--border-default)',
      fontFamily: 'var(--font)', minWidth: 0, width: '100%',
    }}>
      {phase === 'starting' && (
        <>
          <Mic size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>Starting microphone…</span>
          {iconBtn('Cancel', X, cancel, 'var(--text-muted)')}
        </>
      )}

      {phase === 'recording' && (
        <>
          <span aria-hidden style={{ color: 'var(--state-danger)', fontSize: 12, animation: 'pulse 1s ease-in-out infinite' }}>●</span>
          <span data-testid="voice-timer" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {formatClock(elapsed)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {formatClock(MAX_VOICE_SECONDS)}</span>
          </span>
          <div aria-hidden style={{ display: 'flex', gap: 2, alignItems: 'center', flex: 1, height: 22, minWidth: 40, overflow: 'hidden' }}>
            {levels.map((l, i) => (
              <div key={i} style={{ width: 3, height: `${Math.round(4 + l * 18)}px`, backgroundColor: 'var(--accent)', borderRadius: 1, transition: 'height 80ms linear' }} />
            ))}
          </div>
          {iconBtn('Discard recording', Trash2, cancel, 'var(--text-muted)', 'voice-discard')}
          {iconBtn('Stop recording', Square, stop, 'var(--state-danger)', 'voice-stop')}
        </>
      )}

      {phase === 'preview' && blobUrl && (
        <>
          <audio src={blobUrl} controls preload="metadata" style={{ height: 30, flex: 1, minWidth: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatClock(elapsed)}</span>
          {iconBtn('Record again', RotateCw, redo, 'var(--text-muted)')}
          {iconBtn('Discard', Trash2, cancel, 'var(--text-muted)', 'voice-discard')}
          {iconBtn('Send voice note', Send, send, 'var(--accent)', 'voice-send')}
        </>
      )}

      {phase === 'error' && (
        <>
          <Mic size={15} style={{ color: 'var(--state-danger)', flexShrink: 0 }} />
          <span role="alert" style={{ fontSize: 12, color: 'var(--state-danger)', flex: 1 }}>{error}</span>
          {iconBtn('Try again', RotateCw, start, 'var(--text-secondary)')}
          {iconBtn('Close', X, cancel, 'var(--text-muted)')}
        </>
      )}
    </div>
  );
}
