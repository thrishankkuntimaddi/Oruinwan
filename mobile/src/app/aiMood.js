// The AI button's mood: how its face looks for a moment. Things around the app nudge it:
//   tap → happy; three quick taps → tongue out; hold it → surprised; a fast fling of a list →
//   surprised; an error → sad; good news (sent, saved, done) → happy; nothing for a while → sleepy.
// Scrolling makes it look the way the list moves.
import { create } from 'zustand';
import { on } from '../lib/bus.js';

export const MOODS = ['idle', 'happy', 'surprised', 'sad', 'tongue', 'sleepy'];

export const useAiMood = create(() => ({ mood: 'idle', glance: 0 }));

let timer = null;
/** Show `mood` for `ms`, then go back to idle. */
export function setMood(mood, ms = 1600) {
  clearTimeout(timer);
  useAiMood.setState({ mood });
  if (mood !== 'idle' && ms > 0) timer = setTimeout(() => useAiMood.setState({ mood: 'idle' }), ms);
}

const taps = [];
/** A tap on the button: happy, or tongue out on the third quick tap. */
export function pokeAi(now = Date.now()) {
  taps.push(now);
  while (taps.length && now - taps[0] > 1500) taps.shift();
  if (taps.length >= 3) {
    taps.length = 0;
    setMood('tongue', 2000);
    return 'tongue';
  }
  setMood('happy', 1200);
  return 'happy';
}

/** How a scroll looks to it: { mood?, glance } where glance is -1 (up) … 1 (down). */
export function scrollReaction(dy, dt) {
  const speed = Math.abs(dy) / Math.max(dt, 1); // px per ms
  return { mood: speed > 4 ? 'surprised' : null, glance: Math.max(-1, Math.min(1, dy / 40)) };
}

let bound = false;
/** Listens app-wide (once): toasts, scrolling, and idleness. Returns a cleanup. */
export function bindAiMood() {
  if (bound || typeof window === 'undefined') return () => {};
  bound = true;
  const offToast = on('toast', ({ tone } = {}) => {
    if (tone === 'danger') setMood('sad', 2200);
    else if (tone === 'success') setMood('happy', 1400);
  });
  let last = null;
  let glanceTimer = null;
  const onScroll = (e) => {
    const el = e.target;
    if (!el || typeof el.scrollTop !== 'number') return;
    const now = performance.now();
    const top = el.scrollTop;
    if (last && last.el === el) {
      const r = scrollReaction(top - last.top, now - last.t);
      if (r.mood && useAiMood.getState().mood !== 'surprised') setMood(r.mood, 900);
      useAiMood.setState({ glance: r.glance });
      clearTimeout(glanceTimer);
      glanceTimer = setTimeout(() => useAiMood.setState({ glance: 0 }), 600);
    }
    last = { el, top, t: now };
    wake();
  };
  let sleepTimer = null;
  const wake = () => {
    if (useAiMood.getState().mood === 'sleepy') setMood('idle', 0);
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => setMood('sleepy', 0), 45_000);
  };
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
  window.addEventListener('pointerdown', wake, { passive: true });
  wake();
  return () => {
    bound = false;
    offToast();
    window.removeEventListener('scroll', onScroll, { capture: true });
    window.removeEventListener('pointerdown', wake);
    clearTimeout(sleepTimer);
    clearTimeout(glanceTimer);
  };
}
