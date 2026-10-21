// Hardware keyboard shortcuts (iPad Magic Keyboard, Android tablet keyboards, desktops).
// ⌘ on Apple devices, Ctrl elsewhere. Kept free of React so it can be unit tested.
const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
export const MOD = isApple ? '⌘' : 'Ctrl';

export const SHORTCUTS = [
  { keys: `${MOD} K`, label: 'Search' },
  { keys: `${MOD} 1 … 5`, label: 'Home, Chats, AI, Tasks, Notes' },
  { keys: `${MOD} [`, label: 'Back' },
  { keys: `${MOD} ,`, label: 'Settings' },
  { keys: `${MOD} ⇧ N`, label: 'Notifications' },
  { keys: `${MOD} /`, label: 'Keyboard shortcuts' },
  { keys: 'Esc', label: 'Close a sheet, leave a field, go back' },
];

/**
 * What a key press asks for, or null. `tabs` is the list of visible tabs in order.
 * Returns { kind: 'tab', tab } | { kind: 'search' } | { kind: 'back' } | { kind: 'settings' }
 *   | { kind: 'notifications' } | { kind: 'help' }.
 */
export function shortcutFor(e, tabs = []) {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod || e.altKey) return null;
  const key = String(e.key || '').toLowerCase();
  if (e.shiftKey) {
    if (key === 'n') return { kind: 'notifications' };
    return null;
  }
  if (key === 'k') return { kind: 'search' };
  if (key === '[') return { kind: 'back' };
  if (key === ',') return { kind: 'settings' };
  if (key === '/') return { kind: 'help' };
  if (/^[1-9]$/.test(key)) {
    const tab = tabs[Number(key) - 1];
    return tab ? { kind: 'tab', tab } : null;
  }
  return null;
}
