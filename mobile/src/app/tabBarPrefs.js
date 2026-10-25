// Which five places sit on the phone's tab bar, in what order (the person picks in the tab bar
// drawer → Edit). Home, Chats, Tasks, Notes and Activity by default; Files, Knowledge and
// Huddles can take a slot too. Saved on the device.
import { create } from 'zustand';
import { Bell, BookOpen, FolderOpen, Headphones, House, MessagesSquare, SquareCheckBig, FileText } from 'lucide-react';
import { prefs } from '../native/storage.js';

export const DEFAULT_BAR = ['home', 'chats', 'tasks', 'notes', 'activity'];
/** Places that can be tabs besides the defaults (their screens become tab roots). */
export const EXTRA_TABS = ['files', 'knowledge', 'huddles'];
export const BAR_CHOICES = [...DEFAULT_BAR, ...EXTRA_TABS];
export const MAX_BAR = 5;
export const MIN_BAR = 3;

export const TAB_META = {
  home: { label: 'Home', icon: House },
  chats: { label: 'Chats', icon: MessagesSquare },
  tasks: { label: 'Tasks', icon: SquareCheckBig },
  notes: { label: 'Notes', icon: FileText },
  activity: { label: 'Activity', icon: Bell },
  files: { label: 'Files', icon: FolderOpen },
  knowledge: { label: 'Knowledge', icon: BookOpen },
  huddles: { label: 'Huddles', icon: Headphones },
};

/** A saved list, cleaned: known places only, no repeats, 3–5 of them, Home always kept. */
export function cleanBar(list) {
  const seen = new Set();
  const out = (Array.isArray(list) ? list : []).filter((t) => BAR_CHOICES.includes(t) && !seen.has(t) && seen.add(t)).slice(0, MAX_BAR);
  if (!out.includes('home')) out.unshift('home');
  return out.length >= MIN_BAR ? out.slice(0, MAX_BAR) : DEFAULT_BAR;
}

export const useTabBar = create(() => ({ items: cleanBar(prefs.get('tabbar.items', DEFAULT_BAR)) }));

export function setBarItems(items) {
  const clean = cleanBar(items);
  prefs.set('tabbar.items', clean);
  useTabBar.setState({ items: clean });
}
