// Quick jump on Home: a sideways row of places. Pinned ones (chats, channels, groups, or app places
// like Files) always come first, in the order pinned; your latest conversations follow. Long-press
// a bubble to pin or unpin it. Saved on this device.
import { create } from 'zustand';
import { prefs } from '../../native/storage.js';

export const MAX_PINS = 12;
/** How many recent conversations follow the pins. */
export const RECENT_IN_ROW = 20;
// Kept for older callers: the row used to hold 5 picks.
export const MAX_QUICK = MAX_PINS;
const KEY = 'home.quickjump.v1';

const keyOf = (x) => `${x.kind}:${x.id}`;
const clean = (list) => {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter((x) => x && ['channel', 'dm', 'place'].includes(x.kind) && x.id && !seen.has(keyOf(x)) && seen.add(keyOf(x)))
    .map(({ kind, id }) => ({ kind, id }))
    .slice(0, MAX_PINS);
};

/** { items: [{ kind: 'channel' | 'dm' | 'place', id }] | null } — the pins (null: none yet). */
export const useQuickJump = create(() => ({ items: prefs.get(KEY, null) ? clean(prefs.get(KEY, null)) : null }));

export function setQuickJump(items) {
  const next = items === null ? null : clean(items);
  prefs.set(KEY, next && next.length ? next : null);
  useQuickJump.setState({ items: next && next.length ? next : null });
}

export function isPinned(pins, entry) {
  return (pins || []).some((p) => keyOf(p) === keyOf(entry));
}

/** Pin or unpin one place. Returns 'pinned' | 'unpinned' | 'full'. */
export function togglePin(entry) {
  const pins = useQuickJump.getState().items || [];
  if (isPinned(pins, entry)) {
    setQuickJump(pins.filter((p) => keyOf(p) !== keyOf(entry)));
    return 'unpinned';
  }
  if (pins.length >= MAX_PINS) return 'full';
  setQuickJump([...pins, { kind: entry.kind, id: entry.id }]);
  return 'pinned';
}

/** The row: pins first ({ pinned: true }), then the latest conversations that aren't pinned. */
export function quickJumpItems(pins, recent, limit = RECENT_IN_ROW) {
  const pinned = (pins || []).map((p) => ({ ...p, pinned: true }));
  const rest = (recent || [])
    .map((r) => ({ kind: r.kind, id: r.item.id }))
    .filter((r) => !isPinned(pins, r))
    .slice(0, limit);
  return [...pinned, ...rest];
}
