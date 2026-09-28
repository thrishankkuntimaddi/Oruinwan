import React, { useRef, useState, useEffect, useMemo } from "react";
import { Play, Pause, Mic, Loader2 } from "lucide-react";
import { toProxyUrl } from "../../../../../utils/gcsProxy";
import { useMediaUrl } from "../../../../../utils/mediaUrl";

const SPEEDS = [1, 1.5, 2];
const BARS = 32;
// Only one voice note plays at a time.
const PLAY_EVENT = 'oruinwan:voice-play';

function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const n = Math.floor(seconds);
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

/** A stable, pleasant-looking bar pattern per file (the audio itself isn't analysed). */
function barPattern(seed = '') {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Array.from({ length: BARS }, (_, i) => {
        h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
        const r = ((h >>> 0) % 1000) / 1000;
        const envelope = 0.55 + 0.45 * Math.sin((i / BARS) * Math.PI);
        return Math.max(0.18, Math.min(1, (0.35 + r * 0.65) * envelope));
    });
}

export default function VoiceMessage({ msg }) {
    const attachment = msg.attachment || {};
    const storedDuration = Number(attachment.duration) || 0;
    const hasFile = !!toProxyUrl(attachment);
    const { url: proxyUrl, refresh, attempt } = useMediaUrl(attachment);
    const audioRef = useRef(null);
    const resumeAt = useRef(null);
    const wantsPlay = useRef(false); // the listener pressed play and hasn't paused
    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [current, setCurrent] = useState(0);
    const [mediaDuration, setMediaDuration] = useState(0);
    const [speed, setSpeed] = useState(1);
    const [failed, setFailed] = useState(false);
    const bars = useMemo(() => barPattern(attachment.url || attachment.name || ''), [attachment.url, attachment.name]);

    // WebM recordings often report an unknown (Infinity) length; the recorder's measured
    // duration is stored with the message and used instead.
    const total = mediaDuration > 0 ? mediaDuration : storedDuration;

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return undefined;
        const onMeta = () => {
            const d = audio.duration;
            if (Number.isFinite(d) && d > 0) setMediaDuration(d);
            if (resumeAt.current != null) {
                try { audio.currentTime = resumeAt.current; } catch { /* not seekable yet */ }
                resumeAt.current = null;
                if (wantsPlay.current) audio.play().catch(() => {});
            }
        };
        const onTime = () => setCurrent(audio.currentTime);
        const onPlay = () => { setPlaying(true); setLoading(false); };
        const onPause = () => setPlaying(false);
        const onWaiting = () => setLoading(true);
        const onPlaying = () => setLoading(false);
        const onEnd = () => { wantsPlay.current = false; setPlaying(false); setCurrent(0); };
        const onError = () => {
            setLoading(false);
            // The signed link may have expired: get a fresh one and continue where we were.
            if (attempt < 2) { resumeAt.current = wantsPlay.current ? audio.currentTime || 0 : null; refresh(); }
            else setFailed(true);
        };
        audio.addEventListener('loadedmetadata', onMeta);
        audio.addEventListener('durationchange', onMeta);
        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('waiting', onWaiting);
        audio.addEventListener('playing', onPlaying);
        audio.addEventListener('ended', onEnd);
        audio.addEventListener('error', onError);
        return () => {
            audio.removeEventListener('loadedmetadata', onMeta);
            audio.removeEventListener('durationchange', onMeta);
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('waiting', onWaiting);
            audio.removeEventListener('playing', onPlaying);
            audio.removeEventListener('ended', onEnd);
            audio.removeEventListener('error', onError);
        };
    }, [attempt, refresh, proxyUrl]);

    // Pause when another voice note starts.
    useEffect(() => {
        const onOther = (e) => {
            if (e.detail === audioRef.current) return;
            wantsPlay.current = false;
            audioRef.current?.pause();
        };
        window.addEventListener(PLAY_EVENT, onOther);
        return () => window.removeEventListener(PLAY_EVENT, onOther);
    }, []);

    useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed, proxyUrl]);

    if (!hasFile) return null;

    const toggle = () => {
        const audio = audioRef.current;
        if (!audio || !proxyUrl) return;
        if (!audio.paused) { wantsPlay.current = false; audio.pause(); return; }
        wantsPlay.current = true;
        window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: audio }));
        audio.playbackRate = speed;
        setLoading(true);
        audio.play().catch(() => setLoading(false));
    };

    const seekTo = (seconds) => {
        const audio = audioRef.current;
        if (!audio || !total) return;
        const t = Math.max(0, Math.min(total, seconds));
        try { audio.currentTime = t; } catch { /* not seekable yet */ }
        setCurrent(t);
    };

    const cycleSpeed = () => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]);
    const progress = total ? Math.min(1, current / total) : 0;
    const shown = playing || current > 0 ? current : total;

    return (
        <div data-testid="voice-message" style={{
            marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 12px',
            backgroundColor: 'var(--bg-active)',
            border: '1px solid var(--border-default)',
            borderRadius: '2px',
            width: 'min(320px, 100%)',
        }}>
            <audio ref={audioRef} src={proxyUrl || undefined} preload="metadata" />

            <button
                type="button"
                onClick={toggle}
                disabled={!proxyUrl || failed}
                aria-label={playing ? 'Pause voice note' : 'Play voice note'}
                title={failed ? 'This voice note can’t be played' : playing ? 'Pause' : 'Play'}
                style={{
                    flexShrink: 0, width: '34px', height: '34px', borderRadius: '50%',
                    backgroundColor: failed ? 'var(--bg-hover)' : 'var(--accent)',
                    border: 'none', outline: 'none', cursor: proxyUrl && !failed ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
            >
                {loading && !playing
                    ? <Loader2 size={14} style={{ color: '#0c0c0c', animation: 'spin 1s linear infinite' }} />
                    : playing
                        ? <Pause size={14} style={{ color: '#0c0c0c' }} />
                        : <Play size={14} style={{ color: '#0c0c0c', marginLeft: '2px' }} />}
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center', gap: 2 }}>
                    {bars.map((h, i) => (
                        <div key={i} aria-hidden style={{
                            flex: 1, minWidth: 2, height: `${Math.round(h * 22)}px`, borderRadius: 1,
                            background: (i + 0.5) / BARS <= progress ? 'var(--accent)' : 'var(--border-accent)',
                            transition: 'background-color 80ms linear',
                        }} />
                    ))}
                    <input
                        type="range"
                        data-testid="voice-seek"
                        aria-label="Seek"
                        min={0}
                        max={total || 0}
                        step={0.1}
                        value={Math.min(current, total || 0)}
                        disabled={!total}
                        onChange={(e) => seekTo(Number(e.target.value))}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: total ? 'pointer' : 'default', margin: 0 }}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    <span data-testid="voice-time">{failed ? 'Unavailable' : (playing || current > 0) && total ? `${formatDuration(current)} / ${formatDuration(total)}` : formatDuration(shown)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mic size={10} /> Voice note</span>
                </div>
            </div>

            <button
                type="button"
                data-testid="voice-speed"
                onClick={cycleSpeed}
                title="Playback speed"
                aria-label={`Playback speed ${speed}x`}
                style={{
                    flexShrink: 0, minWidth: 34, padding: '3px 6px', borderRadius: 10,
                    border: '1px solid var(--border-default)', background: speed !== 1 ? 'var(--accent-dim)' : 'transparent',
                    color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
                }}
            >
                {speed}×
            </button>
        </div>
    );
}
