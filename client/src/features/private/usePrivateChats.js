import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { createPrivateChats, indexedDbStore, memoryStore } from '@platform/crypto/privateChatClient.js';

/** /api/private over the app's axios client (tokens, refresh, base URL). */
export const privateHttp = {
    get: (path, query) => api.get(`/api/private${path}`, { params: query }).then((r) => r.data),
    post: (path, body) => api.post(`/api/private${path}`, body).then((r) => r.data),
    put: (path, body) => api.put(`/api/private${path}`, body).then((r) => r.data),
    del: (path) => api.delete(`/api/private${path}`).then((r) => r.data),
};

// Errors from axios carry the status where the shared client expects it.
const withStatus = (http) => Object.fromEntries(Object.entries(http).map(([k, fn]) => [k, (...a) => fn(...a).catch((err) => {
    const e = new Error(err?.response?.data?.message || err?.message || 'Request failed');
    e.status = err?.response?.status;
    e.code = err?.response?.data?.code;
    throw e;
})]));

const clients = new Map(); // one per signed-in user, so device keys load once

/** The shared private-chat client (platform/crypto/privateChatClient.js) for the signed-in user. */
export function usePrivateChats() {
    const { user } = useAuth();
    const userId = user ? String(user._id || user.id || user.sub || '') : '';
    const client = useMemo(() => {
        if (!userId) return null;
        if (!clients.has(userId)) {
            const store = typeof indexedDB !== 'undefined' ? indexedDbStore('web') : memoryStore();
            const label = typeof window !== 'undefined' && window.oruinwanDesktop ? 'Desktop app' : 'Web browser';
            clients.set(userId, createPrivateChats({ http: withStatus(privateHttp), userId, store, label }));
        }
        return clients.get(userId);
    }, [userId]);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!client) return undefined;
        let cancelled = false;
        client.ensureDevice()
            .then(() => { if (!cancelled) setReady(true); })
            .catch((err) => { if (!cancelled) setError(err?.message || 'Could not set up private chats on this device'); });
        return () => { cancelled = true; };
    }, [client]);
    return { client, ready, error, userId };
}
