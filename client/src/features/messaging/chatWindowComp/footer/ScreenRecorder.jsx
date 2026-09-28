import React, { useState, useRef, useEffect } from "react";
import { Monitor, Square, Send, Trash2 } from "lucide-react";
import logger from '../../../../utils/logger';
import { pickRecordingMimeType, extensionForMime, baseMime } from '../../../../utils/mediaRecording';

/**
 * Records the screen (or a window/tab) with getDisplayMedia, then lets you send it.
 * onRecorded({ file, duration, mimeType, variant }) hands it to the composer's upload list.
 */
export default function ScreenRecorder({ onRecorded, disabled = false }) {
    const [state, setState] = useState("idle"); 
    const [duration, setDuration] = useState(0);
    const [videoUrl, setVideoUrl] = useState(null);
    const mimeRef = useRef('');
    const startedAtRef = useRef(0);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const blobRef = useRef(null);
    const timerRef = useRef(null);
    const streamRef = useRef(null);
    const unmountedRef = useRef(false);

    // Revoke the preview object URL whenever it is replaced/cleared or on unmount.
    useEffect(() => {
        if (!videoUrl) return undefined;
        return () => URL.revokeObjectURL(videoUrl);
    }, [videoUrl]);

    // Unmount: stop the timer, the recorder and all capture tracks.
    useEffect(() => {
        unmountedRef.current = false;
        return () => {
            unmountedRef.current = true;
            clearInterval(timerRef.current);
            const mr = mediaRecorderRef.current;
            if (mr && mr.state === "recording") {
                try { mr.stop(); } catch { /* already stopped */ }
            }
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        };
    }, []);

    const startRecording = async () => {
        if (disabled) return;
        try {
            
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: "screen" },
                audio: true,
            });

            if (unmountedRef.current) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }
            streamRef.current = stream;
            const mime = pickRecordingMimeType('video');
            const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
            mimeRef.current = mr.mimeType || mime || 'video/webm';
            mediaRecorderRef.current = mr;
            chunksRef.current = [];

            mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            mr.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                if (streamRef.current === stream) streamRef.current = null;
                if (unmountedRef.current) return;
                const blob = new Blob(chunksRef.current, { type: mimeRef.current });
                setDuration(Math.max(1, Math.round((performance.now() - startedAtRef.current) / 1000)));
                blobRef.current = blob;
                setVideoUrl(URL.createObjectURL(blob));
                setState("preview");
            };

            
            stream.getVideoTracks()[0].addEventListener("ended", () => {
                if (mr.state === "recording") mr.stop();
                clearInterval(timerRef.current);
            });

            mr.start(1000);
            startedAtRef.current = performance.now();
            setState("recording");
            setDuration(0);
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        } catch (err) {
            if (err.name !== "NotAllowedError") logger.error("Screen record error:", err);
            setState("idle");
        }
    };

    const stopRecording = () => {
        clearInterval(timerRef.current);
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
    };

    const discard = () => {
        setVideoUrl(null);
        blobRef.current = null;
        setDuration(0);
        setState("idle");
    };

    const send = () => {
        if (!blobRef.current) return;
        const type = baseMime(mimeRef.current) || 'video/webm';
        const file = new File([blobRef.current], `screen-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${extensionForMime(type)}`, { type });
        onRecorded?.({ file, duration, mimeType: type, variant: 'screen_recording' });
        discard();
    };

    const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

    if (state === "preview") {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'rgba(184,149,106,0.06)', border: '1px solid rgba(184,149,106,0.15)' }}>
                <video src={videoUrl} style={{ height: '36px', width: '64px', objectFit: 'cover', border: '1px solid var(--border-default)' }} muted />
                <span style={{ fontSize: '11px', color: '#b8956a', fontFamily: 'monospace' }}>{fmt(duration)}</span>
                <button onClick={discard} title="Discard"
                    style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: '150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.4)'}
                >
                    <Trash2 size={14} />
                </button>
                <button onClick={send} title="Send screen recording" aria-label="Send screen recording"
                    style={{ padding: '5px 10px', background: 'var(--accent)', border: 'none', color: '#0c0c0c', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: '150ms ease' }}
                >
                    <Send size={13} />
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={state === "idle" ? startRecording : stopRecording}
            disabled={disabled}
            title={state === "recording"
                ? `Recording screen ${fmt(duration)} — click to stop`
                : "Record screen"}
            style={{
                padding: '5px',
                borderRadius: '2px',
                background: state === "recording" ? 'rgba(239,68,68,0.15)' : 'none',
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: state === "recording" ? '#f87171' : 'var(--text-muted)',
                transition: 'color 150ms ease',
                opacity: disabled ? 0.4 : 1,
            }}
            onMouseEnter={e => { if (state === 'idle' && !disabled) e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { if (state === 'idle') e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
            {state === "recording" ? <Square size={16} /> : <Monitor size={16} />}
        </button>
    );
}
