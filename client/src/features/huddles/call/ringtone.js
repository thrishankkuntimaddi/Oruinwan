/**
 * The incoming-call ringtone: a soft two-tone ring every 3 seconds, made with Web Audio (no file
 * to load). startRingtone() returns a stop function. Silent when audio isn't available or the
 * browser blocks sound before the first click.
 */

let ctx = null;

function audioContext() {
    if (typeof window === 'undefined') return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
        ctx = ctx || new Ctx();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
    } catch {
        return null;
    }
}

/** One ring: two short bursts of a two-note tone. */
function ringOnce(ac) {
    const t = ac.currentTime;
    [0, 0.45].forEach((offset) => {
        [[523.25, 0], [659.25, 0.12]].forEach(([freq, at]) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = t + offset + at;
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.08, start + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
            osc.connect(gain).connect(ac.destination);
            osc.start(start);
            osc.stop(start + 0.32);
        });
    });
}

export function startRingtone({ everyMs = 3000 } = {}) {
    const ac = audioContext();
    if (!ac) return () => {};
    let stopped = false;
    const ring = () => { if (!stopped) { try { ringOnce(ac); } catch { /* no audio device */ } } };
    ring();
    const timer = setInterval(ring, everyMs);
    return () => {
        stopped = true;
        clearInterval(timer);
    };
}
