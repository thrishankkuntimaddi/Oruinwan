// Wide windows (laptops, desktops, tablets in landscape) get a sidebar instead of the tab bar,
// and list tabs show their list and the open screen side by side. Phones never reach the
// breakpoint, so their layout is unchanged. Keep WIDE_QUERY in step with Tailwind's `lg:`.
import { createContext, useContext } from 'react';
import { create } from 'zustand';
import { isDesktop } from '../native/index.js';

const WIDE_QUERY = '(min-width: 1024px)';
const mq = typeof matchMedia === 'function' ? matchMedia(WIDE_QUERY) : null;

export const useLayout = create(() => ({ wide: Boolean(mq?.matches) }));
mq?.addEventListener?.('change', (e) => useLayout.setState({ wide: e.matches }));

export const useWide = () => useLayout((s) => s.wide);

/** Tabs whose root is a list: on wide windows the list stays visible next to the open item. */
export const SPLIT_TABS = new Set(['home', 'chats', 'tasks', 'notes']);

export const isSplit = (tab) => useLayout.getState().wide && SPLIT_TABS.has(tab);

/** A mouse or trackpad is the main pointer (always on the desktop app): Enter sends, right-click opens menus. */
export const finePointer = () =>
  isDesktop || (typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches);

/**
 * Where a pushed screen is shown. `split` is true in the detail pane of a split tab, and
 * `depth` is its position in that tab's stack (0 = the item opened from the list).
 */
export const PaneContext = createContext({ split: false, depth: 0 });
export const usePane = () => useContext(PaneContext);
