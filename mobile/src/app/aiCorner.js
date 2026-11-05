// Which corner the AI button lives in: drag it and it snaps to the nearest one (bottom right by
// default). Remembered on this device; a chat's AI button sits on the same side.
import { create } from 'zustand';
import { prefs } from '../native/storage.js';

export const AI_CORNERS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
const KEY = 'ai.corner';
const valid = (c) => (AI_CORNERS.includes(c) ? c : null);

export const useAiCorner = create(() => ({ corner: valid(prefs.get(KEY)) || 'bottom-right' }));

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
