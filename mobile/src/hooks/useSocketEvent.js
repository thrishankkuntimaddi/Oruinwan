import { useEffect, useRef } from 'react';
import { subscribe, connectSocket } from '../services/socket';

/**
 * Subscribe to a socket event for the lifetime of the component.
 * Subscription is synchronous (module registry), so there is no async-setup /
 * sync-teardown race; the latest handler is always called.
 */
export function useSocketEvent(event, handler, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return undefined;
    const fn = (...args) => ref.current?.(...args);
    const unsubscribe = subscribe(event, fn);
    connectSocket().catch(() => {});
    return unsubscribe;
  }, [event, enabled]);
}
