/**
 * VoiceRecorder.jsx — Phase 7.2 Voice Notes
 *
 * Full-screen recording overlay using MediaRecorder API.
 *
 * Props:
 *   onSendAttachment  ({ url, name, size, sizeFormatted, mimeType, type:'voice', duration }) => void
 *   conversationId    string
 *   conversationType  'channel' | 'dm'
 *   onClose           () => void
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, Square, Send, Trash2, Loader2 } from 'lucide-react';
import api from '@services/api';

// Format seconds → mm:ss
function fmt(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
}

// Pick the best supported audio MIME type
function pickMime() {
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
    ];
    return candidates.find(m => MediaRecorder.isTypeSupported(m)) || '';
}

export default function VoiceRecorder({ onSendAttachment, conversationId, conversationType, onClose }) {
    const [phase, setPhase] = useState('idle');   // idle | recording | stopped | uploading
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState(null);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);     // object URL for preview

    const mediaRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const mimeRef = useRef('');
    const startTimeRef = useRef(null);
    // streamRef: holds the raw MediaStream so we can ALWAYS stop mic tracks,
    // even if mediaRef was never assigned (guards against async race conditions).
    const streamRef = useRef(null);
    // cancelledRef: set to true in cleanup so stale onstop callbacks don't corrupt state.
    const cancelledRef = useRef(false);

    // Auto-start recording on mount
    useEffect(() => {
        cancelledRef.current = false;
        startRecording();

        return () => {
            cancelledRef.current = true;
            cleanup();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cleanup = () => {
        clearInterval(timerRef.current);
        timerRef.current = null;

        // Stop the MediaRecorder first
        if (mediaRef.current?.state === 'recording') {
            mediaRef.current.stop();
        }
        mediaRef.current = null;

        // Always release the raw mic stream — this turns off the browser mic indicator.
        // Using streamRef (not mediaRef.stream) ensures the mic is released even if
        // mediaRef was never set (async race) or already nulled.
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    };

    const startRecording = async () => {
        setError(null);
        setElapsed(0);
        chunksRef.current = [];

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Store stream ref IMMEDIATELY — before any cancelledRef check —
            // so cleanup() can always release the mic even if we bail out.
            streamRef.current = stream;

            // Bail out if this effect was already cleaned up (Strict Mode unmount fired)
            if (cancelledRef.current) {
                stream.getTracks().forEach(t => t.stop());
                streamRef.current = null;
                return;
            }

            mimeRef.current = pickMime();
            const mr = new MediaRecorder(stream, mimeRef.current ? { mimeType: mimeRef.current } : undefined);
            mediaRef.current = mr;

            mr.ondataavailable = e => {
                if (e.data?.size > 0) chunksRef.current.push(e.data);
            };

            mr.onstop = () => {
                // Ignore if this recorder was stopped by cleanup (Strict Mode remount)
                if (cancelledRef.current) return;

                const blob = new Blob(chunksRef.current, { type: mimeRef.current || 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                setPhase('stopped');
            };

            mr.start(250); // collect chunks every 250ms
            setPhase('recording');

            // Wall-clock based timer — immune to multiple intervals being active
            startTimeRef.current = Date.now();
            clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                if (!cancelledRef.current) {
                    setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
                }
            }, 500);

        } catch (err) {
            if (!cancelledRef.current) {
                setError('Microphone access denied. Please allow microphone permissions.');
                setPhase('idle');
            }
        }
    };

    const stopRecording = useCallback(() => {
        clearInterval(timerRef.current);
        timerRef.current = null;
        if (mediaRef.current?.state === 'recording') {
            mediaRef.current.stop();
        }
        // Stop mic tracks via streamRef for guaranteed release
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    }, []);

    const discard = useCallback(() => {
        cancelledRef.current = true;
        cleanup();
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        onClose();
    }, [audioUrl, onClose]);

    const sendVoice = useCallback(async () => {
        if (!audioBlob) return;
        setPhase('uploading');

        // ── Release mic IMMEDIATELY — don't wait for upload + unmount ──
        // The user hit Send; they no longer need the mic. Stopping here
        // turns off the browser's mic indicator right away.
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        try {
            const ext = mimeRef.current.includes('ogg') ? 'ogg' : mimeRef.current.includes('mp4') ? 'mp4' : 'webm';
            const file = new File([audioBlob], `voice-note-${Date.now()}.${ext}`, { type: audioBlob.type });

            const form = new FormData();
            form.append('file', file);
            form.append('conversationType', conversationType || 'channel');
            if (conversationId) form.append('conversationId', conversationId);

            const { data: attachment } = await api.post('/api/v2/uploads', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            // Attach duration from elapsed (backend doesn't measure it)
            attachment.duration = elapsed;
            attachment.type = 'voice'; // ensure type is voice even if backend says audio

            if (audioUrl) URL.revokeObjectURL(audioUrl);
            onSendAttachment(attachment);
            onClose();
        } catch (err) {
            console.error('[VoiceRecorder] upload error:', err);
            setError('Upload failed — please try again.');
            setPhase('stopped');
        }
    }, [audioBlob, audioUrl, conversationId, conversationType, elapsed, onClose, onSendAttachment]);

    return (
        <div
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end justify-center pb-6 animate-fade-in"
            onClick={e => { if (e.target === e.currentTarget) discard(); }}
        >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col items-center gap-5">

                {/* ── Recording phase ── */}
                {phase === 'recording' && (
                    <>
                        {/* Animated mic ring */}
                        <div className="relative flex items-center justify-center">
                            <span className="absolute w-20 h-20 rounded-full bg-red-400/30 animate-ping" />
                            <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                                <Mic size={28} className="text-white" />
                            </div>
                        </div>

                        <div className="text-2xl font-mono font-bold text-gray-800 dark:text-gray-100 tracking-widest">
                            {fmt(elapsed)}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Recording… tap stop when done</p>

                        <div className="flex items-center gap-4 w-full">
                            <button
                                onClick={discard}
                                className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 size={15} /> Discard
                            </button>
                            <button
                                onClick={stopRecording}
                                className="flex-1 py-2.5 text-sm font-medium rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Square size={15} /> Stop
                            </button>
                        </div>
                    </>
                )}

                {/* ── Preview / send phase ── */}
                {phase === 'stopped' && (
                    <>
                        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <Mic size={22} className="text-green-600 dark:text-green-400" />
                        </div>

                        <div className="text-xl font-mono font-semibold text-gray-800 dark:text-gray-100">
                            {fmt(elapsed)}
                        </div>

                        {/* Inline audio preview */}
                        {audioUrl && (
                            <audio
                                src={audioUrl}
                                controls
                                className="w-full rounded-lg h-9"
                                style={{ accentColor: '#3b82f6' }}
                            />
                        )}

                        {error && <p className="text-xs text-red-500">{error}</p>}

                        <div className="flex items-center gap-4 w-full">
                            <button
                                onClick={discard}
                                className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 size={15} /> Discard
                            </button>
                            <button
                                onClick={sendVoice}
                                className="flex-1 py-2.5 text-sm font-medium rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Send size={15} /> Send
                            </button>
                        </div>
                    </>
                )}

                {/* ── Uploading phase ── */}
                {phase === 'uploading' && (
                    <>
                        <Loader2 size={36} className="text-blue-500 animate-spin" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">Uploading voice note…</p>
                    </>
                )}

                {/* ── Error / idle ── */}
                {phase === 'idle' && error && (
                    <>
                        <p className="text-sm text-red-500 text-center">{error}</p>
                        <button
                            onClick={onClose}
                            className="py-2 px-6 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
                        >
                            Close
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
