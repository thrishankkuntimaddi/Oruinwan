import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '@services/api';
import { useSocket } from './SocketContext';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from './AuthContext';
import { useDesktopNotification } from '../hooks/useDesktopNotification';
import logger from '../utils/logger';

const NotificationsContext = createContext(null);

export function useNotifications() {
    return useContext(NotificationsContext); 
}

export function NotificationsProvider({ children }) {
    const { addNotificationListener } = useSocket();
    const { activeWorkspace } = useWorkspace();
    const { accessToken } = useAuth();
    const { triggerDesktopNotification } = useDesktopNotification();

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // Keep the desktop dock/tray badge in sync when running inside Electron.
    useEffect(() => {
        window.chttrixDesktop?.setUnreadCount(unreadCount);
    }, [unreadCount]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [page, setPage] = useState(1);

    const workspaceId = activeWorkspace?.id;
    // Always reflects the workspace currently shown; in-flight fetches for a
    // previous workspace are discarded when they resolve.
    const currentWorkspaceRef = useRef(workspaceId);
    currentWorkspaceRef.current = workspaceId;
    const seenNotificationIdsRef = useRef(new Set());
    useEffect(() => {
        seenNotificationIdsRef.current = new Set(notifications.map(n => n._id).filter(Boolean));
    }, [notifications]);

    
    const fetchNotifications = useCallback(async (pg = 1, append = false) => {
        if (!workspaceId || !accessToken) return;
        setLoading(true);
        try {
            const { data } = await api.get('/api/notifications', {
                params: { workspaceId, page: pg, limit: 30 },
            });
            if (currentWorkspaceRef.current !== workspaceId) return;
            const incoming = data.notifications || [];
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
        } finally {
            if (currentWorkspaceRef.current === workspaceId) setLoading(false);
        }
    }, [workspaceId, accessToken]);

    
    useEffect(() => {
        setNotifications([]);
        setPage(1);
        fetchNotifications(1, false);
    }, [workspaceId]); 

    
    const loadMore = useCallback(() => {
        if (!hasMore || loading) return;
        fetchNotifications(page + 1, true);
    }, [hasMore, loading, page, fetchNotifications]);

    
    useEffect(() => {
        const unsubscribe = addNotificationListener((event, payload) => {
            if (event !== 'notification:new') return;
            const { notification } = payload || {};
            if (!notification) return;
            
            if (String(notification.workspaceId) !== String(workspaceId)) return;
            const nid = notification._id;
            if (nid) {
                if (seenNotificationIdsRef.current.has(nid)) return;
                seenNotificationIdsRef.current.add(nid);
            }
            setNotifications(prev => (nid && prev.some(n => n._id === nid)) ? prev : [notification, ...prev]);
            setUnreadCount(c => c + 1);

            // Inside the Electron app, hand the notification to the native bridge
            // (which also handles click-to-navigate); otherwise use the browser API.
            if (window.chttrixDesktop) {
                window.chttrixDesktop.notify({
                    type: 'system',
                    title: notification.title,
                    body: notification.body || 'Chttrix',
                    workspaceId: notification.workspaceId,
                    channelId: notification.channelId,
                    dmSessionId: notification.dmSessionId,
                });
            } else {
                triggerDesktopNotification(
                    notification.title,
                    notification.body || 'Chttrix'
                );
            }
        });

        return unsubscribe;
    }, [addNotificationListener, workspaceId, triggerDesktopNotification]);

    
    const markRead = useCallback(async (notifId) => {
        if (!notifId) return;
        try {
            await api.patch(`/api/notifications/${notifId}/read`);
            setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, read: true } : n));
            setUnreadCount(c => Math.max(0, c - 1));
        } catch (err) {
            logger.error('[NotificationsContext] markRead error:', err);
        }
    }, []);

    const markAllRead = useCallback(async () => {
        if (!workspaceId) return;
        try {
            await api.patch('/api/notifications/read-all', null, { params: { workspaceId } });
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            logger.error('[NotificationsContext] markAllRead error:', err);
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
            logger.error('[NotificationsContext] dismiss error:', err);
        }
    }, [notifications]);

    const clearAll = useCallback(async () => {
        if (!workspaceId) return;
        try {
            await api.delete('/api/notifications', { params: { workspaceId } });
            setNotifications([]);
            setUnreadCount(0);
        } catch (err) {
            logger.error('[NotificationsContext] clearAll error:', err);
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
