// Navigation: one stack per bottom tab (like native apps), plus an overlay stack for
// sheets and dialogs. Tab roots stay mounted so scroll position and drafts survive.
import { create } from 'zustand';
import { uid } from '../lib/id.js';
import { tap } from '../native/index.js';

export const TABS = ['home', 'chats', 'ai', 'tasks', 'notes'];

const emptyStacks = () => Object.fromEntries(TABS.map((t) => [t, []]));

export const useNav = create((set, get) => ({
  tab: 'home',
  stacks: emptyStacks(),
  overlays: [], // [{ id, close }]

  setTab(tab) {
    const { tab: current, stacks } = get();
    if (tab === current) {
      // Tapping the active tab returns to its root, as on iOS/Android.
      if (stacks[tab].length) set({ stacks: { ...stacks, [tab]: [] } });
      else window.dispatchEvent(new CustomEvent('oru:scroll-top', { detail: tab }));
      return;
    }
    tap('select');
    set({ tab });
  },

  push(name, params = {}, { tab } = {}) {
    const target = tab || get().tab;
    const route = { key: uid('r'), name, params };
    set((s) => ({ tab: target, stacks: { ...s.stacks, [target]: [...s.stacks[target], route] } }));
  },

  replace(name, params = {}) {
    const { tab } = get();
    set((s) => {
      const stack = s.stacks[tab].slice(0, -1);
      return { stacks: { ...s.stacks, [tab]: [...stack, { key: uid('r'), name, params }] } };
    });
  },

  pop() {
    const { tab, stacks } = get();
    if (!stacks[tab].length) return false;
    set({ stacks: { ...stacks, [tab]: stacks[tab].slice(0, -1) } });
    return true;
  },

  /** Open a route from anywhere (notification, search, deep link) in the right tab. */
  open(tab, name, params = {}) {
    set((s) => ({
      tab,
      stacks: { ...s.stacks, [tab]: name ? [{ key: uid('r'), name, params }] : [] },
    }));
  },

  resetAll() {
    set({ tab: 'home', stacks: emptyStacks(), overlays: [] });
  },

  pushOverlay(id, close) {
    set((s) => ({ overlays: [...s.overlays.filter((o) => o.id !== id), { id, close }] }));
  },
  removeOverlay(id) {
    set((s) => ({ overlays: s.overlays.filter((o) => o.id !== id) }));
  },

  /** Android back: overlay → pushed screen → Home tab → let the OS minimise. */
  back() {
    const { overlays, tab } = get();
    if (overlays.length) {
      overlays[overlays.length - 1].close();
      return true;
    }
    if (get().pop()) return true;
    if (tab !== 'home') {
      set({ tab: 'home' });
      return true;
    }
    return false;
  },
}));

export const nav = {
  push: (...a) => useNav.getState().push(...a),
  pop: () => useNav.getState().pop(),
  replace: (...a) => useNav.getState().replace(...a),
  open: (...a) => useNav.getState().open(...a),
  setTab: (t) => useNav.getState().setTab(t),
};
