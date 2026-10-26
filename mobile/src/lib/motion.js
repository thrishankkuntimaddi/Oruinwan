// Motion on the phone: the same soft, quick animations as the web app (client/src/utils/motion.js),
// and none of them when the system asks for reduced motion.
import { useEffect, useRef, useState } from 'react';
import { createArrivals, rose } from '../../../platform/motion/arrivals.js';

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion() {
  try {
    return Boolean(globalThis.matchMedia?.(REDUCED_MOTION).matches);
  } catch {
    return false;
  }
}

/** True while the system asks for reduced motion (follows changes). */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const mq = globalThis.matchMedia?.(REDUCED_MOTION);
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/** `cls`, or nothing when motion is reduced. */
export const motion = (cls, reduced = prefersReducedMotion()) => (reduced ? '' : cls);

/**
 * The ids of messages that arrived while the conversation is open (not the history it opened
 * with, not older pages). items: [{ id, tempId?, at }]. A new `key` starts over.
 */
export function useArrivals(items, key) {
  const ref = useRef(null);
  if (!ref.current || ref.current.key !== key) ref.current = { key, tracker: createArrivals() };
  return ref.current.tracker.update(items);
}

/**
 * A small bump when `value` goes up (an unread count, a reaction count): returns { key, className }
 * for the element. The key changes on each rise, so the animation plays again.
 */
export function useBump(value, cls = 'animate-bump') {
  const prev = useRef(value);
  const count = useRef(0);
  const reduced = useReducedMotion();
  if (rose(prev.current, value)) count.current += 1;
  prev.current = value;
  return { key: count.current, className: count.current && !reduced ? cls : '' };
}
