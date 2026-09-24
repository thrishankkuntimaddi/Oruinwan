/**
 * Thin React binding over the singleton queue in services/offlineQueue.js.
 * dispatch() runs the action immediately when online and falls back to the
 * queue on network failure; offline it enqueues directly.
 */
import { useCallback } from 'react';
import { enqueue, flush } from '../services/offlineQueue';
import { isOnline } from '../services/connectivity';
import { isNetworkError } from '../services/http';
import { useConnectivity } from './useConnectivity';

export function useOfflineQueue() {
  const { online, queued } = useConnectivity();

  const dispatch = useCallback(async (action, runNow) => {
    if (isOnline() && runNow) {
      try {
        return { queued: false, result: await runNow() };
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }
    const item = await enqueue(action);
    return { queued: true, item };
  }, []);

  return { isOnline: online, queueLength: queued, dispatch, flush };
}
