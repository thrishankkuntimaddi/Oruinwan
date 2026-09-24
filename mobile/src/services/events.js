/** Tiny synchronous event bus for non-React modules (toasts, auth failure, DM list refresh). */
const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of Array.from(set)) {
    try { fn(payload); } catch (e) { console.warn(`[events] ${event} handler failed:`, e?.message); }
  }
}

export function toast(message, type = 'info') {
  emit('toast', { message, type });
}
