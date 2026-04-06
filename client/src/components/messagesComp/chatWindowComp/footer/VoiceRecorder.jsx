// VoiceRecorder — Monolith Flow Design System
import React, { useState, useRef, useCallback, useEffect } from 'react';
import api from '@services/api';
import { Mic, Square, Send, Trash2, X, Loader2 } from 'lucide-react';

export default function VoiceRecorder({ onSend, onCancel }) {
  const [phase, setPhase] = useState('idle'); // idle | recording | preview | uploading
  const [seconds, setSeconds] = useState(0);
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const blobRef          = useRef(null);
  const timerRef         = useRef(null);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/ogg;codecs=opus';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        setBlobUrl(URL.createObjectURL(blob));
        setPhase('preview');
      };
      recorder.start(200);
      setPhase('recording');
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds(s => { if (s >= 300) { stopRecording(); return s; } return s + 1; });
      }, 1000);
    } catch {
      setError('Microphone access denied. Please allow mic permissions and try again.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }, []);

  const handleSend = useCallback(async () => {
    if (!blobRef.current) return;
    setPhase('uploading');
    try {
      const formData = new FormData();
      const ext = blobRef.current.type.includes('ogg') ? 'ogg' : 'webm';
      formData.append('file', blobRef.current, `voice-message.${ext}`);
      formData.append('category', 'voice');
      const res = await api.post('/api/v2/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const file = res.data?.file || res.data;
      onSend({ type: 'voice', url: file.url || file.publicUrl, name: file.name || 'voice-message', mimeType: blobRef.current.type, duration: seconds, size: blobRef.current.size });
    } catch {
      setError('Upload failed. Please try again.');
      setPhase('preview');
    }
  }, [seconds, onSend]);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const iconBtn = (title, Icon, onClick, colorVar = 'var(--text-secondary)', dangerHover = false) => (
    <button
      onClick={onClick}
      title={title}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '2px', background: 'none', border: 'none', outline: 'none', cursor: 'pointer', color: colorVar, transition: '150ms ease' }}
      onMouseEnter={e => e.currentTarget.style.color = dangerHover ? 'var(--state-danger)' : 'var(--text-primary)'}
      onMouseLeave={e => e.currentTarget.style.color = colorVar}
    >
      <Icon size={15} />
    </button>
  );

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      backgroundColor: 'var(--bg-active)', borderRadius: '2px',
      padding: '6px 10px', border: '1px solid var(--border-default)',
      fontFamily: 'var(--font)', minWidth: 0,
    }}>

      {phase === 'idle' && (
        <>
          {iconBtn('Start recording', Mic, startRecording, 'var(--accent)')}
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1 }}>Click to record a voice message</span>
          {iconBtn('Cancel', X, onCancel, 'var(--text-muted)', true)}
        </>
      )}

      {phase === 'recording' && (
        <>
          <span style={{ color: 'var(--state-danger)', fontSize: '14px', lineHeight: 1, animation: 'pulse 1s ease-in-out infinite' }}>●</span>
          <span style={{ fontSize: '13px', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', minWidth: '40px', fontWeight: 500 }}>
            {fmt(seconds)}
          </span>
          {/* Waveform */}
          <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flex: 1 }}>
            {[3, 6, 9, 7, 4, 8, 5, 6, 3].map((h, i) => (
              <div key={i} style={{
                width: '3px', height: `${h}px`, backgroundColor: 'var(--accent)', borderRadius: '1px',
                animation: `wave ${0.4 + i * 0.07}s ease-in-out infinite alternate`,
              }} />
            ))}
          </div>
          {iconBtn('Stop recording', Square, stopRecording, 'var(--state-danger)')}
        </>
      )}

      {phase === 'preview' && blobUrl && (
        <>
          <audio src={blobUrl} controls style={{ height: '28px', flex: 1, minWidth: 0 }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(seconds)}</span>
          {iconBtn('Send voice message', Send, handleSend, 'var(--accent)')}
          {iconBtn('Discard', Trash2, () => { setPhase('idle'); setBlobUrl(null); setSeconds(0); }, 'var(--text-muted)', true)}
        </>
      )}

      {phase === 'uploading' && (
        <>
          <Loader2 size={14} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Uploading…</span>
        </>
      )}

      {error && <span style={{ fontSize: '11px', color: 'var(--state-danger)' }}>{error}</span>}
    </div>
  );
}
