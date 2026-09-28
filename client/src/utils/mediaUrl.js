import { useCallback, useEffect, useState } from 'react';
import api, { API_BASE } from '../services/api';
import { toProxyUrl } from './gcsProxy';

// Stored files are served by the API and need authorization, which <img>/<video>/<audio>
// cannot send. The API signs a short-lived URL per file; cache it until shortly before
// it expires so a conversation with many attachments signs each file once.
const cache = new Map(); // objectPath -> { url, refreshAt }
const inflight = new Map();

function objectPathOf(proxyUrl) {
    if (!proxyUrl || !proxyUrl.startsWith('/api/v2/uploads/file')) return null;
    return new URLSearchParams(proxyUrl.split('?')[1] || '').get('path');
}

export async function getMediaUrl(attachment, { fresh = false } = {}) {
    const proxyUrl = toProxyUrl(attachment || {});
    const objectPath = objectPathOf(proxyUrl);
    if (!objectPath) return proxyUrl || null; // external or legacy URL: use as-is

    if (fresh) cache.delete(objectPath);
    const hit = cache.get(objectPath);
    if (hit && hit.refreshAt > Date.now()) return hit.url;
    if (inflight.has(objectPath)) return inflight.get(objectPath);

    const p = api.get('/api/v2/uploads/sign', { params: { path: objectPath } })
        .then(({ data }) => {
            const url = `${API_BASE}${data.url}`;
            const refreshAt = new Date(data.expiresAt).getTime() - 60_000;
            cache.set(objectPath, { url, refreshAt });
            return url;
        })
        .finally(() => inflight.delete(objectPath));
    inflight.set(objectPath, p);
    return p;
}

/**
 * { url, error, refresh } for an attachment; url is null until signed. Signed links
 * expire (10 min): call refresh() when a media element fails to load, to get a new one.
 * refresh() resolves with the new URL (or null when it can't be signed again).
 */
export function useMediaUrl(attachment) {
    const key = toProxyUrl(attachment || {});
    const [state, setState] = useState({ url: null, error: null });
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let cancelled = false;
        if (!key) { setState({ url: null, error: null }); return undefined; }
        getMediaUrl(attachment, { fresh: attempt > 0 })
            .then((url) => { if (!cancelled) setState({ url, error: null }); })
            .catch((err) => { if (!cancelled) setState({ url: null, error: err }); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, attempt]);
    const refresh = useCallback(() => setAttempt((n) => n + 1), []);
    return { ...state, refresh, attempt };
}

export function __resetMediaUrlCacheForTests() {
    cache.clear();
    inflight.clear();
}
