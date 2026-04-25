import React, { useState, useRef, useCallback, useEffect } from 'react';

import api from '@services/api';

const API = import.meta.env.VITE_API_URL || '';

export default function VoiceRecorder({ onSend, onCancel }) {
  const [phase, setPhase] = useState('idle'); 
  const [seconds, setSeconds] = useState(0);
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError]     = useState(null);

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
        setSeconds(s => {
          if (s >= 300) { stopRecording(); return s; } 
          return s + 1;
        });
      }, 1000);
    } catch (err) {
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

      const res = await api.post('/api/v2/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const file = res.data?.file || res.data;
      onSend({
        type:     'voice',
        url:      file.url || file.publicUrl,
        name:     file.name || 'voice-message',
        mimeType: blobRef.current.type,
        duration: seconds,
        size:     blobRef.current.size,
      });
    } catch (err) {
      setError('Upload failed. Please try again.');
      setPhase('preview');
    }
  }, [seconds, onSend]);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: '#2b2d31', borderRadius: 8, padding: '8px 12px',
      border: '1px solid #3a3d42', fontFamily: 'Inter, sans-serif',
    }}>
      {phase === 'idle' && (
        <>
          <button onClick={startRecording} style={iconBtn('#5865f2')} title="Start recording">
            🎙️
          </button>
          <span style={{ color: '#a0a5b0', fontSize: 13 }}>Click to record a voice message</span>
          <button onClick={onCancel} style={iconBtn('#6b7280')} title="Cancel">✕</button>
        </>
      )}

      {phase === 'recording' && (
        <>
          <span style={{ color: '#f04747', fontSize: 18, animation: 'pulse 1s infinite' }}>🔴</span>
          <span style={{ color: '#fff', fontVariantNumeric: 'tabular-nums', minWidth: 42, fontSize: 14 }}>
            {fmt(seconds)}
          </span>
          {}
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {[3, 6, 9, 7, 4, 8, 5, 6, 3].map((h, i) => (
              <div key={i} style={{
                width: 3, height: h + 'px', background: '#5865f2', borderRadius: 2,
                animation: `wave ${0.4 + i * 0.07}s ease-in-out infinite alternate`,
              }} />
            ))}
          </div>
          <button onClick={stopRecording} style={iconBtn('#ed4245')} title="Stop">⏹</button>
        </>
      )}

      {phase === 'preview' && blobUrl && (
        <>
          <audio src={blobUrl} controls style={{ height: 32, flex: 1 }} />
          <button onClick={handleSend} style={iconBtn('#43b581')} title="Send">Send ➤</button>
          <button onClick={() => { setPhase('idle'); setBlobUrl(null); setSeconds(0); }} style={iconBtn('#ed4245')} title="Discard">
            🗑
          </button>
        </>
      )}

      {phase === 'uploading' && (
        <span style={{ color: '#a0a5b0', fontSize: 13 }}>Uploading…</span>
      )}

      {error && <span style={{ color: '#ed4245', fontSize: 12 }}>{error}</span>}
    </div>
  );
}

function iconBtn(color) {
  return {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 16, color, padding: '2px 6px', borderRadius: 4,
    fontFamily: 'inherit',
  };
}
