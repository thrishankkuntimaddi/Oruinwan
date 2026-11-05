// The AI button flies between its places: from the floating button bottom right (AiFab) to a
// screen's own AI button top right (a chat's AiIsland, or any `useAiLanding` button) and back.
//
// A button leaving (the FAB hiding, a chat closing) leaves its spot behind: where it was and a
// copy of how it looked. A button appearing within a moment takes that spot and a "ghost" flies
// from there to it along an arc, turning from one look into the other, while the real button
// waits invisible. The target's position is read every frame, so a screen sliding in is followed.
import { useLayoutEffect, useRef, useState } from 'react';

const FLIGHT_MS = 560;
const FRESH_MS = 900;
let spot = null; // { rect, look, at }

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A button is about to go: remember where it was and how it looked. */
export function leaveSpot(el, restRect = null) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return;
  const now = el.getBoundingClientRect();
  // A screen sliding away has carried the button off screen: use where it rested instead.
  const off = !now.width || now.right < 0 || now.left > window.innerWidth || now.bottom < 0 || now.top > window.innerHeight;
  const rect = off && restRect ? restRect : now;
  if (!rect.width || !rect.height) return;
  spot = { rect, look: el.cloneNode(true), at: Date.now() };
}

/** The spot a button just left, if it is recent (used once). */
export function takeSpot() {
  const s = spot;
  spot = null;
  return s && Date.now() - s.at < FRESH_MS ? s : null;
}

export function _clearSpot() {
  spot = null;
}

/**
 * Flight paths, picked at random (never the same twice in a row): extra sideways / up offsets,
 * spin and size for progress t (0..1) over a distance `d` (px). The straight line is added on top.
 */
export const PATHS = {
  arcLeft: (t, d) => ({ x: -Math.sin(Math.PI * t) * Math.min(90, d * 0.25), y: 0, spin: -Math.sin(Math.PI * t) * 14, scale: 1 + Math.sin(Math.PI * t) * 0.12 }),
  arcRight: (t, d) => ({ x: Math.sin(Math.PI * t) * Math.min(70, d * 0.2), y: 0, spin: Math.sin(Math.PI * t) * 16, scale: 1 + Math.sin(Math.PI * t) * 0.12 }),
  loop: (t, d) => {
    const r = Math.min(46, d * 0.12);
    const a = Math.PI * 2 * Math.min(1, Math.max(0, (t - 0.25) / 0.5));
    return { x: -Math.sin(a) * r, y: -(1 - Math.cos(a)) * r, spin: (a / (Math.PI * 2)) * 360, scale: 1 + Math.sin(Math.PI * t) * 0.1 };
  },
  hops: (t, d) => {
    const h = Math.min(60, d * 0.12);
    const hop = Math.abs(Math.sin(Math.PI * 3 * t)) * h * (1 - t * 0.6);
    return { x: 0, y: -hop, spin: 0, scale: 1 - Math.abs(Math.cos(Math.PI * 3 * t)) * 0.08 };
  },
  zigzag: (t, d) => ({ x: Math.sin(Math.PI * 4 * t) * Math.min(36, d * 0.08) * (1 - t), y: 0, spin: Math.sin(Math.PI * 4 * t) * 10, scale: 1 }),
  // Little steps: a hop per step, leaning into each one.
  walk: (t, d) => {
    const steps = Math.max(3, Math.min(7, Math.round(d / 90)));
    const phase = t * steps;
    const hop = Math.abs(Math.sin(Math.PI * phase)) * Math.min(18, 8 + d * 0.02);
    return { x: 0, y: -hop, spin: Math.sin(Math.PI * 2 * phase) * 9, scale: 1 - Math.abs(Math.cos(Math.PI * phase)) * 0.06 };
  },
  spiral: (t, d) => {
    const r = Math.min(40, d * 0.1) * Math.sin(Math.PI * t);
    const a = Math.PI * 4 * t;
    return { x: Math.cos(a) * r - r, y: Math.sin(a) * r, spin: t * 360, scale: 1 + Math.sin(Math.PI * t) * 0.15 };
  },
};
const PATH_NAMES = Object.keys(PATHS);
let lastPath = null;
/** A different path from last time. */
export function pickPath(random = Math.random) {
  const choices = PATH_NAMES.filter((n) => n !== lastPath);
  lastPath = choices[Math.floor(random() * choices.length) % choices.length];
  return lastPath;
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function lookLayer(node, opacity) {
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:absolute;inset:0;display:grid;place-items:center;opacity:${opacity};`;
  node.removeAttribute('id');
  node.setAttribute('aria-hidden', 'true');
  node.style.position = 'static';
  node.style.inset = 'auto';
  node.style.margin = '0';
  node.style.width = '100%';
  node.style.height = '100%';
  node.style.opacity = '1';
  node.style.transition = 'none';
  wrap.appendChild(node);
  return wrap;
}

/**
 * Fly from `from` ({ rect, look }) to the element `to`; `onLand` runs when it arrives (or at
 * once when there is nothing to fly, or the person prefers less motion).
 */
export function fly(from, to, onLand) {
  if (!from || !to || reducedMotion() || typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') {
    onLand?.();
    return () => {};
  }
  const ghost = document.createElement('div');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.dataset.testid = 'ai-flight';
  ghost.style.cssText = 'position:fixed;left:0;top:0;z-index:70;pointer-events:none;will-change:transform,width,height;';
  const a = lookLayer(from.look, 1);
  const b = lookLayer(to.cloneNode(true), 0);
  ghost.append(a, b);
  document.body.appendChild(ghost);
  const r0 = from.rect;
  const path = PATHS[pickPath()];
  ghost.dataset.path = lastPath;
  const start = performance.now();
  let lastTarget = null;
  let frame = 0;
  const step = (now) => {
    const t = Math.min(1, (now - start) / FLIGHT_MS);
    const k = ease(t);
    // A target not laid out yet (a screen still sliding back in) keeps its last good place.
    const seen = to.getBoundingClientRect();
    if (seen.width && seen.height) lastTarget = seen;
    const r1 = lastTarget || r0;
    const w = r0.width + (r1.width - r0.width) * k;
    const h = r0.height + (r1.height - r0.height) * k;
    const cx = r0.left + r0.width / 2 + (r1.left + r1.width / 2 - (r0.left + r0.width / 2)) * k;
    const cy0 = r0.top + r0.height / 2;
    const cy1 = r1.top + r1.height / 2;
    const cy = cy0 + (cy1 - cy0) * k;
    const o = path(t, Math.hypot(r1.left - r0.left, cy1 - cy0));
    ghost.style.width = `${w}px`;
    ghost.style.height = `${h}px`;
    // Never off the screen: some paths swing out, and both ends often sit at its edge.
    const room = (Math.max(1, o.scale) - 1) * Math.max(w, h) * 0.5 + 6;
    const gx = Math.min(Math.max(cx - w / 2 + o.x, room), window.innerWidth - w - room);
    const gy = Math.min(Math.max(cy - h / 2 + o.y, room), window.innerHeight - h - room);
    ghost.style.transform = `translate(${gx}px, ${gy}px) rotate(${o.spin}deg) scale(${o.scale})`;
    a.style.opacity = String(1 - Math.min(1, Math.max(0, (t - 0.35) / 0.4)));
    b.style.opacity = String(Math.min(1, Math.max(0, (t - 0.35) / 0.4)));
    if (t < 1) frame = requestAnimationFrame(step);
    else {
      ghost.remove();
      onLand?.();
    }
  };
  frame = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(frame);
    ghost.remove();
    onLand?.();
  };
}

/**
 * For a screen's AI button: when it appears right after the floating button left, it lands from
 * there (invisible until then); when it goes, it leaves its spot for the floating button.
 * Returns [ref, style] for the button.
 */
export function useAiLanding() {
  const ref = useRef(null);
  // Hidden until we know whether it lands from somewhere (decided before the first paint).
  const [landing, setLanding] = useState(true);
  useLayoutEffect(() => {
    const el = ref.current;
    let stop = () => {};
    let rest = null;
    let alive = true;
    // Where it rests once the screen has slid in (the spot it leaves when the screen closes).
    const settle = setTimeout(() => {
      rest = el?.getBoundingClientRect() || null;
    }, 700);
    // The floating button leaves its spot in the same update, after this effect: look once it has.
    queueMicrotask(() => {
      if (!alive) return;
      const from = takeSpot();
      if (from && el) stop = fly(from, el, () => alive && setLanding(false));
      else setLanding(false);
    });
    return () => {
      alive = false;
      clearTimeout(settle);
      stop();
      leaveSpot(el, rest);
    };
  }, []);
  // visibility, not opacity: a fade-in animation on the button would override opacity.
  return [ref, landing ? { visibility: 'hidden' } : undefined];
}

// ---------------------------------------------------------------- header buttons
// Every screen's header has the AI button (HeaderAi.jsx). Opening a screen, its button arrives
// from the header of the screen underneath (a new path each time); closing it, the button goes
// back. The button waits invisible while its ghost travels.

const headerSpots = []; // newest last: [{ el, land(from) }]

const visibleEl = (el) => {
  if (!el?.isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight;
};
const topVisible = (except) => [...headerSpots].reverse().find((s) => s.el !== except && visibleEl(s.el));

export function _resetHeaderSpots() {
  headerSpots.length = 0;
}

export function useAiHeaderSpot() {
  const ref = useRef(null);
  const [hidden, setHidden] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let alive = true;
    let stop = () => {};
    let rest = null;
    const entry = {
      el,
      land(from) {
        if (!alive) return () => {};
        setHidden(true);
        return fly(from, el, () => alive && setHidden(false));
      },
    };
    // Where it came from: a spot just left (the floating button, a chat's button), else the
    // header of the screen this one opens over.
    const below = topVisible(el);
    const belowFrom = below ? { rect: below.el.getBoundingClientRect(), look: below.el.cloneNode(true) } : null;
    headerSpots.push(entry);
    const settle = setTimeout(() => {
      rest = visibleEl(el) ? el.getBoundingClientRect() : null;
    }, 700);
    queueMicrotask(() => {
      if (!alive) return;
      const from = takeSpot() || belowFrom;
      if (from && from.rect.width) stop = entry.land(from);
    });
    return () => {
      alive = false;
      clearTimeout(settle);
      stop();
      const i = headerSpots.indexOf(entry);
      if (i >= 0) headerSpots.splice(i, 1);
      // Closing: fly back to the header of the screen underneath when there is one on show;
      // otherwise (back on a main screen) leave the spot, and the floating button flies down to it.
      const now = el.getBoundingClientRect();
      const from = { rect: now.width && now.right > 0 && now.left < window.innerWidth ? now : rest || now, look: el.cloneNode(true) };
      const back = topVisible(el);
      if (back && from.rect.width) back.land(from);
      else leaveSpot(el, rest);
    };
  }, []);
  return [ref, hidden ? { visibility: 'hidden' } : undefined];
}
