// Three layouts, by window width:
//  - Phones (< 768 px): one screen at a time, tab bar at the bottom.
//  - Split (768-1023 px, tablets in portrait, small windows): list tabs show the list as a
//    phone-width column, with its tab bar, next to the open item. No sidebar: it would leave
//    the open item too little room.
//  - Wide (>= 1024 px, laptops, desktops, tablets in landscape): a sidebar instead of the tab
//    bar, and the same list + open item split. Keep WIDE_QUERY in step with Tailwind's `lg:`.
import { createContext, useContext } from 'react';
import { create } from 'zustand';
import { isDesktop } from '../native/index.js';

const WIDE_QUERY = '(min-width: 1024px)';
const SPLIT_QUERY = '(min-width: 768px)';
const media = (q) => (typeof matchMedia === 'function' ? matchMedia(q) : null);
const mqWide = media(WIDE_QUERY);
const mqSplit = media(SPLIT_QUERY);

export const useLayout = create(() => ({ wide: Boolean(mqWide?.matches), split: Boolean(mqSplit?.matches) }));
mqWide?.addEventListener?.('change', (e) => useLayout.setState({ wide: e.matches }));
mqSplit?.addEventListener?.('change', (e) => useLayout.setState({ split: e.matches }));

/** Sidebar layout (>= 1024 px). */
export const useWide = () => useLayout((s) => s.wide);
/** List tabs show the list next to the open item (>= 768 px, includes wide). */
export const useSplit = () => useLayout((s) => s.split);

/** Tabs whose root is a list: on split and wide windows the list stays visible next to the open item. */
export const SPLIT_TABS = new Set(['home', 'chats', 'tasks', 'notes']);

export const isSplit = (tab) => useLayout.getState().split && SPLIT_TABS.has(tab);

/** A mouse or trackpad is the main pointer (always on the desktop app): Enter sends, right-click opens menus. */
export const finePointer = () =>
  isDesktop || (typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches);

/**
 * Where a pushed screen is shown. `split` is true in the detail pane of a split tab, and
 * `depth` is its position in that tab's stack (0 = the item opened from the list).
 */
export const PaneContext = createContext({ split: false, depth: 0 });
export const usePane = () => useContext(PaneContext);
