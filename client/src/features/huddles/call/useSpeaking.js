import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 0.035; // RMS level that counts as talking
const POLL_MS = 250;

/** Loudness (RMS, 0–1) of the latest audio frame. */
export function rmsOf(samples) {
    if (!samples || !samples.length) return 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) {
        const v = (samples[i] - 128) / 128;
        sum += v * v;
    }
    return Math.sqrt(sum / samples.length);
}

/**
 * Who is talking right now: `streams` is { userId: MediaStream }; returns a Set of user ids.
 * Uses one AudioContext; does nothing where Web Audio is missing (tests, old browsers).
 */
export function useSpeaking(streams) {
    const [speaking, setSpeaking] = useState(() => new Set());
    const ctxRef = useRef(null);
    const nodesRef = useRef(new Map()); // userId -> { stream, source, analyser, data }

    const key = Object.entries(streams || {})
        .map(([id, s]) => `${id}:${s?.id || ''}:${s?.getAudioTracks?.().length || 0}`)
        .sort().join('|');

    useEffect(() => {
        const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
        if (!AudioCtx) return undefined;
        if (!ctxRef.current) {
            try { ctxRef.current = new AudioCtx(); } catch { return undefined; }
        }
        const ctx = ctxRef.current;
        const nodes = nodesRef.current;
        const wanted = streams || {};

        // Drop streams that went away or changed.
        for (const [id, n] of nodes) {
            if (wanted[id] !== n.stream) {
                try { n.source.disconnect(); } catch { /* already gone */ }
                nodes.delete(id);
            }
        }
        for (const [id, stream] of Object.entries(wanted)) {
            if (nodes.has(id) || !stream?.getAudioTracks?.().length) continue;
            try {
                const source = ctx.createMediaStreamSource(stream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                source.connect(analyser);
                nodes.set(id, { stream, source, analyser, data: new Uint8Array(analyser.fftSize) });
            } catch { /* a stream without live audio */ }
        }

        const timer = setInterval(() => {
            if (ctx.state === 'suspended') ctx.resume?.().catch(() => {});
            const now = new Set();
            for (const [id, n] of nodes) {
                const track = n.stream.getAudioTracks()[0];
                if (!track || !track.enabled) continue;
                n.analyser.getByteTimeDomainData(n.data);
                if (rmsOf(n.data) > THRESHOLD) now.add(id);
            }
            setSpeaking(prev => (prev.size === now.size && [...now].every(id => prev.has(id)) ? prev : now));
        }, POLL_MS);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    useEffect(() => () => {
        for (const n of nodesRef.current.values()) { try { n.source.disconnect(); } catch { /* gone */ } }
        nodesRef.current.clear();
        ctxRef.current?.close?.().catch(() => {});
        ctxRef.current = null;
    }, []);

    return speaking;
}
