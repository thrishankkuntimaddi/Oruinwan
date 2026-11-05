// Which corner the AI button lives in. Off by default: it stays bottom right. With Settings →
// Oruinwan AI → "Move the AI button" on, drag it and it snaps to the nearest corner. Remembered
// on this device; a chat's AI button sits on the same side.
import { create } from 'zustand';
import { prefs } from '../native/storage.js';

export const AI_CORNERS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
const KEY = 'ai.corner';
const MOVABLE_KEY = 'ai.movable';
const FLOATING_KEY = 'ai.floating';
export const DEFAULT_CORNER = 'bottom-right';
const valid = (c) => (AI_CORNERS.includes(c) ? c : null);

// The AI button lives in each screen's header (next to search). "Floating AI button" in Settings
// puts it over the screens instead (bottom right, or any corner with "Move the AI button").
export const useAiCorner = create(() => ({
  floating: prefs.get(FLOATING_KEY, false) === true,
  movable: prefs.get(MOVABLE_KEY, false) === true,
  corner: valid(prefs.get(KEY)) || DEFAULT_CORNER,
}));

/** Where the button is now: its chosen corner when moving is on, else bottom right. */
export const effectiveCorner = (s) => (s.movable ? s.corner : DEFAULT_CORNER);
export const useEffectiveCorner = () => useAiCorner(effectiveCorner);

/** Settings switch: a floating AI button instead of the one in the headers. */
export function setAiFloating(on) {
  prefs.set(FLOATING_KEY, Boolean(on));
  useAiCorner.setState({ floating: Boolean(on) });
}

/** Settings switch. Off puts the button back bottom right. */
export function setAiMovable(on) {
  prefs.set(MOVABLE_KEY, Boolean(on));
  if (!on) prefs.set(KEY, DEFAULT_CORNER);
  useAiCorner.setState({ movable: Boolean(on), ...(on ? {} : { corner: DEFAULT_CORNER }) });
}

export function setAiCorner(corner) {
  const c = valid(corner);
  if (!c) return;
  prefs.set(KEY, c);
  useAiCorner.setState({ corner: c });
}

/** The corner nearest to a point on a w × h screen. */
export function nearestCorner(x, y, w, h) {
  return `${y < h / 2 ? 'top' : 'bottom'}-${x < w / 2 ? 'left' : 'right'}`;
}

export const onLeft = (corner) => String(corner).endsWith('left');
export const onTop = (corner) => String(corner).startsWith('top');
