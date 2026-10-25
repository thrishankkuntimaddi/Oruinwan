// Tiny synchronous event bus for cross-cutting signals (toasts, auth expiry, reconnects).
const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function emit(event, payload) {
  for (const fn of [...(listeners.get(event) ?? [])]) {
    try {
      fn(payload);
    } catch (err) {
      console.error(`[bus] ${event} listener failed`, err);
    }
  }
}

/** A short message at the bottom. `action`: { label, onPress } adds a button (Undo). */
export function toast(message, tone = 'neutral', { action } = {}) {
  emit('toast', { message, tone, action, id: Math.random().toString(36).slice(2) });
}
