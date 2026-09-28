import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '@services/api';
import { useSocket } from '../../contexts/SocketContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications, notificationHref } from '../notifications/NotificationsContext';
import { conversationInPath } from '../notifications/notificationPolicy';
import { decryptTextOrNull } from '../../services/messageEncryptionService';
import logger from '../../utils/logger';
import {
    activityHref, buildActivityRows, clearMention, convKey, metaFromActivityEvent, metaFromServerItem,
} from './activityModel';

const PREVIEW_MAX = 120;
const clip = (t) => (t && t.length > PREVIEW_MAX ? `${t.slice(0, PREVIEW_MAX - 1)}…` : t);

async function decryptPreview(preview, id, type) {
    if (!preview?.ciphertext) return null;
    try {
        const text = await decryptTextOrNull(preview.ciphertext, preview.messageIv, String(id), type);
        return text ? clip(text) : 'Encrypted message';
    } catch {
        return 'Encrypted message';
    }
}

/**
 * Home → Activity data. Reuses NotificationsContext for unread counts (the
 * rail badges' numbers), mention flags and the bell list; adds a snapshot of
 * unread conversations (GET /api/v2/messages/workspace/:id/activity) whose
 * previews are decrypted here, and keeps it live over the socket.
 *
 * `base`: 'home' (desktop Home layout routes) or 'app' (Messages/Channels routes).
 */
export default function useHomeActivity({ base = 'home' } = {}) {
    const { activeWorkspace } = useWorkspace();
    const workspaceId = activeWorkspace?.id || null;
    const { user } = useAuth();
    const currentUserId = user?.sub || user?._id || null;
    const { socket, addNotificationListener } = useSocket() || {};
    const notif = useNotifications();
    const location = useLocation();
    const navigate = useNavigate();

    const [conversations, setConversations] = useState(() => new Map());
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const convRef = useRef(conversations);
    convRef.current = conversations;
    const wsRef = useRef(workspaceId);
    wsRef.current = workspaceId;
    const seedRef = useRef(notif?.seedConversationUnread);
    seedRef.current = notif?.seedConversationUnread;

    const patch = useCallback((key, fn) => {
        setConversations((prev) => {
            const next = new Map(prev);
            const value = fn(prev.get(key));
            if (value) next.set(key, value); else next.delete(key);
            return next;
        });
    }, []);

    // ── Snapshot ──────────────────────────────────────────────────────────
    const fetchSeq = useRef(0);
    const load = useCallback(async () => {
        if (!workspaceId) return;
        const seq = ++fetchSeq.current;
        setLoading(true);
        try {
            const { data } = await api.get(`/api/v2/messages/workspace/${workspaceId}/activity`);
            if (seq !== fetchSeq.current || wsRef.current !== workspaceId) return;
            const items = Array.isArray(data?.items) ? data.items : [];
            // Same numbers as the Messages / Channels panels → rail badges agree.
            seedRef.current?.('dm', items.filter(i => i.type === 'dm').map(i => ({ id: String(i.id), unread: i.unread })));
            seedRef.current?.('channel', items.filter(i => i.type === 'channel').map(i => ({ id: String(i.id), unread: i.unread })));

            const metas = await Promise.all(items.map(async (item) => {
                const meta = metaFromServerItem(item);
                if (!meta) return null;
                const text = await decryptPreview(item.lastMessage?.preview, meta.id, meta.type);
                if (text) meta.last = { ...meta.last, text };
                return meta;
            }));
            if (seq !== fetchSeq.current || wsRef.current !== workspaceId) return;
            setConversations((prev) => {
                const next = new Map();
                for (const meta of metas) {
                    if (!meta) continue;
                    const key = convKey(meta.type, meta.id);
                    const live = prev.get(key);
                    // A live event newer than the snapshot wins.
                    const keepLive = live?.last?.at && meta.last?.at && new Date(live.last.at) > new Date(meta.last.at);
                    next.set(key, keepLive ? { ...meta, last: live.last, mentioned: meta.mentioned || live.mentioned, directMention: meta.directMention || live.directMention } : meta);
                }
                // Conversations that only arrived live (after the snapshot was taken).
                for (const [key, live] of prev) if (!next.has(key) && live?.live) next.set(key, live);
                return next;
            });
        } catch (err) {
            logger.warn('[HomeActivity] load failed:', err?.message);
        } finally {
            if (seq === fetchSeq.current) {
                setLoading(false);
                setLoaded(true);
            }
        }
    }, [workspaceId]);

    useEffect(() => {
        setConversations(new Map());
        setLoaded(false);
        load();
    }, [load]);

    const reloadTimer = useRef(null);
    const scheduleReload = useCallback(() => {
        clearTimeout(reloadTimer.current);
        reloadTimer.current = setTimeout(load, 400);
    }, [load]);
    useEffect(() => () => clearTimeout(reloadTimer.current), []);

    // Back to the tab: catch up (events may have been throttled in the background).
    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === 'visible') scheduleReload(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [scheduleReload]);

    // ── Live ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!addNotificationListener) return undefined;
        return addNotificationListener(async (event, payload) => {
            if (!payload) return;
            if (event === 'conversation:read') {
                if (payload.conversationType && payload.conversationId) {
                    patch(convKey(payload.conversationType, String(payload.conversationId)), clearMention);
                }
                return;
            }
            if (event !== 'conversation:activity') return;
            if (!wsRef.current || String(payload.workspaceId) !== String(wsRef.current)) return;
            if (currentUserId && String(payload.senderId) === String(currentUserId)) return;
            const type = payload.conversationType;
            const id = String(payload.conversationId || '');
            if (!id || (type !== 'dm' && type !== 'channel')) return;
            const text = payload.kindLabel || await decryptPreview(payload.preview, id, type);
            patch(convKey(type, id), (prev) => ({ ...metaFromActivityEvent(prev, payload, text), live: true }));
        });
    }, [addNotificationListener, patch, currentUserId]);

    useEffect(() => {
        if (!socket) return undefined;
        // A deleted preview message must not linger: refresh from the server.
        const onDeleted = (e) => {
            const id = String(e?.messageId || e?._id || '');
            if (!id) return;
            for (const meta of convRef.current.values()) {
                if (meta?.last?.id === id) { scheduleReload(); return; }
            }
        };
        let wasDisconnected = false;
        const onDisconnect = () => { wasDisconnected = true; };
        const onConnect = () => { if (wasDisconnected) { wasDisconnected = false; scheduleReload(); } };
        socket.on('message-deleted', onDeleted);
        socket.on('message:deleted', onDeleted);
        socket.on('disconnect', onDisconnect);
        socket.on('connect', onConnect);
        return () => {
            socket.off('message-deleted', onDeleted);
            socket.off('message:deleted', onDeleted);
            socket.off('disconnect', onDisconnect);
            socket.off('connect', onConnect);
        };
    }, [socket, scheduleReload]);

    // ── Rows ──────────────────────────────────────────────────────────────
    const openConversation = conversationInPath(location.pathname);
    const openKey = openConversation ? convKey(openConversation.type, openConversation.id) : '';
    const getUnread = notif?.getUnread;
    const hasMention = notif?.hasMention;
    const notifications = notif?.notifications;
    const rows = useMemo(() => buildActivityRows({
        conversations,
        unreadOf: getUnread,
        mentionOf: hasMention,
        notifications,
        openConversation: openKey ? { type: openKey.split(':')[0], id: openKey.split(':')[1] } : null,
        currentUserId,
        workspaceId,
    }), [conversations, getUnread, hasMention, notifications, openKey, currentUserId, workspaceId]);

    const markRead = notif?.markRead;
    const clearConversationUnread = notif?.clearConversationUnread;
    const open = useCallback((row) => {
        if (!row) return;
        const href = activityHref(row, workspaceId, { base, notificationHref });
        // Bell items for this row are read now; the conversation itself is
        // marked read by the chat window once it opens (→ conversation:read).
        for (const nid of row.notificationIds || []) if (nid) markRead?.(nid);
        if (row.kind === 'dm' || row.kind === 'channel') {
            clearConversationUnread?.(row.convType, row.convId);
            patch(row.key, clearMention);
        }
        if (href) {
            navigate(href, row.kind === 'thread' && row.parentMessageId
                ? { state: { openThreadId: row.parentMessageId } }
                : undefined);
        }
    }, [workspaceId, base, markRead, clearConversationUnread, navigate, patch]);

    return { rows, loading: loading && !loaded, loaded, open, reload: load, workspaceId };
}
