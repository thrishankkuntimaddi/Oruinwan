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
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
                <video src={videoUrl} className="h-10 rounded w-24 object-cover border border-blue-200" muted />
                <span className="text-xs text-blue-600 font-mono">{fmt(duration)}</span>
                <button onClick={discard} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="Discard">
                    <Trash2 size={15} />
                </button>
                <button
                    onClick={send}
                    disabled={uploading}
                    className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white disabled:opacity-50 transition-colors"
                    title="Send screen recording"
                >
                    {uploading
                        ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin block" />
                        : <Send size={15} />}
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
            className={`p-2 rounded-xl transition-all ${state === "recording"
                ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-300 animate-pulse"
                : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                } disabled:opacity-40`}
        >
            {state === "recording" ? <Square size={18} /> : <Monitor size={18} />}
        </button>
    );
}
