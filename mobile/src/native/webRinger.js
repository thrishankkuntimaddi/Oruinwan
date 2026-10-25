// A ringtone for incoming calls in a browser (the phone app's UI on the website), where the
// Android app's native ringer isn't there: a two-tone ring from Web Audio, plus vibration
// where the browser allows it. Browsers only play sound after the page has been touched once;
// until then the incoming-call screen still shows and the phone vibrates.

let ctx = null;
let timer = null;
let vibTimer = null;

const RING_MS = 1600;
const PAUSE_MS = 2400;

function audio() {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctx) return null;
  ctx ||= new Ctx();
  return ctx;
}

// The first touch unlocks audio for the rest of the visit.
if (typeof window !== 'undefined') {
  const unlock = () => {
    try {
      audio()?.resume?.();
    } catch {
      /* no audio */
    }
  };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
}

function ringOnce() {
  const ac = audio();
  if (!ac || ac.state !== 'running') return;
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.connect(ac.destination);
  const t0 = ac.currentTime;
  for (const [freq, start] of [[880, 0], [660, 0.4], [880, 0.8], [660, 1.2]]) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(t0 + start);
    osc.stop(t0 + start + 0.35);
  }
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.25, t0 + 0.05);
  gain.gain.setValueAtTime(0.25, t0 + RING_MS / 1000 - 0.1);
  gain.gain.linearRampToValueAtTime(0, t0 + RING_MS / 1000);
}

export function startWebRinging() {
  stopWebRinging();
  ringOnce();
  timer = setInterval(ringOnce, RING_MS + PAUSE_MS);
  try {
    navigator.vibrate?.([600, 400, 600]);
    vibTimer = setInterval(() => navigator.vibrate?.([600, 400, 600]), RING_MS + PAUSE_MS);
  } catch {
    /* no vibration */
  }
  return true;
}

export function stopWebRinging() {
  clearInterval(timer);
  clearInterval(vibTimer);
  timer = null;
  vibTimer = null;
  try {
    navigator.vibrate?.(0);
  } catch {
    /* no vibration */
  }
  return true;
}
