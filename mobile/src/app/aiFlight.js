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
  const start = performance.now();
  let frame = 0;
  const step = (now) => {
    const t = Math.min(1, (now - start) / FLIGHT_MS);
    const k = ease(t);
    const r1 = to.getBoundingClientRect();
    const w = r0.width + (r1.width - r0.width) * k;
    const h = r0.height + (r1.height - r0.height) * k;
    const cx = r0.left + r0.width / 2 + (r1.left + r1.width / 2 - (r0.left + r0.width / 2)) * k;
    const cy0 = r0.top + r0.height / 2;
    const cy1 = r1.top + r1.height / 2;
    // A gentle arc out to the side and a little spin, like a short hop through the air.
    const lift = Math.sin(Math.PI * t) * Math.min(90, Math.abs(cy1 - cy0) * 0.25);
    const cy = cy0 + (cy1 - cy0) * k;
    const spin = Math.sin(Math.PI * t) * (cy1 < cy0 ? -14 : 14);
    ghost.style.width = `${w}px`;
    ghost.style.height = `${h}px`;
    ghost.style.transform = `translate(${cx - w / 2 - lift}px, ${cy - h / 2}px) rotate(${spin}deg) scale(${1 + Math.sin(Math.PI * t) * 0.12})`;
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
  return [ref, landing ? { opacity: 0 } : undefined];
}
