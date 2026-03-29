/**
 * NotificationsContext.jsx
 *
 * Provides real-time notification data across the entire app.
 * - Fetches from REST API on mount + workspace change
 * - Subscribes to socket `notification:new` via SocketContext's addNotificationListener
 * - Exposes markRead, markAllRead, dismiss, clearAll, refresh, loadMore
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { useSocket } from './SocketContext';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from './AuthContext';
import { useDesktopNotification } from '../hooks/useDesktopNotification';

const NotificationsContext = createContext(null);

export function useNotifications() {
    return useContext(NotificationsContext); // returns null when outside provider — safe
}

export function NotificationsProvider({ children }) {
    const { addNotificationListener } = useSocket();
    const { activeWorkspace } = useWorkspace();
    const { accessToken } = useAuth();
    const { triggerDesktopNotification } = useDesktopNotification();

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [page, setPage] = useState(1);

    const workspaceId = activeWorkspace?.id;

    // ── Fetch from REST ────────────────────────────────────────────────
    const fetchNotifications = useCallback(async (pg = 1, append = false) => {
        if (!workspaceId || !accessToken) return;
        setLoading(true);
        try {
            const { data } = await api.get('/api/notifications', {
                params: { workspaceId, page: pg, limit: 30 },
            });
            setNotifications(prev => append ? [...prev, ...(data.notifications || [])] : (data.notifications || []));
            setUnreadCount(data.unreadCount || 0);
            setHasMore(pg < data.pages);
            setPage(pg);
        } catch (err) {
            console.error('[NotificationsContext] fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [workspaceId, accessToken]);

    // Refresh on workspace change
    useEffect(() => {
        setNotifications([]);
        setPage(1);
        fetchNotifications(1, false);
    }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Load next page
    const loadMore = useCallback(() => {
        if (!hasMore || loading) return;
        fetchNotifications(page + 1, true);
    }, [hasMore, loading, page, fetchNotifications]);

    // ── Real-time: subscribe via SocketContext's listener mechanism ────
    useEffect(() => {
        const unsubscribe = addNotificationListener((event, payload) => {
            if (event !== 'notification:new') return;
            const { notification } = payload || {};
            if (!notification) return;
            // Only inject if it belongs to the current workspace
            if (String(notification.workspaceId) !== String(workspaceId)) return;
            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(c => c + 1);
            // Fire desktop notification when app is in background
            triggerDesktopNotification(
                notification.title,
                notification.body || 'Chttrix'
            );
        });

        return unsubscribe;
    }, [addNotificationListener, workspaceId, triggerDesktopNotification]);

    // ── Mutations ──────────────────────────────────────────────────────
    const markRead = useCallback(async (notifId) => {
        if (!notifId) return;
        try {
            await api.patch(`/api/notifications/${notifId}/read`);
            setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, read: true } : n));
            setUnreadCount(c => Math.max(0, c - 1));
        } catch (err) {
            console.error('[NotificationsContext] markRead error:', err);
        }
    }, []);

    const markAllRead = useCallback(async () => {
        if (!workspaceId) return;
        try {
            await api.patch('/api/notifications/read-all', null, { params: { workspaceId } });
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('[NotificationsContext] markAllRead error:', err);
        }
    }, [workspaceId]);

    const dismiss = useCallback(async (notifId) => {
        if (!notifId) return;
        try {
            const wasUnread = notifications.find(n => n._id === notifId && !n.read);
            await api.delete(`/api/notifications/${notifId}`);
            setNotifications(prev => prev.filter(n => n._id !== notifId));
            if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
        } catch (err) {
            console.error('[NotificationsContext] dismiss error:', err);
        }
    }, [notifications]);

    const clearAll = useCallback(async () => {
        if (!workspaceId) return;
        try {
            await api.delete('/api/notifications', { params: { workspaceId } });
            setNotifications([]);
            setUnreadCount(0);
        } catch (err) {
            console.error('[NotificationsContext] clearAll error:', err);
        }
    }, [workspaceId]);

    const value = {
        notifications,
        unreadCount,
        loading,
        hasMore,
        loadMore,
        refresh: () => fetchNotifications(1, false),
        markRead,
        markAllRead,
        dismiss,
        clearAll,
    };

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
}
