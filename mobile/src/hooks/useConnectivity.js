import { useEffect, useState } from 'react';
import { isOnline, onConnectivityChange } from '../services/connectivity';
import { getSocketStatus, onSocketStatus } from '../services/socket';
import { getQueueLength, onQueueChange } from '../services/offlineQueue';

export function useConnectivity() {
  const [online, setOnline] = useState(isOnline());
  const [socketStatus, setSocketStatus] = useState(getSocketStatus());
  const [queued, setQueued] = useState(getQueueLength());
  useEffect(() => {
    const a = onConnectivityChange(setOnline);
    const b = onSocketStatus(setSocketStatus);
    const c = onQueueChange(setQueued);
    return () => { a(); b(); c(); };
  }, []);
  return { online, socketStatus, queued };
}
