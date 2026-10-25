// Quick jump on Home: up to five places the person picks (chats, channels, or app places like
// Files). Until they pick, it shows their most recent conversations. Saved on this device.
import { create } from 'zustand';
import { prefs } from '../../native/storage.js';

export const MAX_QUICK = 5;
const KEY = 'home.quickjump.v1';

const clean = (list) => {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter((x) => x && ['channel', 'dm', 'place'].includes(x.kind) && x.id && !seen.has(`${x.kind}:${x.id}`) && seen.add(`${x.kind}:${x.id}`))
    .slice(0, MAX_QUICK);
};

/** { items: [{ kind: 'channel' | 'dm' | 'place', id }] | null } — null: not customised yet. */
export const useQuickJump = create(() => ({ items: prefs.get(KEY, null) ? clean(prefs.get(KEY, null)) : null }));

export function setQuickJump(items) {
  const next = items === null ? null : clean(items);
  prefs.set(KEY, next);
  useQuickJump.setState({ items: next });
}

/** What Quick jump shows: the person's picks, else their latest conversations. */
export function quickJumpItems(custom, recent) {
  if (custom && custom.length) return custom;
  return recent.slice(0, MAX_QUICK).map((r) => ({ kind: r.kind, id: r.item.id }));
}
