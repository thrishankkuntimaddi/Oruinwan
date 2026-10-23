import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@services/api';

/**
 * Every file the signed-in person can open in a workspace: attachments from their
 * channels, DMs and group DMs plus files uploaded to the library
 * (GET /api/v2/files/shared). Chat attachments keep their stored url, so they open
 * through the same signed links the conversation uses.
 */
export const SHARED_API = '/api/v2/files/shared';
export const PAGE_SIZE = 50;

export const KIND_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'image', label: 'Images' },
    { value: 'document', label: 'Documents' },
    { value: 'media', label: 'Media' },
    { value: 'other', label: 'Other' },
];

export const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'name', label: 'Name (A–Z)' },
    { value: 'size', label: 'Largest first' },
];

/**
 * Query params for the endpoint. `source` is 'all' | 'library' | 'channels' | 'dms'
 * or 'conv:<conversationId>' for one channel or DM.
 */
export function sharedFilesParams({ workspaceId, kind = 'all', source = 'all', q = '', sort = 'newest', offset = 0, limit = PAGE_SIZE } = {}) {
    const params = { workspaceId, sort, offset, limit };
    if (kind && kind !== 'all') params.kind = kind;
    if (source?.startsWith('conv:')) params.conversationId = source.slice(5);
    else if (source && source !== 'all') params.source = source;
    const term = String(q || '').trim();
    if (term) params.q = term;
    return params;
}

/** Where a file was shared, for display: "#general", "Ben" (DM), "Files". */
export function whereLabel(item) {
    if (!item || item.source === 'library' || !item.conversation) return 'Files';
    const c = item.conversation;
    if (c.type === 'channel') return `#${c.name || 'channel'}`;
    return c.name || 'Direct message';
}

/** In-app link to the message that carries a chat attachment (null for library files). */
export function messageLink(item, workspaceId) {
    if (!item?.messageId || !item.conversation?.id || !workspaceId) return null;
    const kind = item.conversation.type === 'channel' ? 'channel' : 'dm';
    const params = new URLSearchParams({ message: item.messageId });
    if (item.parentId) params.set('thread', item.parentId);
    return `/workspace/${workspaceId}/${kind}/${item.conversation.id}?${params.toString()}`;
}

/** The attachment object the chat's viewers and download helper expect. */
export function toAttachment(item) {
    if (!item) return null;
    return {
        type: item.type || 'file', url: item.url, name: item.name, size: item.size, mimeType: item.mimeType,
        width: item.width || undefined, height: item.height || undefined, duration: item.duration || undefined,
    };
}

export function useSharedFiles(workspaceId, filters) {
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const requestRef = useRef(0);
    const { kind, source, q, sort } = filters || {};

    const load = useCallback(async () => {
        if (!workspaceId) return;
        const request = ++requestRef.current;
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get(SHARED_API, { params: sharedFilesParams({ workspaceId, kind, source, q, sort }) });
            if (request !== requestRef.current) return;
            setItems(data.items || []);
            setTotal(data.total || 0);
            setHasMore(!!data.hasMore);
            if (Array.isArray(data.conversations)) setConversations(data.conversations);
        } catch (err) {
            if (request !== requestRef.current) return;
            setError(err?.response?.data?.message || 'Couldn’t load files');
        } finally {
            if (request === requestRef.current) {
                setLoading(false);
                setLoaded(true);
            }
        }
    }, [workspaceId, kind, source, q, sort]);

    const loadMore = useCallback(async () => {
        if (!workspaceId || loadingMore || !hasMore) return;
        const request = requestRef.current;
        setLoadingMore(true);
        try {
            const { data } = await api.get(SHARED_API, { params: sharedFilesParams({ workspaceId, kind, source, q, sort, offset: items.length }) });
            if (request !== requestRef.current) return;
            setItems((prev) => {
                const seen = new Set(prev.map((i) => i.id));
                return [...prev, ...(data.items || []).filter((i) => !seen.has(i.id))];
            });
            setTotal(data.total || 0);
            setHasMore(!!data.hasMore);
        } catch (err) {
            if (request === requestRef.current) setError(err?.response?.data?.message || 'Couldn’t load more files');
        } finally {
            setLoadingMore(false);
        }
    }, [workspaceId, kind, source, q, sort, items.length, hasMore, loadingMore]);

    useEffect(() => { load(); }, [load]);

    /** Drop one item locally (after deleting a library file). */
    const removeItem = useCallback((id) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
        setTotal((n) => Math.max(0, n - 1));
    }, []);

    return { items, total, hasMore, conversations, loading, loadingMore, error, loaded, reload: load, loadMore, removeItem };
}
