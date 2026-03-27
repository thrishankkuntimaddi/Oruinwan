/**
 * Chttrix Mobile — Offline Queue Hook
 *
 * Watches network connectivity. When the device goes offline, any actions
 * dispatched through this hook are persisted to AsyncStorage.
 * When connectivity is restored, the queue is flushed in order.
 */
import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { enqueueAction, getQueue, clearQueue } from '../services/storage';
import { sendMessage } from '../services/api';

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(true);
  const [queueLength, setQueueLength] = useState(0);

  // ── Network monitoring ────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);

      if (online) {
        flushQueue();
      }
    });
    return () => unsub();
  }, []);

  // ── Flush queued actions when back online ─────────────────────────────────
  const flushQueue = useCallback(async () => {
    const queue = await getQueue();
    if (queue.length === 0) return;

    console.log(`[OfflineQueue] Flushing ${queue.length} queued action(s)`);

    for (const action of queue) {
      try {
        await processAction(action);
      } catch (err) {
        console.warn('[OfflineQueue] Failed to process action:', err.message);
        // Leave remaining in queue on partial failure
        return;
      }
    }

    await clearQueue();
    setQueueLength(0);
    console.log('[OfflineQueue] Flush complete');
  }, []);

  // ── Dispatch an action (queues if offline, sends immediately if online) ───
  const dispatch = useCallback(
    async (action) => {
      if (isOnline) {
        return processAction(action);
      } else {
        await enqueueAction(action);
        const q = await getQueue();
        setQueueLength(q.length);
        console.log(`[OfflineQueue] Queued action: ${action.type}`);
      }
    },
    [isOnline]
  );

  return { isOnline, queueLength, dispatch };
}

// ─── Action Processor ──────────────────────────────────────────────────────────

async function processAction(action) {
  switch (action.type) {
    case 'SEND_MESSAGE':
      await sendMessage(action.payload);
      break;
    default:
      console.warn('[OfflineQueue] Unknown action type:', action.type);
  }
}
