// client/src/contexts/SocketContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    // Event listeners registry (using refs to avoid stale closures)
    const channelListenersRef = useRef([]);
    const messageListenersRef = useRef([]);
    const workspaceListenersRef = useRef([]);

    // Initialize socket connection
    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            console.log('⚠️ No access token - skipping socket connection');
            return;
        }

        const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
        console.log('🔌 Initializing global socket connection...');

        const socketInstance = io(API_BASE, {
            auth: { token },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketInstance.on('connect', () => {
            console.log('✅ Global socket connected:', socketInstance.id);
            setIsConnected(true);

            // ✅ Join workspace room to receive workspace-wide events
            const workspaceId = localStorage.getItem('activeWorkspaceId');
            if (workspaceId) {
                console.log(`📢 Joining workspace room: workspace_${workspaceId}`);
                socketInstance.emit('join-workspace', { workspaceId });
            }
        });

        socketInstance.on('disconnect', (reason) => {
            console.log('⚠️ Global socket disconnected:', reason);
            setIsConnected(false);
        });

        socketInstance.on('connect_error', (error) => {
            // Only log if it's not a typical initialization error
            // (Socket.io often tries multiple transports before connecting successfully)
            if (!error.message.includes('xhr poll error') && !error.message.includes('websocket error')) {
                console.error('❌ Socket connection error:', error.message);
            }
            setIsConnected(false);
        });

        setSocket(socketInstance);

        return () => {
            console.log('🔌 Disconnecting global socket');
            socketInstance.disconnect();
        };
    }, []);

    // Broadcast channel events to all registered listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('channel-created', (data) => {
            console.log('📢 [Global] channel-created:', data);
            channelListenersRef.current.forEach(cb => cb('channel-created', data));
        });

        socket.on('channel-updated', (data) => {
            console.log('📢 [Global] channel-updated:', data);
            channelListenersRef.current.forEach(cb => cb('channel-updated', data));
        });

        socket.on('channel-deleted', (data) => {
            console.log('📢 [Global] channel-deleted:', data);
            channelListenersRef.current.forEach(cb => cb('channel-deleted', data));
        });

        socket.on('invited-to-channel', (data) => {
            console.log('📢 [Global] invited-to-channel:', data);
            channelListenersRef.current.forEach(cb => cb('invited-to-channel', data));
        });

        socket.on('removed-from-channel', (data) => {
            console.log('📢 [Global] removed-from-channel:', data);
            channelListenersRef.current.forEach(cb => cb('removed-from-channel', data));
        });

        socket.on('channel-member-added', (data) => {
            console.log('📢 [Global] channel-member-added:', data);
            channelListenersRef.current.forEach(cb => cb('channel-member-added', data));
        });

        return () => {
            socket.off('channel-created');
            socket.off('channel-updated');
            socket.off('channel-deleted');
            socket.off('invited-to-channel');
            socket.off('removed-from-channel');
            socket.off('channel-member-added');
        };
    }, [socket]);

    // Broadcast message events
    useEffect(() => {
        if (!socket) return;

        socket.on('new-message', (data) => {
            console.log('📢 [Global] new-message:', data);
            messageListenersRef.current.forEach(cb => cb('new-message', data));
        });

        socket.on('message-deleted', (data) => {
            console.log('📢 [Global] message-deleted:', data);
            messageListenersRef.current.forEach(cb => cb('message-deleted', data));
        });

        socket.on('message-pinned', (data) => {
            console.log('📢 [Global] message-pinned:', data);
            messageListenersRef.current.forEach(cb => cb('message-pinned', data));
        });

        socket.on('message-unpinned', (data) => {
            console.log('📢 [Global] message-unpinned:', data);
            messageListenersRef.current.forEach(cb => cb('message-unpinned', data));
        });

        socket.on('read-update', (data) => {
            console.log('📢 [Global] read-update:', data);
            messageListenersRef.current.forEach(cb => cb('read-update', data));
        });

        socket.on('reaction-added', (data) => {
            console.log('📢 [Global] reaction-added:', data);
            messageListenersRef.current.forEach(cb => cb('reaction-added', data));
        });

        socket.on('reaction-removed', (data) => {
            console.log('📢 [Global] reaction-removed:', data);
            messageListenersRef.current.forEach(cb => cb('reaction-removed', data));
        });

        return () => {
            socket.off('new-message');
            socket.off('message-deleted');
            socket.off('message-pinned');
            socket.off('message-unpinned');
            socket.off('read-update');
            socket.off('reaction-added');
            socket.off('reaction-removed');
        };
    }, [socket]);

    // Broadcast workspace events
    useEffect(() => {
        if (!socket) return;

        socket.on('workspace-joined', (data) => {
            console.log('📢 [Global] workspace-joined:', data);
            workspaceListenersRef.current.forEach(cb => cb('workspace-joined', data));
        });

        socket.on('workspace-created', (data) => {
            console.log('📢 [Global] workspace-created:', data);
            workspaceListenersRef.current.forEach(cb => cb('workspace-created', data));
        });

        return () => {
            socket.off('workspace-joined');
            socket.off('workspace-created');
        };
    }, [socket]);

    // Register/unregister listeners (using refs to avoid stale closures)
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

    const value = {
        socket,
        isConnected,
        addChannelListener,
        addMessageListener,
        addWorkspaceListener,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
