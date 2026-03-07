/**
 * VoiceMessage.jsx — Phase 7.1 Attachments (also used in Phase 7.2 voice notes)
 * Renders a play/pause audio player with elapsed-time display.
 */
import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, Mic } from "lucide-react";

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

export default function VoiceMessage({ msg }) {
    const { url, sizeFormatted, duration: storedDuration } = msg.attachment || {};
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    // Phase 7.2: seed total from attachment.duration (set by recorder) so it shows before loadedmetadata
    const [duration, setDuration] = useState(storedDuration || 0);
    const [progress, setProgress] = useState(0);


    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onMeta = () => setDuration(audio.duration || 0);
        const onTime = () => {
            setCurrent(audio.currentTime);
            setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
        };
        const onEnd = () => { setPlaying(false); setCurrent(0); setProgress(0); };
        audio.addEventListener('loadedmetadata', onMeta);
        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('ended', onEnd);
        return () => {
            audio.removeEventListener('loadedmetadata', onMeta);
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('ended', onEnd);
        };
    }, []);

    if (!url) return null;

    const toggle = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (playing) { audio.pause(); } else { audio.play(); }
        setPlaying(!playing);
    };

    const seek = (e) => {
        const audio = audioRef.current;
        if (!audio || !audio.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        audio.currentTime = pct * audio.duration;
    };

    return (
        <div className="mt-1 flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl max-w-xs">
            <audio ref={audioRef} src={url} preload="metadata" />

            {/* Play/Pause */}
            <button
                onClick={toggle}
                className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
            >
                {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
            </button>

            {/* Waveform / Progress */}
            <div className="flex-1 min-w-0">
                <div
                    className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer relative overflow-hidden"
                    onClick={seek}
                >
                    <div
                        className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                        {formatDuration(current)}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                        {duration ? formatDuration(duration) : '—'}
                    </span>
                </div>
            </div>

            {/* Mic icon badge */}
            <div className="flex-shrink-0 text-gray-400 dark:text-gray-500">
                <Mic size={14} />
            </div>
        </div>
    );
}
