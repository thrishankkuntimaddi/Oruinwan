// Touch gestures on a message row:
//  - swipe right → reply to it (quoted in the composer)
//  - tap → open its thread view; double tap → react
//  - press and hold (or right-click) → the actions sheet
// Taps on links, buttons, images and files inside the message keep doing their own thing.
import { useRef, useState } from 'react';
import { tap as haptic } from '../../native/index.js';

export const SWIPE_TRIGGER = 56;
const SWIPE_MAX = 80;
const LONG_PRESS_MS = 420;
const DOUBLE_TAP_MS = 280;
const INTERACTIVE = 'a,button,input,textarea,select,video,audio,img,[role="button"],[data-no-tap]';

export function isInteractive(target, row) {
  const el = target?.closest?.(INTERACTIVE);
  return Boolean(el && el !== row && row?.contains(el));
}

export function useRowGestures({ onLongPress, onSwipe, onTap, onDoubleTap }) {
  const [dx, setDx] = useState(0);
  const g = useRef(null);
  const lastTap = useRef(0);
  const tapTimer = useRef(null);

  const clearLong = () => {
    clearTimeout(g.current?.long);
    if (g.current) g.current.long = null;
  };

  const handlers = {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const row = e.currentTarget;
      g.current = { x: e.clientX, y: e.clientY, t: Date.now(), swiping: false, fired: false, row, target: e.target, mouse: e.pointerType === 'mouse', id: e.pointerId };
      if (!g.current.mouse && onLongPress) {
        g.current.long = setTimeout(() => {
          if (!g.current) return;
          g.current.fired = true;
          haptic('medium');
          onLongPress();
        }, LONG_PRESS_MS);
      }
    },
    onPointerMove: (e) => {
      const s = g.current;
      if (!s || s.fired) return;
      const mx = e.clientX - s.x;
      const my = e.clientY - s.y;
      if (!s.swiping) {
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) {
          // Scrolling the list: this isn't a tap, a swipe or a press.
          clearLong();
          g.current = null;
          return;
        }
        if (onSwipe && mx > 12 && mx > Math.abs(my) * 1.5) {
          s.swiping = true;
          clearLong();
          try {
            s.row.setPointerCapture?.(s.id);
          } catch {
            /* not capturable */
          }
        } else if (Math.abs(mx) > 10) clearLong();
      }
      if (s.swiping) {
        const next = Math.max(0, Math.min(SWIPE_MAX, mx * 0.7));
        if (next >= SWIPE_TRIGGER && !s.armed) {
          s.armed = true;
          haptic('light');
        } else if (next < SWIPE_TRIGGER) s.armed = false;
        setDx(next);
      }
    },
    onPointerUp: (e) => {
      const s = g.current;
      g.current = null;
      if (!s) return;
      clearTimeout(s.long);
      if (s.swiping) {
        setDx(0);
        if (s.armed) onSwipe?.();
        return;
      }
      if (s.fired) return;
      const moved = Math.hypot(e.clientX - s.x, e.clientY - s.y);
      if (moved > 10 || Date.now() - s.t > 500) return;
      if (isInteractive(s.target, s.row)) return;
      const now = Date.now();
      if (onDoubleTap && now - lastTap.current < DOUBLE_TAP_MS) {
        clearTimeout(tapTimer.current);
        lastTap.current = 0;
        haptic('light');
        onDoubleTap();
        return;
      }
      lastTap.current = now;
      clearTimeout(tapTimer.current);
      if (onTap) tapTimer.current = setTimeout(onTap, onDoubleTap ? DOUBLE_TAP_MS : 0);
    },
    onPointerCancel: () => {
      clearLong();
      g.current = null;
      setDx(0);
    },
    onContextMenu: (e) => {
      e.preventDefault();
      if (g.current?.mouse || e.nativeEvent?.pointerType === 'mouse' || !('ontouchstart' in window)) {
        clearLong();
        g.current = null;
        onLongPress?.();
      }
    },
  };
  return { dx, handlers };
}
