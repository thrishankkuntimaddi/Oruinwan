// client/src/components/messagesComp/chatWindowComp/ScreenRecorder.jsx
// Phase-8: Screen recording capture and upload
import React, { useState, useRef, useCallback, useEffect } from 'react';
// refactor(consistency): use canonical api.js (handles auth tokens + 401 refresh; FormData uploads still work)
import api from '@services/api';

const API = import.meta.env.VITE_API_URL || '';

/**
 * ScreenRecorder
 * Props:
 *  onSend(attachmentObj) — { type: 'screen_recording', url, name, mimeType, size }
 *  onCancel()
 */
export default function ScreenRecorder({ onSend, onCancel }) {
  const [phase, setPhase]   = useState('idle'); // idle | recording | preview | uploading
  const [seconds, setSeconds] = useState(0);
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError]   = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const blobRef          = useRef(null);
  const timerRef         = useRef(null);
  const videoRef         = useRef(null);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: true,
      });

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setPhase('preview');
      };

      // Auto-stop if user stops sharing from browser UI
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (recorder.state !== 'inactive') recorder.stop();
        clearInterval(timerRef.current);
      });

      recorder.start(500);
      setPhase('recording');
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        setError('Screen capture failed: ' + err.message);
      }
      // User cancelled screen picker — silently return to idle
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
      formData.append('file', blobRef.current, `screen-recording-${Date.now()}.webm`);
      formData.append('category', 'video');

      const res = await api.post('/api/v2/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const file = res.data?.file || res.data;
      onSend({
        type:     'screen_recording',
        url:      file.url || file.publicUrl,
        name:     file.name || 'screen-recording.webm',
        mimeType: 'video/webm',
        size:     blobRef.current.size,
      });
    } catch {
      setError('Upload failed. Please try again.');
      setPhase('preview');
    }
  }, [onSend]);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const container = {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#2b2d31', borderRadius: 8, padding: '8px 12px',
    border: '1px solid #3a3d42', fontFamily: 'Inter, sans-serif',
  };

  return (
    <div style={container}>
      {phase === 'idle' && (
        <>
          <button onClick={startRecording} style={iconBtn('#5865f2')} title="Start screen recording">🖥️</button>
          <span style={{ color: '#a0a5b0', fontSize: 13 }}>Share your screen to record</span>
          <button onClick={onCancel} style={iconBtn('#6b7280')}>✕</button>
        </>
      )}

      {phase === 'recording' && (
        <>
          <span style={{ color: '#f04747' }}>🔴</span>
          <span style={{ color: '#fff', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{fmt(seconds)}</span>
          <span style={{ color: '#a0a5b0', fontSize: 12 }}>Recording screen…</span>
          <button onClick={stopRecording} style={iconBtn('#ed4245')}>⏹ Stop</button>
        </>
      )}

      {phase === 'preview' && blobUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <video ref={videoRef} src={blobUrl} controls style={{ maxHeight: 200, borderRadius: 6, background: '#000' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSend} style={iconBtn('#43b581')}>Send ➤</button>
            <button onClick={() => { setPhase('idle'); setBlobUrl(null); setSeconds(0); }} style={iconBtn('#ed4245')}>🗑 Discard</button>
          </div>
        </div>
      )}

      {phase === 'uploading' && <span style={{ color: '#a0a5b0', fontSize: 13 }}>Uploading recording…</span>}
      {error && <span style={{ color: '#ed4245', fontSize: 12 }}>{error}</span>}
    </div>
  );
}

function iconBtn(color) {
  return {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, color, padding: '3px 8px', borderRadius: 4,
    fontFamily: 'inherit', whiteSpace: 'nowrap',
  };
}
