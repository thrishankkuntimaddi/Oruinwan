import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { enqueueAction, getQueue, clearQueue } from '../services/storage';
import { updateTask } from '../services/api';
import { socketSendMessage } from '../services/socket';

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(true);
  const [queueLength, setQueueLength] = useState(0);

  
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      if (online) flushQueue();
    });
    return () => unsub();
  }, []);

  
  const flushQueue = useCallback(async () => {
    const queue = await getQueue();
    if (queue.length === 0) return;

    console.log(`[OfflineQueue] Flushing ${queue.length} action(s)`);

    for (const action of queue) {
      try {
        await processAction(action);
      } catch (err) {
        console.warn('[OfflineQueue] Action failed:', err.message);
        return; 
      }
    }

    await clearQueue();
    setQueueLength(0);
    console.log('[OfflineQueue] Flush complete');
  }, []);

  
  const dispatch = useCallback(
    async (action) => {
      if (isOnline) {
        return processAction(action);
      } else {
        await enqueueAction(action);
        const q = await getQueue();
        setQueueLength(q.length);
        console.log(`[OfflineQueue] Queued: ${action.type}`);
      }
    },
    [isOnline]
  );

  return { isOnline, queueLength, dispatch };
}

async function processAction(action) {
  switch (action.type) {
    case 'SEND_MESSAGE':
      
      socketSendMessage(action.payload);
      break;

    case 'UPDATE_TASK':
      
      await updateTask(action.payload.taskId, action.payload.updates);
      break;

    default:
      console.warn('[OfflineQueue] Unknown action type:', action.type);
  }
}
