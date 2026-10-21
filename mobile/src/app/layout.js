// Three layouts, by window size. Phones, tablets and iPads all run this UI (scripts/assemble-native.mjs):
//  - Phone (< 768 px wide, or under 500 px tall): one screen at a time, tab bar at the bottom.
//    The height rule keeps phones in landscape (844x390, 932x430) on the phone layout.
//  - Split (768-1023 px: tablets in portrait, iPad split-screen halves, small windows): list tabs
//    show the list as a column, with its tab bar, next to the open item. No sidebar: it would
//    leave the open item too little room.
//  - Wide (>= 1024 px: tablets in landscape, laptops, desktops): a sidebar instead of the tab
//    bar, and the same list + open item split. Tailwind's `lg:` (1024 px) matches the width rule.
// The layout follows the window as it resizes (rotation, iPad Slide Over / Split View, Android
// multi-window); the navigation store is untouched, so nothing open is lost.
import { createContext, useContext } from 'react';
import { create } from 'zustand';
import { isDesktop } from '../native/index.js';

export const SPLIT_MIN_WIDTH = 768;
export const WIDE_MIN_WIDTH = 1024;
/** Shorter than this is a phone on its side: too little height for two panes and a tab bar. */
export const MIN_PANE_HEIGHT = 500;

/** 'phone' | 'split' | 'wide' for a window of this size (CSS pixels). */
export function layoutFor(width, height) {
  if (!(width > 0)) return 'phone';
  if (width < SPLIT_MIN_WIDTH) return 'phone';
  if (height > 0 && height < MIN_PANE_HEIGHT) return 'phone';
  return width >= WIDE_MIN_WIDTH ? 'wide' : 'split';
}

/**
 * Width of the list column beside the open item: about a third of the window, never narrower
 * than a phone (so list rows keep their layout) and never so wide the open item gets cramped.
 */
export function listColumnWidth(width, kind = layoutFor(width, MIN_PANE_HEIGHT)) {
  if (kind === 'phone') return width;
  const [min, max, share] = kind === 'wide' ? [320, 420, 0.3] : [300, 380, 0.4];
  return Math.round(Math.min(max, Math.max(min, width * share)));
}

const size = () =>
  typeof window === 'undefined' ? { w: 0, h: 0 } : { w: window.innerWidth || 0, h: window.innerHeight || 0 };

function stateFor({ w, h }) {
  const kind = layoutFor(w, h);
  return { kind, wide: kind === 'wide', split: kind !== 'phone', width: w, height: h };
}

export const useLayout = create(() => stateFor(size()));

/** Recomputes the layout (also called by tests). */
export function syncLayout(next = size()) {
  const s = stateFor(next);
  const cur = useLayout.getState();
  if (cur.kind !== s.kind || cur.width !== s.width || cur.height !== s.height) useLayout.setState(s);
}

if (typeof window !== 'undefined') {
  let queued = false;
  const onResize = () => {
    if (queued) return;
    queued = true;
    (window.requestAnimationFrame || ((fn) => setTimeout(fn, 16)))(() => {
      queued = false;
      syncLayout();
    });
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

/** Sidebar layout (>= 1024 px wide, tall enough). */
export const useWide = () => useLayout((s) => s.wide);
/** List tabs show the list next to the open item (split and wide). */
export const useSplit = () => useLayout((s) => s.split);
/** Pixel width of the list column for the current window. */
export const useListWidth = () => useLayout((s) => listColumnWidth(s.width, s.kind));

/** Tabs whose root is a list: on split and wide windows the list stays visible next to the open item. */
export const SPLIT_TABS = new Set(['home', 'chats', 'tasks', 'notes']);

export const isSplit = (tab) => useLayout.getState().split && SPLIT_TABS.has(tab);

/** A mouse or trackpad is the main pointer (always on the desktop app): Enter sends, right-click opens menus. */
export const finePointer = () =>
  isDesktop || (typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches);

/** A hardware keyboard is likely attached (iPad Magic Keyboard, Android tablet keyboards, desktops). */
export const hardwareKeyboard = () =>
  finePointer() || (typeof matchMedia === 'function' && matchMedia('(any-hover: hover)').matches);

/**
 * Where a pushed screen is shown. `split` is true in the detail pane of a split tab, and
 * `depth` is its position in that tab's stack (0 = the item opened from the list).
 */
export const PaneContext = createContext({ split: false, depth: 0 });
export const usePane = () => useContext(PaneContext);
