/**
 * NotificationsContext.jsx
 *
 * Provides real-time notification data across the entire app.
 * - Fetches from REST API on mount + workspace change
 * - Subscribes to socket `notification:new` for instant push
 * - Exposes markRead, markAllRead, dismiss, refresh
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useSocket } from './SocketContext';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext(null);

export function useNotifications() {
    const ctx = useContext(NotificationsContext);
    if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
    return ctx;
}

export function NotificationsProvider({ children }) {
    const { socket } = useSocket();
    const { activeWorkspace } = useWorkspace();
    const { accessToken } = useAuth();

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

    // ── Real-time socket ───────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onNew = ({ notification }) => {
            if (String(notification.workspaceId) !== String(workspaceId)) return;
            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(c => c + 1);
        };

        socket.on('notification:new', onNew);
        return () => socket.off('notification:new', onNew);
    }, [socket, workspaceId]);

    // ── Mutations ──────────────────────────────────────────────────────
    const markRead = useCallback(async (notifId) => {
        try {
            await api.patch(`/api/notifications/${notifId}/read`);
            setNotifications(prev =>
                prev.map(n => n._id === notifId ? { ...n, read: true } : n)
            );
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
