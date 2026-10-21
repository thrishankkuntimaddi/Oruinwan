import React, { useEffect, useState } from 'react';
import { ShieldOff } from 'lucide-react';
import api from '../../services/api';
import logger from '../../utils/logger';
import './integrations.css';

/**
 * Slack / Teams outgoing bridge, client side.
 *
 * Messages are end-to-end encrypted, so the server cannot forward them. For a
 * channel an admin bridged "out" (after an explicit warning), the sender's app
 * — which has the plaintext — posts it to /bridge/relay right after sending.
 * Nothing is relayed for any other channel. See docs/integrations.md.
 */

const BASE = '/api/v2/integrations';
const TTL_MS = 60_000;
const cache = new Map(); // workspaceId -> { at, promise }

/** Map channelId -> { outgoing, providers[] } for a workspace (cached for a minute). */
export function bridgedChannels(workspaceId) {
    if (!workspaceId) return Promise.resolve(new Map());
    const hit = cache.get(workspaceId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
    const promise = api.get(`${BASE}/bridge/channels`, { params: { workspaceId } })
        .then(({ data }) => new Map((data?.channels || []).map((c) => [String(c.channelId), c])))
        .catch(() => new Map()); // flag off / not a member / offline: nothing is bridged
    cache.set(workspaceId, { at: Date.now(), promise });
    return promise;
}

export const clearBridgeCache = () => cache.clear();

/**
 * After a channel message was sent: relay its plaintext when (and only when)
 * the channel has an acknowledged outgoing bridge. Never throws.
 */
export async function relayIfBridged({ workspaceId, channelId, messageId, text }) {
    try {
        if (!workspaceId || !channelId || !messageId || typeof text !== 'string' || !text.trim()) return null;
        const entry = (await bridgedChannels(workspaceId)).get(String(channelId));
        if (!entry?.outgoing) return null;
        const { data } = await api.post(`${BASE}/bridge/relay`, { workspaceId, channelId, messageId: String(messageId), text });
        return data;
    } catch (err) {
        logger.warn('[bridge] relay failed:', err?.response?.data?.message || err?.message);
        return null;
    }
}

export function useChannelBridge(workspaceId, channelId) {
    const [entry, setEntry] = useState(null);
    useEffect(() => {
        let alive = true;
        if (!workspaceId || !channelId) { setEntry(null); return undefined; }
        bridgedChannels(workspaceId).then((m) => { if (alive) setEntry(m.get(String(channelId)) || null); });
        return () => { alive = false; };
    }, [workspaceId, channelId]);
    return entry;
}

/** One-line notice above the composer of a channel whose messages are copied out. */
export function BridgeNotice({ workspaceId, channelId }) {
    const entry = useChannelBridge(workspaceId, channelId);
    if (!entry?.outgoing) return null;
    const names = [...new Set(entry.providers.filter((p) => p.direction !== 'in').map((p) => p.label))].join(' and ');
    return (
        <div className="oi-bridge-notice" role="note" data-testid="bridge-notice">
            <ShieldOff size={12} aria-hidden="true" />
            <span>Messages you send here are also copied to {names}. Those copies are not end-to-end encrypted.</span>
        </div>
    );
}
