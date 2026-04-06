// Phase 2 — Screen Recorder Component
// Uses browser getDisplayMedia + MediaRecorder to capture screen, then upload as video

import React, { useState, useRef } from "react";
import { Monitor, Square, Send, Trash2 } from "lucide-react";
import api from '@services/api';

/**
 * @param {function} props.onSend - Called with { type:'video', url, name, size, mimeType, duration }
 */
export default function ScreenRecorder({ onSend, disabled = false }) {
    const [state, setState] = useState("idle"); // idle | recording | preview
    const [duration, setDuration] = useState(0);
    const [videoUrl, setVideoUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const blobRef = useRef(null);
    const timerRef = useRef(null);

    const startRecording = async () => {
        if (disabled) return;
        try {
            // Request screen share
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: "screen" },
                audio: true,
            });

            const mr = new MediaRecorder(stream, { mimeType: "video/webm" });
            mediaRecorderRef.current = mr;
            chunksRef.current = [];

            mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            mr.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "video/webm" });
                blobRef.current = blob;
                setVideoUrl(URL.createObjectURL(blob));
                setState("preview");
                stream.getTracks().forEach(t => t.stop());
            };

            // Stop when user closes the browser share picker
            stream.getVideoTracks()[0].addEventListener("ended", () => {
                if (mr.state === "recording") mr.stop();
                clearInterval(timerRef.current);
            });

            mr.start();
            setState("recording");
            setDuration(0);
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        } catch (err) {
            if (err.name !== "NotAllowedError") console.error("Screen record error:", err);
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

    const send = async () => {
        if (!blobRef.current || uploading) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", blobRef.current, `screen_${Date.now()}.webm`);
            const res = await api.post("/api/v2/uploads", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            const { url, name, size, mimeType } = res.data;
            onSend?.({
                type: "video",
                url,
                name: name || "Screen recording",
                size,
                mimeType: mimeType || "video/webm",
                duration
            });
            discard();
        } catch (err) {
            console.error("Screen recording upload failed:", err);
        } finally {
            setUploading(false);
        }
    };

    const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

    if (state === "preview") {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'rgba(184,149,106,0.06)', border: '1px solid rgba(184,149,106,0.15)' }}>
                <video src={videoUrl} style={{ height: '36px', width: '64px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.08)' }} muted />
                <span style={{ fontSize: '11px', color: '#b8956a', fontFamily: 'monospace' }}>{fmt(duration)}</span>
                <button onClick={discard} title="Discard"
                    style={{ padding: '4px', background: 'none', border: 'none', color: 'rgba(228,228,228,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: '150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.4)'}
                >
                    <Trash2 size={14} />
                </button>
                <button onClick={send} disabled={uploading} title="Send screen recording"
                    style={{ padding: '5px 10px', background: '#b8956a', border: 'none', color: '#0c0c0c', cursor: uploading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', transition: '150ms ease', opacity: uploading ? 0.6 : 1 }}
                >
                    {uploading
                        ? <span style={{ width: '13px', height: '13px', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#0c0c0c', borderRadius: '50%', display: 'block', animation: 'spin 1s linear infinite' }} />
                        : <Send size={13} />}
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
