import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '@services/api';
import { useSocket } from '../../contexts/SocketContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDesktopNotification } from './useDesktopNotification';
import logger from '../../utils/logger';
import { useToast } from '../../contexts/ToastContext';
import { decryptTextOrNull } from '../../services/messageEncryptionService';
import { NOTIFICATION_PREF_DEFAULTS, PREFS_EVENT, fetchAccountNotificationPrefs } from './accountNotificationPrefs';

const NotificationsContext = createContext(null);

export function useNotifications() {
    return useContext(NotificationsContext);
}

const convKey = (type, id) => `${type}:${id}`;
const PREVIEW_MAX = 90;

function clip(text) {
    if (!text) return '';
    return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text;
}

/** Route for a conversation inside the current workspace. */
function conversationPath(workspaceId, type, id) {
    return type === 'dm'
        ? `/workspace/${workspaceId}/messages/dm/${id}`
        : `/workspace/${workspaceId}/channel/${id}`;
}

/**
 * Where a stored notification points. Task links are absolute
 * (/workspace/<ws>/tasks/<id>); older ones are relative to the workspace.
 */
export function notificationHref(n, workspaceId) {
    const link = n?.link;
    if (!link || typeof link !== 'string') return null;
    if (link.startsWith('/workspace/')) return link;
    const ws = n.workspaceId || workspaceId;
    if (!ws) return null;
    return `/workspace/${ws}${link.startsWith('/') ? link : `/${link}`}`;
}

/** The conversation open in the URL, if any ({ type: 'dm'|'channel', id }). */
function conversationInPath(pathname) {
    const m = /\/(dm|channel)\/([a-f0-9]{24})(?:\/|$)/.exec(pathname || '');
    return m ? { type: m[1], id: m[2] } : null;
}

/** Does this stored notification belong to that conversation? */
function isAboutConversation(n, conv) {
    if (!conv) return false;
    const meta = n?.meta || {};
    if (conv.type === 'dm') return String(meta.dmSessionId || '') === conv.id;
    return String(meta.channelId || '') === conv.id && !meta.dmSessionId;
}

/** Is the given conversation the one currently on screen? */
function isViewing(pathname, type, id) {
    if (!id) return false;
    return pathname.includes(`/${type}/${id}`);
}

export function NotificationsProvider({ children }) {
    const { addNotificationListener, socket } = useSocket();
    const { activeWorkspace } = useWorkspace();
    const { accessToken, user } = useAuth();
    const { triggerDesktopNotification } = useDesktopNotification();
    const { showToast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [page, setPage] = useState(1);

    // Unread message counts per conversation ("dm:<id>" / "channel:<id>"),
    // seeded by the side panels from the list endpoints and kept live here.
    const [conversationUnread, setConversationUnread] = useState({});
    const [mentionedConversations, setMentionedConversations] = useState({});

    const workspaceId = activeWorkspace?.id;
    const currentUserId = user?.sub || user?._id;
    const pathnameRef = useRef(location.pathname);
    pathnameRef.current = location.pathname;
    const currentWorkspaceRef = useRef(workspaceId);
    currentWorkspaceRef.current = workspaceId;
    const seenNotificationIdsRef = useRef(new Set());

    // Account-level alert preferences (Settings → Notifications).
    const prefsRef = useRef({ ...NOTIFICATION_PREF_DEFAULTS });
    useEffect(() => {
        if (!accessToken) return undefined;
        let cancelled = false;
        fetchAccountNotificationPrefs()
            .then((p) => { if (!cancelled) prefsRef.current = p; })
            .catch((err) => logger.warn('[NotificationsContext] prefs load failed:', err?.message));
        const onPrefs = (e) => { if (e?.detail) prefsRef.current = { ...prefsRef.current, ...e.detail }; };
        window.addEventListener(PREFS_EVENT, onPrefs);
        return () => { cancelled = true; window.removeEventListener(PREFS_EVENT, onPrefs); };
    }, [accessToken]);
    useEffect(() => {
        seenNotificationIdsRef.current = new Set(notifications.map(n => n._id).filter(Boolean));
    }, [notifications]);

    // Bell badge + per-conversation unread both count toward the desktop badge.
    const totalConversationUnread = useMemo(
        () => Object.values(conversationUnread).reduce((a, b) => a + b, 0),
        [conversationUnread]
    );
    useEffect(() => {
        window.chttrixDesktop?.setUnreadCount(unreadCount + totalConversationUnread);
    }, [unreadCount, totalConversationUnread]);

    // Decrypt the E2EE preview stored on dm/mention notifications so the bell
    // shows the actual text instead of "Sent you a message".
    const enrichPreview = useCallback(async (n) => {
        const p = n?.meta?.preview;
        const convType = n?.meta?.dmSessionId ? 'dm' : (n?.meta?.channelId ? 'channel' : null);
        const convId = n?.meta?.dmSessionId || n?.meta?.channelId;
        if (!p?.ciphertext || !p?.messageIv || !convType || !convId) return n;
        try {
            const text = await decryptTextOrNull(p.ciphertext, p.messageIv, String(convId), convType);
            if (!text) return n;
            const where = n.type === 'mention' && n.meta?.channelName ? `in #${n.meta.channelName} — ` : '';
            return { ...n, body: `${where}${clip(text)}` };
        } catch {
            return n;
        }
    }, []);

    const fetchNotifications = useCallback(async (pg = 1, append = false) => {
        if (!workspaceId || !accessToken) return;
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get('/api/notifications', {
                params: { workspaceId, page: pg, limit: 30 },
            });
            if (currentWorkspaceRef.current !== workspaceId) return;
            const incoming = await Promise.all((data.notifications || []).map(enrichPreview));
            if (currentWorkspaceRef.current !== workspaceId) return;
            setNotifications(prev => {
                if (!append) return incoming;
                const seen = new Set(prev.map(n => n._id));
                return [...prev, ...incoming.filter(n => !seen.has(n._id))];
            });
            setUnreadCount(data.unreadCount || 0);
            setHasMore(pg < data.pages);
            setPage(pg);
        } catch (err) {
            if (currentWorkspaceRef.current !== workspaceId) return;
            logger.error('[NotificationsContext] fetch error:', err);
            setError(err?.response?.data?.message || 'Could not load notifications');
        } finally {
            if (currentWorkspaceRef.current === workspaceId) setLoading(false);
        }
    }, [workspaceId, accessToken, enrichPreview]);

    useEffect(() => {
        setNotifications([]);
        setPage(1);
        setConversationUnread({});
        setMentionedConversations({});
        fetchNotifications(1, false);
    }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadMore = useCallback(() => {
        if (!hasMore || loading) return;
        fetchNotifications(page + 1, true);
    }, [hasMore, loading, page, fetchNotifications]);

    // ── Per-conversation unread ────────────────────────────────────────────
    const seedConversationUnread = useCallback((type, entries) => {
        setConversationUnread(prev => {
            const next = { ...prev };
            for (const { id, unread } of entries || []) {
                if (!id) continue;
                const k = convKey(type, id);
                // Never drop a live increment that arrived before the seed.
                next[k] = Math.max(Number(unread) || 0, prev[k] || 0);
                if (!next[k]) delete next[k];
            }
            return next;
        });
    }, []);

    const clearConversationUnread = useCallback((type, id) => {
        if (!id) return;
        const k = convKey(type, id);
        setConversationUnread(prev => {
            if (!prev[k]) return prev;
            const next = { ...prev };
            delete next[k];
            return next;
        });
        setMentionedConversations(prev => {
            if (!prev[k]) return prev;
            const next = { ...prev };
            delete next[k];
            return next;
        });
    }, []);

    const getUnread = useCallback((type, id) => conversationUnread[convKey(type, id)] || 0, [conversationUnread]);
    const hasMention = useCallback((type, id) => !!mentionedConversations[convKey(type, id)], [mentionedConversations]);

    const unreadTotals = useMemo(() => {
        const totals = { dm: 0, channel: 0 };
        for (const [k, n] of Object.entries(conversationUnread)) {
            const type = k.split(':')[0];
            if (totals[type] !== undefined) totals[type] += n;
        }
        return totals;
    }, [conversationUnread]);

    const notifyNative = useCallback((title, body, route = {}) => {
        const prefs = prefsRef.current;
        if (!prefs.desktopPush) return;
        try {
            if (window.chttrixDesktop) {
                window.chttrixDesktop.notify({ type: route.type || 'system', title, body, silent: !prefs.sound, ...route });
            } else {
                triggerDesktopNotification(title, body, undefined, { silent: !prefs.sound });
            }
        } catch (err) {
            logger.warn('[NotificationsContext] native notification failed:', err);
        }
    }, [triggerDesktopNotification]);

    // New message anywhere in the workspace: bump the badge and, for DMs and
    // mentions, show a compact toast (unless that conversation is on screen).
    useEffect(() => {
        const unsubscribe = addNotificationListener(async (event, payload) => {
            if (event === 'conversation:read') {
                if (payload?.conversationType && payload?.conversationId) {
                    clearConversationUnread(payload.conversationType, String(payload.conversationId));
                }
                return;
            }
            if (event !== 'conversation:activity' || !payload) return;
            if (String(payload.workspaceId) !== String(workspaceId)) return;
            if (String(payload.senderId) === String(currentUserId)) return;

            const { conversationType: type, conversationId: id } = payload;
            const viewing = isViewing(pathnameRef.current, type, id) && document.visibilityState === 'visible';
            if (viewing) return;

            const k = convKey(type, id);
            setConversationUnread(prev => ({ ...prev, [k]: (prev[k] || 0) + 1 }));
            if (payload.isMention) setMentionedConversations(prev => ({ ...prev, [k]: true }));

            const wantsAlert = type === 'dm' ? prefsRef.current.dmNotifications !== false : !!payload.isMention;
            if (!wantsAlert) return;

            let text = payload.kindLabel || null;
            if (!text && payload.preview?.ciphertext) {
                text = await decryptTextOrNull(payload.preview.ciphertext, payload.preview.messageIv, String(id), type);
            }
            const body = clip(text) || 'New message';
            const sender = payload.senderUsername || 'Someone';
            const where = type === 'channel' && payload.channelName ? ` · #${payload.channelName}` : '';
            const path = conversationPath(workspaceId, type, id);

            showToast(body, 'message', 4500, {
                title: `${sender}${where}`,
                avatar: payload.senderAvatar || null,
                key: k,
                onClick: () => navigate(path),
            });
            if (document.visibilityState !== 'visible') {
                notifyNative(`${sender}${where}`, body, {
                    type: payload.isMention ? 'mention' : 'message',
                    workspaceId: String(workspaceId),
                    channelId: type === 'channel' ? String(id) : undefined,
                    dmSessionId: type === 'dm' ? String(id) : undefined,
                });
            }
        });
        return unsubscribe;
    }, [addNotificationListener, workspaceId, currentUserId, clearConversationUnread, showToast, navigate, notifyNative]);

    // Stored notifications (bell). DM/mention alerts were already surfaced by
    // the activity handler, so only other types get a native notification here.
    useEffect(() => {
        const unsubscribe = addNotificationListener(async (event, payload) => {
            if (event !== 'notification:new') return;
            const raw = payload?.notification;
            if (!raw) return;
            if (String(raw.workspaceId) !== String(workspaceId)) return;
            const nid = raw._id;
            if (nid) {
                if (seenNotificationIdsRef.current.has(nid)) return;
                seenNotificationIdsRef.current.add(nid);
            }
            const notification = await enrichPreview(raw);
            setNotifications(prev => (nid && prev.some(n => n._id === nid)) ? prev : [notification, ...prev]);
            setUnreadCount(c => c + 1);

            if (notification.type === 'dm' || notification.type === 'mention') return;
            // "Only mentions and direct messages": everything else stays in the bell only.
            if (prefsRef.current.mentionsOnly) return;
            const meta = notification.meta || {};
            const href = notificationHref(notification, workspaceId);
            const isConversational = ['reaction', 'thread_reply'].includes(notification.type);
            if (!isConversational) {
                showToast(notification.body || '', 'message', 4500, {
                    title: notification.title,
                    key: `notif:${notification.type}`,
                    onClick: href ? () => navigate(href) : undefined,
                });
            }
            if (document.visibilityState !== 'visible') {
                notifyNative(notification.title, notification.body || 'Oruinwan', {
                    type: notification.type.startsWith('task') ? 'task' : 'system',
                    workspaceId: String(notification.workspaceId),
                    channelId: meta.channelId ? String(meta.channelId) : undefined,
                    dmSessionId: meta.dmSessionId ? String(meta.dmSessionId) : undefined,
                });
            }
        });
        return unsubscribe;
    }, [addNotificationListener, workspaceId, enrichPreview, showToast, navigate, notifyNative]);

    // "Remind me" reminders fire from the server cron as 'reminder-fired'.
    useEffect(() => {
        const unsubscribe = addNotificationListener(async (event, payload) => {
            if (event !== 'reminder-fired' || !payload) return;
            const message = payload.message || {};
            const sender = message.sender?.username;
            let preview = null;
            const convId = message.channel || message.dm;
            if (message.payload?.ciphertext && convId) {
                preview = await decryptTextOrNull(
                    message.payload.ciphertext, message.payload.messageIv,
                    String(convId?._id || convId), message.channel ? 'channel' : 'dm'
                );
            }
            preview = preview || message.text || null;
            const snippet = preview ? `"${clip(preview)}"` : 'a message';
            const body = [payload.note, `${sender ? `${sender}: ` : ''}${snippet}`].filter(Boolean).join(' · ');
            showToast(body, 'message', 8000, { title: 'Reminder' });
            notifyNative('Reminder', body);
        });
        return unsubscribe;
    }, [addNotificationListener, showToast, notifyNative]);

    // Latest rendered list, for counting what an update changes (updaters stay pure).
    const notificationsRef = useRef(notifications);
    notificationsRef.current = notifications;

    const readIds = useCallback((ids) => {
        const set = new Set((ids || []).map(String));
        if (!set.size) return;
        const dropped = notificationsRef.current.filter(n => set.has(String(n._id)) && !n.read).length;
        setNotifications(prev => prev.map(n => (set.has(String(n._id)) && !n.read ? { ...n, read: true } : n)));
        if (dropped) setUnreadCount(c => Math.max(0, c - dropped));
    }, []);

    const markRead = useCallback(async (notifId) => {
        if (!notifId) return;
        try {
            await api.patch(`/api/notifications/${notifId}/read`);
            readIds([notifId]);
        } catch (err) {
            logger.error('[NotificationsContext] markRead error:', err);
        }
    }, [readIds]);

    const markAllRead = useCallback(async () => {
        if (!workspaceId) return;
        try {
            await api.patch('/api/notifications/read-all', null, { params: { workspaceId } });
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            logger.error('[NotificationsContext] markAllRead error:', err);
            showToast(err?.response?.data?.message || 'Could not mark notifications as read', 'error');
        }
    }, [workspaceId, showToast]);

    const removeIds = useCallback((ids) => {
        const set = new Set((ids || []).map(String));
        if (!set.size) return;
        const unreadRemoved = notificationsRef.current.filter(n => set.has(String(n._id)) && !n.read).length;
        setNotifications(prev => prev.filter(n => !set.has(String(n._id))));
        if (unreadRemoved) setUnreadCount(c => Math.max(0, c - unreadRemoved));
    }, []);

    const dismiss = useCallback(async (notifId) => {
        if (!notifId) return;
        try {
            await api.delete(`/api/notifications/${notifId}`);
            removeIds([notifId]);
        } catch (err) {
            logger.error('[NotificationsContext] dismiss error:', err);
            showToast(err?.response?.data?.message || 'Could not dismiss the notification', 'error');
        }
    }, [removeIds, showToast]);

    const clearAll = useCallback(async () => {
        if (!workspaceId) return false;
        try {
            await api.delete('/api/notifications', { params: { workspaceId } });
            setNotifications([]);
            setUnreadCount(0);
            return true;
        } catch (err) {
            logger.error('[NotificationsContext] clearAll error:', err);
            showToast(err?.response?.data?.message || 'Could not clear notifications', 'error');
            return false;
        }
    }, [workspaceId, showToast]);

    // Keep other tabs/devices in step: the server echoes read/delete/clear to
    // the user's room. Refetch after a reconnect (events may have been missed).
    const fetchRef = useRef(fetchNotifications);
    fetchRef.current = fetchNotifications;
    useEffect(() => {
        if (!socket) return undefined;
        const sameWs = (p) => !p?.workspaceId || String(p.workspaceId) === String(currentWorkspaceRef.current);
        const onRead = (p) => { if (sameWs(p)) readIds(p?.ids); };
        const onReadAll = (p) => {
            if (!sameWs(p)) return;
            setNotifications(prev => prev.map(n => (n.read ? n : { ...n, read: true })));
            setUnreadCount(0);
        };
        const onDeleted = (p) => { if (sameWs(p)) removeIds(p?.ids); };
        const onCleared = (p) => {
            if (!sameWs(p)) return;
            setNotifications([]);
            setUnreadCount(0);
        };
        let wasDisconnected = false;
        const onDisconnect = () => { wasDisconnected = true; };
        const onConnect = () => {
            if (!wasDisconnected) return;
            wasDisconnected = false;
            fetchRef.current(1, false);
        };
        socket.on('notification:read', onRead);
        socket.on('notification:read-all', onReadAll);
        socket.on('notification:deleted', onDeleted);
        socket.on('notification:cleared', onCleared);
        socket.on('disconnect', onDisconnect);
        socket.on('connect', onConnect);
        return () => {
            socket.off('notification:read', onRead);
            socket.off('notification:read-all', onReadAll);
            socket.off('notification:deleted', onDeleted);
            socket.off('notification:cleared', onCleared);
            socket.off('disconnect', onDisconnect);
            socket.off('connect', onConnect);
        };
    }, [socket, readIds, removeIds]);

    // Opening a conversation reads its bell notifications (DMs, mentions,
    // replies and reactions there), like opening it clears its unread badge.
    const autoReadPendingRef = useRef(new Set());
    const openConversation = conversationInPath(location.pathname);
    const openConvKey = openConversation ? `${openConversation.type}:${openConversation.id}` : null;
    useEffect(() => {
        if (!openConvKey) return;
        const [type, id] = openConvKey.split(':');
        const ids = notifications
            .filter(n => !n.read && n._id && !autoReadPendingRef.current.has(n._id) && isAboutConversation(n, { type, id }))
            .map(n => n._id);
        if (!ids.length) return;
        ids.forEach(nid => autoReadPendingRef.current.add(nid));
        Promise.allSettled(ids.map(nid => api.patch(`/api/notifications/${nid}/read`)))
            .then(results => {
                readIds(ids.filter((_, i) => results[i].status === 'fulfilled'));
                ids.forEach(nid => autoReadPendingRef.current.delete(nid));
            });
    }, [openConvKey, notifications, readIds]);

    const value = {
        notifications,
        unreadCount,
        loading,
        error,
        hasMore,
        loadMore,
        refresh: () => fetchNotifications(1, false),
        markRead,
        markAllRead,
        dismiss,
        clearAll,
        // per-conversation unread (Slack/WhatsApp-style badges)
        conversationUnread,
        unreadTotals,
        getUnread,
        hasMention,
        seedConversationUnread,
        clearConversationUnread,
    };

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
}
