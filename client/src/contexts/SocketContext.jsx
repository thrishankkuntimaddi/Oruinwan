import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import sdkSocketClient from '@platform/sdk/socket/socketClient.js';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children }) => {
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    
    
    const [socketId, setSocketId] = useState(null);
    const { user } = useAuth();

    
    const channelListenersRef = useRef([]);
    const messageListenersRef = useRef([]);
    const workspaceListenersRef = useRef([]);
    const taskListenersRef = useRef([]);
    const noteListenersRef = useRef([]);
    const updateListenersRef = useRef([]);
    const notificationListenersRef = useRef([]);

    
    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (!token || !user) {
            
            socketRef.current = null;
            setIsConnected(false);
            return;
        }

        const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

        
        const socketInstance = sdkSocketClient.createSocket(API_BASE, token);
        console.log('🧠 SOCKET CREATED', socketInstance);

        socketInstance.on('connect', () => {
            console.log('✅ SOCKET CONNECTED', socketInstance.id);
            setIsConnected(true);

            
            const workspaceId = localStorage.getItem('activeWorkspaceId');
            if (workspaceId) {
                socketInstance.emit('join-workspace', { workspaceId });
            }
        });

        socketInstance.on('disconnect', (reason) => {
            setIsConnected(false);
        });

        socketInstance.on('connect_error', async (error) => {
            console.error('❌ SOCKET ERROR', error.message);
            console.error('❌ Socket connection error (detail):', error);
            setIsConnected(false);

            
            if (error.message === 'Authentication failed') {
                try {
                    const storedRefreshToken = localStorage.getItem('refreshToken');
                    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: storedRefreshToken ? JSON.stringify({ refreshToken: storedRefreshToken }) : undefined,
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const newAccessToken = data.accessToken;
                        if (newAccessToken) {
                            localStorage.setItem('accessToken', newAccessToken);
                            if (data.refreshToken) {
                                localStorage.setItem('refreshToken', data.refreshToken);
                            }
                            
                            socketInstance.auth = { token: newAccessToken };
                            socketInstance.connect();
                        }
                    } else {
                        console.error('❌ Token refresh failed during socket connect_error');
                        
                        window.dispatchEvent(new CustomEvent('auth:force-logout'));
                    }
                } catch (refreshError) {
                    console.error('❌ Token refresh error:', refreshError);
                    
                }
            }
        });

        
        socketRef.current = socketInstance;
        
        
        setSocketId(socketInstance.id ?? Date.now());

        socketInstance.on('connect', () => {
            console.log('✅ SOCKET CONNECTED', socketInstance.id);
            setIsConnected(true);
            setSocketId(socketInstance.id); 

            
            const workspaceId = localStorage.getItem('activeWorkspaceId');
            if (workspaceId) {
                socketInstance.emit('join-workspace', { workspaceId });
            }
        });

        
        

        return () => {
            if (socketInstance.connected) {
                socketInstance.disconnect();
            }
            socketRef.current = null;
            setIsConnected(false);
        };
    }, [user]); 

    
    
    const connectSocket = useCallback(() => {
        if (socketRef.current && !socketRef.current.connected) {
            socketRef.current.connect();
        }
    }, []);

    
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        socket.on('channel-created', (data) => {

            channelListenersRef.current.forEach(cb => cb('channel-created', data));
        });

        socket.on('channel-updated', (data) => {

            channelListenersRef.current.forEach(cb => cb('channel-updated', data));
        });

        socket.on('channel-deleted', (data) => {

            channelListenersRef.current.forEach(cb => cb('channel-deleted', data));
        });

        socket.on('invited-to-channel', (data) => {

            channelListenersRef.current.forEach(cb => cb('invited-to-channel', data));
        });

        socket.on('removed-from-channel', (data) => {

            channelListenersRef.current.forEach(cb => cb('removed-from-channel', data));
        });

        socket.on('channel-member-added', (data) => {

            channelListenersRef.current.forEach(cb => cb('channel-member-added', data));
        });

        socket.on('channel-member-joined', (data) => {

            channelListenersRef.current.forEach(cb => cb('channel-member-joined', data));
        });

        socket.on('channel-member-removed', (data) => {

            channelListenersRef.current.forEach(cb => cb('channel-member-removed', data));
        });

        socket.on('member-left', (data) => {

            channelListenersRef.current.forEach(cb => cb('member-left', data));
        });

        socket.on('admin-assigned', (data) => {

            channelListenersRef.current.forEach(cb => cb('admin-assigned', data));
        });

        socket.on('admin-demoted', (data) => {

            channelListenersRef.current.forEach(cb => cb('admin-demoted', data));
        });

        socket.on('channel-privacy-changed', (data) => {

            channelListenersRef.current.forEach(cb => cb('channel-privacy-changed', data));
        });

        socket.on('messages-cleared', (data) => {

            channelListenersRef.current.forEach(cb => cb('messages-cleared', data));
        });

        socket.on('tab-added', (data) => {

            channelListenersRef.current.forEach(cb => cb('tab-added', data));
        });

        socket.on('tab-updated', (data) => {

            channelListenersRef.current.forEach(cb => cb('tab-updated', data));
        });

        socket.on('tab-deleted', (data) => {

            channelListenersRef.current.forEach(cb => cb('tab-deleted', data));
        });

        
        
        

        
        
        
        
        
        
        
        
        
        
        
        
        
        

        return () => {
            socket.off('channel-created');
            socket.off('channel-updated');
            socket.off('channel-deleted');
            socket.off('invited-to-channel');
            socket.off('removed-from-channel');
            socket.off('channel-member-added');
            socket.off('channel-member-joined');
            socket.off('channel-member-removed');
            socket.off('member-left');
            socket.off('admin-assigned');
            socket.off('admin-demoted');
            socket.off('channel-privacy-changed');
            socket.off('messages-cleared');
            socket.off('tab-added');
            socket.off('tab-updated');
            socket.off('tab-deleted');
            
        };
    }, [socketId]); 

    
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        socket.on('new-message', (data) => {
            messageListenersRef.current.forEach(cb => cb('new-message', data));
        });

        socket.on('new-dm-session', (data) => {
            messageListenersRef.current.forEach(cb => cb('new-dm-session', data));
        });

        socket.on('message-deleted', (data) => {
            messageListenersRef.current.forEach(cb => cb('message-deleted', data));
        });

        socket.on('message-pinned', (data) => {
            messageListenersRef.current.forEach(cb => cb('message-pinned', data));
        });

        socket.on('message-unpinned', (data) => {
            messageListenersRef.current.forEach(cb => cb('message-unpinned', data));
        });

        socket.on('read-update', (data) => {
            messageListenersRef.current.forEach(cb => cb('read-update', data));
        });

        socket.on('reaction-added', (data) => {
            messageListenersRef.current.forEach(cb => cb('reaction-added', data));
        });

        socket.on('reaction-removed', (data) => {
            messageListenersRef.current.forEach(cb => cb('reaction-removed', data));
        });

        
        
        socket.on('reconnected', (data) => {
            messageListenersRef.current.forEach(cb => cb('reconnected', data));
        });

        return () => {
            socket.off('new-message');
            socket.off('new-dm-session');
            socket.off('message-deleted');
            socket.off('message-pinned');
            socket.off('message-unpinned');
            socket.off('read-update');
            socket.off('reaction-added');
            socket.off('reaction-removed');
            socket.off('reconnected');
        };
    }, [socketId]);

    
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        socket.on('workspace-joined', (data) => {

            workspaceListenersRef.current.forEach(cb => cb('workspace-joined', data));
        });

        socket.on('workspace-created', (data) => {

            workspaceListenersRef.current.forEach(cb => cb('workspace-created', data));
        });

        socket.on('workspace-updated', (data) => {

            workspaceListenersRef.current.forEach(cb => cb('workspace-updated', data));
        });

        socket.on('workspace-deleted', (data) => {

            workspaceListenersRef.current.forEach(cb => cb('workspace-deleted', data));
        });

        return () => {
            socket.off('workspace-joined');
            socket.off('workspace-created');
            socket.off('workspace-updated');
            socket.off('workspace-deleted');
        };
    }, [socketId]);

    
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        const events = ['task-created', 'task-updated', 'task-deleted', 'task-assigned', 'task-removed'];

        events.forEach(event => {
            socket.on(event, (data) => {

                taskListenersRef.current.forEach(cb => cb(event, data));
            });
        });

        return () => {
            events.forEach(event => socket.off(event));
        };
    }, [socketId]);

    
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        const events = ['note-created', 'note-updated', 'note-deleted', 'note-shared'];

        events.forEach(event => {
            socket.on(event, (data) => {

                noteListenersRef.current.forEach(cb => cb(event, data));
            });
        });

        return () => {
            events.forEach(event => socket.off(event));
        };
    }, [socketId]);

    
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        const events = ['company:update:created', 'company:update:deleted', 'company:update:reacted'];

        events.forEach(event => {
            socket.on(event, (data) => {

                updateListenersRef.current.forEach(cb => cb(event, data));
            });
        });

        return () => {
            events.forEach(event => socket.off(event));
        };
    }, [socketId]);

    
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        const onNotification = (data) => {
            notificationListenersRef.current.forEach(cb => cb('notification:new', data));
        };

        socket.on('notification:new', onNotification);

        return () => {
            socket.off('notification:new', onNotification);
        };
    }, [socketId]);

    
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
        socket: socketRef.current,
        isConnected,
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
