import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, Mic } from "lucide-react";
import { toProxyUrl } from "../../../../../utils/gcsProxy";

function formatDuration(seconds) {
    if (!seconds || !isFinite(seconds) || isNaN(seconds)) return '--:--';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

export default function VoiceMessage({ msg }) {
    const attachment = msg.attachment || {};
    const { sizeFormatted, duration: storedDuration } = attachment;
    const proxyUrl = toProxyUrl(attachment);
    const audioRef = useRef(null);
    const [playing, setPlaying]   = useState(false);
    const [current, setCurrent]   = useState(0);
    const [duration, setDuration] = useState(storedDuration || 0);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onMeta = () => {
            const d = audio.duration;
            setDuration(isFinite(d) && d > 0 ? d : storedDuration || 0);
        };
        const onTime = () => {
            setCurrent(audio.currentTime);
            const totalDur = isFinite(audio.duration) && audio.duration > 0
                ? audio.duration : storedDuration || 0;
            setProgress(totalDur ? (audio.currentTime / totalDur) * 100 : 0);
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

    if (!proxyUrl) return null;

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
        <div style={{
            marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 12px',
            backgroundColor: 'var(--bg-active)',
            border: '1px solid var(--border-default)',
            borderRadius: '2px',
            maxWidth: '260px',
        }}>
            <audio ref={audioRef} src={proxyUrl} preload="metadata" />

            {}
            <button
                onClick={toggle}
                style={{
                    flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: playing ? 'var(--accent-hover)' : 'var(--accent)',
                    border: 'none', outline: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: '100ms ease',
                }}
            >
                {playing
                    ? <Pause size={13} style={{ color: '#0c0c0c' }} />
                    : <Play  size={13} style={{ color: '#0c0c0c', marginLeft: '1px' }} />
                }
            </button>

            {}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{ height: '3px', backgroundColor: 'var(--border-accent)', borderRadius: '99px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                    onClick={seek}
                >
                    <div
                        style={{ position: 'absolute', inset: '0 auto 0 0', backgroundColor: 'var(--accent)', borderRadius: '99px', width: `${progress}%`, transition: 'width 100ms linear' }}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{formatDuration(current)}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)',     fontFamily: 'monospace' }}>{duration ? formatDuration(duration) : '—'}</span>
                </div>
            </div>

            {}
            <div style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
                <Mic size={13} />
            </div>
        </div>
    );
}
