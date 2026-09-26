import { useEffect, useState } from 'react';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';

// Per-workspace feature switches set by workspace admins (the server enforces them;
// this hides the controls). Everything is on until the server says otherwise.
const DEFAULTS = { tasks: true, notes: true, polls: true, ai: true, huddles: true, fileUploads: true, reactions: true, threads: true, bookmarks: true, reminders: true };
const cache = new Map();

export function useWorkspaceFeatures(workspaceId) {
    const [features, setFeatures] = useState(() => cache.get(String(workspaceId)) || DEFAULTS);
    const { socket } = useSocket() || {};

    useEffect(() => {
        if (!workspaceId) { setFeatures(DEFAULTS); return undefined; }
        let cancelled = false;
        api.get(`/api/workspaces/${workspaceId}/features`)
            .then(({ data }) => {
                const next = { ...DEFAULTS, ...(data?.featureToggles || {}) };
                cache.set(String(workspaceId), next);
                if (!cancelled) setFeatures(next);
            })
            .catch(() => { /* keep defaults; the server still enforces */ });
        return () => { cancelled = true; };
    }, [workspaceId]);

    useEffect(() => {
        if (!socket || !workspaceId) return undefined;
        const onUpdate = (payload) => {
            if (String(payload?.workspaceId) !== String(workspaceId) || !payload?.featureToggles) return;
            const next = { ...DEFAULTS, ...payload.featureToggles };
            cache.set(String(workspaceId), next);
            setFeatures(next);
        };
        socket.on('workspace-features-updated', onUpdate);
        socket.on('permissions:updated', onUpdate);
        return () => {
            socket.off('workspace-features-updated', onUpdate);
            socket.off('permissions:updated', onUpdate);
        };
    }, [socket, workspaceId]);

    return features;
}
