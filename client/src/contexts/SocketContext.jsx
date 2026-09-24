import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import sdkSocketClient from '@platform/sdk/socket/socketClient.js';
import { useAuth } from './AuthContext';
import { refreshAccessToken } from '../services/api';
import logger from '../utils/logger';

const SocketContext = createContext(null);

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within SocketProvider');
    }
    return context;
};

const CHANNEL_EVENTS = [
    'channel-created', 'channel-updated', 'channel-deleted', 'invited-to-channel',
    'removed-from-channel', 'channel-member-added', 'channel-member-joined',
    'channel-member-removed', 'member-left', 'admin-assigned', 'admin-demoted',
    'channel-privacy-changed', 'messages-cleared', 'tab-added', 'tab-updated', 'tab-deleted',
];
const MESSAGE_EVENTS = [
    'new-message', 'new-dm-session', 'message-deleted', 'message-pinned', 'message-unpinned',
    'read-update', 'reaction-added', 'reaction-removed', 'reconnected',
];
const WORKSPACE_EVENTS = ['workspace-joined', 'workspace-created', 'workspace-updated', 'workspace-deleted'];
const TASK_EVENTS = ['task-created', 'task-updated', 'task-deleted', 'task-assigned', 'task-removed'];
const NOTE_EVENTS = ['note-created', 'note-updated', 'note-deleted', 'note-shared'];
const UPDATE_EVENTS = ['company:update:created', 'company:update:deleted', 'company:update:reacted'];
const NOTIFICATION_EVENTS = ['notification:new'];

export const MAX_SOCKET_AUTH_RETRIES = 3;
const AUTH_RETRY_BASE_DELAY_MS = 1000;

// Attach one named handler per event that fans out to the listener registry,
// and return a cleanup that removes ONLY those handlers (never other consumers').
function attachFanOut(socket, events, listenersRef) {
    const handlers = events.map((event) => {
        const handler = (data) => {
            listenersRef.current.forEach(cb => cb(event, data));
        };
        socket.on(event, handler);
        return [event, handler];
    });
    return () => {
        handlers.forEach(([event, handler]) => socket.off(event, handler));
    };
}

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const { user, accessToken } = useAuth() || {};
    const userId = user ? (user._id || user.id || user.sub || null) : null;
    const hasToken = Boolean(accessToken || localStorage.getItem('accessToken'));

    const channelListenersRef = useRef([]);
    const messageListenersRef = useRef([]);
    const workspaceListenersRef = useRef([]);
    const taskListenersRef = useRef([]);
    const noteListenersRef = useRef([]);
    const updateListenersRef = useRef([]);
    const notificationListenersRef = useRef([]);

    // Socket lifecycle: keyed on the user identity (not the user object), so
    // profile/theme/status updates don't tear down the connection.
    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (!token || !userId) {
            setSocket(null);
            setIsConnected(false);
            return undefined;
        }

        const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
        const socketInstance = sdkSocketClient.createSocket(API_BASE, token);
        let cancelled = false;
        let authRetries = 0;
        let retryTimer = null;

        socketInstance.on('connect', () => {
            if (cancelled) return;
            logger.debug('✅ SOCKET CONNECTED', socketInstance.id);
            authRetries = 0;
            setConnectionError(null);
            setIsConnected(true);
        });

        socketInstance.on('disconnect', () => {
            if (cancelled) return;
            setIsConnected(false);
        });

        socketInstance.on('connect_error', async (error) => {
            if (cancelled) return;
            logger.error('❌ Socket connection error:', error?.message);
            setIsConnected(false);

            const authCode = error?.data?.code;
            const isAuthError = authCode === 'TOKEN_EXPIRED' || authCode === 'TOKEN_INVALID'
                || ['Authentication failed', 'Token expired', 'No token'].includes(error?.message);
            if (!isAuthError) {
                return; // transport errors: socket.io's own bounded reconnection handles these
            }

            if (authRetries >= MAX_SOCKET_AUTH_RETRIES) {
                logger.error('❌ Socket auth failed after max retries — giving up');
                setConnectionError('Realtime connection unavailable. Please refresh the page.');
                return;
            }
            authRetries += 1;

            try {
                const newToken = await refreshAccessToken();
                if (cancelled) return;
                socketInstance.auth = { token: newToken };
                const delay = AUTH_RETRY_BASE_DELAY_MS * 2 ** (authRetries - 1);
                retryTimer = setTimeout(() => {
                    retryTimer = null;
                    if (!cancelled && !socketInstance.connected) socketInstance.connect();
                }, delay);
            } catch (refreshError) {
                if (cancelled) return;
                logger.error('❌ Token refresh failed during socket connect_error:', refreshError?.message);
                setConnectionError('Realtime connection unavailable. Please sign in again.');
                // The api.js interceptor owns force-logout; don't loop here.
            }
        });

        setSocket(socketInstance);
        socketInstance.connect();

        return () => {
            cancelled = true;
            if (retryTimer) clearTimeout(retryTimer);
            socketInstance.removeAllListeners();
            socketInstance.disconnect();
            setSocket(null);
            setIsConnected(false);
        };
    }, [userId, hasToken]);

    // Keep the handshake token fresh for socket.io's automatic reconnects
    // without recreating the socket on every token refresh.
    useEffect(() => {
        if (socket && accessToken) {
            socket.auth = { token: accessToken };
        }
    }, [socket, accessToken]);

    const connectSocket = useCallback(() => {
        if (socket && !socket.connected) {
            socket.connect();
        }
    }, [socket]);

    useEffect(() => {
        if (!socket) return undefined;
        const cleanups = [
            attachFanOut(socket, CHANNEL_EVENTS, channelListenersRef),
            attachFanOut(socket, MESSAGE_EVENTS, messageListenersRef),
            attachFanOut(socket, WORKSPACE_EVENTS, workspaceListenersRef),
            attachFanOut(socket, TASK_EVENTS, taskListenersRef),
            attachFanOut(socket, NOTE_EVENTS, noteListenersRef),
            attachFanOut(socket, UPDATE_EVENTS, updateListenersRef),
            attachFanOut(socket, NOTIFICATION_EVENTS, notificationListenersRef),
        ];
        return () => cleanups.forEach(fn => fn());
    }, [socket]);

    const addChannelListener = useCallback((callback) => {
        channelListenersRef.current.push(callback);
        return () => {
            channelListenersRef.current = channelListenersRef.current.filter(cb => cb !== callback);
        };
    }, []);

    const addMessageListener = useCallback((callback) => {
        messageListenersRef.current.push(callback);
        return () => {
            messageListenersRef.current = messageListenersRef.current.filter(cb => cb !== callback);
        };
    }, []);

    const addWorkspaceListener = useCallback((callback) => {
        workspaceListenersRef.current.push(callback);
        return () => {
            workspaceListenersRef.current = workspaceListenersRef.current.filter(cb => cb !== callback);
        };
    }, []);

    const addTaskListener = useCallback((callback) => {
        taskListenersRef.current.push(callback);
        return () => {
            taskListenersRef.current = taskListenersRef.current.filter(cb => cb !== callback);
        };
    }, []);

    const addNoteListener = useCallback((callback) => {
        noteListenersRef.current.push(callback);
        return () => {
            noteListenersRef.current = noteListenersRef.current.filter(cb => cb !== callback);
        };
    }, []);

    const addUpdateListener = useCallback((callback) => {
        updateListenersRef.current.push(callback);
        return () => {
            updateListenersRef.current = updateListenersRef.current.filter(cb => cb !== callback);
        };
    }, []);

    const addNotificationListener = useCallback((callback) => {
        notificationListenersRef.current.push(callback);
        return () => {
            notificationListenersRef.current = notificationListenersRef.current.filter(cb => cb !== callback);
        };
    }, []);

    const value = {
        socket,
        isConnected,
        connectionError,
        addChannelListener,
        addMessageListener,
        addWorkspaceListener,
        addTaskListener,
        addNoteListener,
        addUpdateListener,
        addNotificationListener,
        connectSocket,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};

export const createSocket = (serverUrl, token, options = {}) =>
    sdkSocketClient.createSocket(serverUrl, token, options);
