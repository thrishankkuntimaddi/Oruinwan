// Navigation: one stack per bottom tab (like native apps), plus an overlay stack for
// sheets and dialogs. Tab roots stay mounted so scroll position and drafts survive.
import { create } from 'zustand';
import { uid } from '../lib/id.js';
import { tap } from '../native/index.js';
import { isSplit, useSplit } from './layout.js';

// The bottom tab bar, in order. Activity is the notifications list.
export const BAR_TABS = ['home', 'chats', 'tasks', 'notes', 'activity'];
// Every stack. AI is not on the tab bar: it opens from the AI button in each tab's header (and
// the sidebar on wide windows), covers the tab bar, and its back button returns to `prev`.
export const TABS = [...BAR_TABS, 'ai'];

const emptyStacks = () => Object.fromEntries(TABS.map((t) => [t, []]));

/** Forget every "came from" tab: after the person picks a tab themselves, back stays in that tab. */
const clearFrom = (stacks) =>
  Object.fromEntries(Object.entries(stacks).map(([t, list]) => [t, list.map((r) => (r.from ? { ...r, from: undefined } : r))]));

// Which pane the user last clicked or typed in ({ tab, pane: 'list' | 'detail' | 'sidebar' }),
// set by the wide layout. In a split tab, opening something from the list replaces what the
// detail pane shows; only screens opened inside the detail pane stack on top of each other.
let origin = null;
export function markPane(tab, pane) {
  origin = { tab, pane };
}

export const useNav = create((set, get) => ({
  tab: 'home',
  prev: 'home', // the tab to return to when leaving AI
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
    set(tab === 'ai' ? { tab, prev: current } : { tab, stacks: clearFrom(stacks) });
  },

  /** Leaves the AI screen for the tab it was opened from. */
  leaveAi() {
    const { tab, prev } = get();
    if (tab === 'ai') set({ tab: prev && prev !== 'ai' ? prev : 'home' });
  },

  push(name, params = {}, { tab } = {}) {
    const target = tab || get().tab;
    const current = get().tab;
    // Opened from another tab (Activity → a DM, Home → a task): back returns to that tab.
    const from = target !== current && current !== 'ai' ? current : undefined;
    const route = { key: uid('r'), name, params, from };
    const fresh = isSplit(target) && !(origin?.pane === 'detail' && origin.tab === target);
    // Anything else opened before the next click (open() then push()) stacks on this screen.
    origin = { tab: target, pane: 'detail' };
    set((s) => ({ tab: target, ...(target === 'ai' && s.tab !== 'ai' ? { prev: s.tab } : {}), stacks: { ...s.stacks, [target]: fresh ? [route] : [...s.stacks[target], route] } }));
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
    const top = stacks[tab][stacks[tab].length - 1];
    const next = { ...stacks, [tab]: stacks[tab].slice(0, -1) };
    set(top.from && top.from !== tab && TABS.includes(top.from) ? { tab: top.from, stacks: next } : { stacks: next });
    return true;
  },

  /** Open a route from anywhere (notification, search, deep link) in the right tab. */
  open(tab, name, params = {}) {
    origin = { tab, pane: 'detail' };
    set((s) => {
      const from = tab !== s.tab && s.tab !== 'ai' ? s.tab : undefined;
      return {
        tab,
        ...(tab === 'ai' && s.tab !== 'ai' ? { prev: s.tab } : {}),
        stacks: { ...s.stacks, [tab]: name ? [{ key: uid('r'), name, params, from }] : [] },
      };
    });
  },

  resetAll() {
    set({ tab: 'home', prev: 'home', stacks: emptyStacks(), overlays: [] });
  },

  pushOverlay(id, close) {
    set((s) => ({ overlays: [...s.overlays.filter((o) => o.id !== id), { id, close }] }));
  },
  removeOverlay(id) {
    set((s) => ({ overlays: s.overlays.filter((o) => o.id !== id) }));
  },

  /** Android back: overlay → pushed screen → (AI → the tab it came from) → Home tab → let the OS minimise. */
  back() {
    const { overlays, tab } = get();
    if (overlays.length) {
      overlays[overlays.length - 1].close();
      return true;
    }
    if (get().pop()) return true;
    if (tab === 'ai') {
      get().leaveAi();
      return true;
    }
    if (tab !== 'home') {
      set({ tab: 'home' });
      return true;
    }
    return false;
  },
}));

/** True when the detail pane (split or wide layout) shows this item, so its list row can be highlighted. */
export function useIsOpen(name, id) {
  const split = useSplit();
  const open = useNav((s) => {
    const top = s.stacks[s.tab][0];
    return Boolean(top && top.name === name && top.params.id === id);
  });
  return split && open;
}

export const nav = {
  push: (...a) => useNav.getState().push(...a),
  pop: () => useNav.getState().pop(),
  replace: (...a) => useNav.getState().replace(...a),
  open: (...a) => useNav.getState().open(...a),
  setTab: (t) => useNav.getState().setTab(t),
  /** Opens Oruinwan AI (header button, "Ask AI" actions). */
  openAi: () => useNav.getState().setTab('ai'),
  leaveAi: () => useNav.getState().leaveAi(),
};
