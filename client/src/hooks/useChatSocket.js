// client/src/hooks/useChatSocket.js
// Single source of truth for socket lifecycle and event listeners

import { useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';

/**
 * Manages socket connection lifecycle for a conversation
 * @param {string} conversationId - Channel ID or DM Session ID
 * @param {string} conversationType - "channel" | "dm" | "broadcast"
 * @param {function} onEvent - Callback for incoming socket events
 * @returns {object} Socket utilities and state
 */
export function useChatSocket(conversationId, conversationType, onEvent) {
    const { socket } = useSocket();
    const onEventRef = useRef(onEvent);
    const joinedRef = useRef(false);

    // Keep callback ref fresh
    useEffect(() => {
        onEventRef.current = onEvent;
    }, [onEvent]);

    // Join conversation room
    const joinConversation = useCallback(() => {
        if (!socket || !conversationId) {
            console.log('⏸️ [useChatSocket] Cannot join - missing socket or conversationId');
            return;
        }

        // Prevent duplicate joins
        if (joinedRef.current) {
            console.log(`⏭️ Already joined ${conversationType}:`, conversationId);
            return;
        }

        // CRITICAL: Wait for socket to be connected before emitting
        if (!socket.connected) {
            console.log(`⏳ Socket not connected, waiting to join ${conversationType}:`, conversationId);
            return;
        }

        // ✅ FIX: Use chat:join which joins channel:ID format (matches server broadcast in messages.service.js line 83)
        // FIX 3: Handle authorization callback from server
        socket.emit('chat:join', conversationId, (response) => {
            if (response?.error) {
                console.error(`❌ [chat:join] Failed to join ${conversationType}: ${response.error}`, response);
                joinedRef.current = false;

                // Handle specific error codes
                if (response.code === 'UNAUTHORIZED') {
                    console.error(`🚫 [chat:join] Not authorized to join channel ${conversationId}`);
                    onEventRef.current?.({
                        type: 'join-error',
                        payload: {
                            error: response.error,
                            code: response.code,
                            conversationId
                        }
                    });
                }
            } else if (response?.success) {
                joinedRef.current = true;
                console.log(`✅ [chat:join] Successfully joined ${conversationType}:`, conversationId);
            }
        });
        console.log(`📤 [chat:join] Emit sent for ${conversationType}:`, conversationId);
    }, [socket, conversationId, conversationType]);

    // Leave conversation room
    const leaveConversation = useCallback(() => {
        if (!socket || !conversationId) return;

        if (joinedRef.current) {
            socket.emit('chat:leave', conversationId);
            joinedRef.current = false;
            console.log(`👋 Left ${conversationType}:`, conversationId);
        }
    }, [socket, conversationId, conversationType]);

    // Emit typing indicator
    const emitTyping = useCallback((isTyping) => {
        if (!socket || !conversationId) return;

        socket.emit('chat:typing', {
            channelId: conversationId,
            isTyping
        });
    }, [socket, conversationId]);

    // Mark messages as read
    const markAsRead = useCallback((messageIds) => {
        if (!socket || !conversationId || !messageIds?.length) return;

        socket.emit('messages:mark-read', {
            conversationId,
            conversationType,
            messageIds
        });
    }, [socket, conversationId, conversationType]);

    // Setup socket event listeners
    useEffect(() => {
        if (!socket || !conversationId) return;

        // Join room on mount (if already connected)
        joinConversation();

        // Re-join room when socket connects/reconnects
        const handleConnect = () => {
            console.log(`🔌 Socket connected, re-joining ${conversationType}: ${conversationId}`);
            joinedRef.current = false; // Reset so we can rejoin
            joinConversation();
        };

        socket.on('connect', handleConnect);

        // ==================== MESSAGE EVENTS ====================

        const handleNewMessage = (data) => {
            onEventRef.current?.({
                type: 'new-message',
                payload: data
            });
        };

        const handleMessageSent = (data) => {
            onEventRef.current?.({
                type: 'message-sent',
                payload: data
            });
        };

        const handleSendError = (data) => {
            onEventRef.current?.({
                type: 'send-error',
                payload: data
            });
        };

        const handleMessageDeleted = (data) => {
            onEventRef.current?.({
                type: 'message-deleted',
                payload: data
            });
        };

        const handleMessageUpdated = (data) => {
            onEventRef.current?.({
                type: 'message-updated',
                payload: data
            });
        };


        const handleMessagePinned = (data) => {
            onEventRef.current?.({
                type: 'message-pinned',
                payload: data
            });
        };

        const handleMessageUnpinned = (data) => {
            onEventRef.current?.({
                type: 'message-unpinned',
                payload: data
            });
        };

        // ==================== REACTION EVENTS ====================

        const handleReactionAdded = (data) => {
            onEventRef.current?.({
                type: 'reaction-added',
                payload: data
            });
        };

        const handleReactionRemoved = (data) => {
            onEventRef.current?.({
                type: 'reaction-removed',
                payload: data
            });
        };

        // ==================== TYPING EVENTS ====================

        const handleUserTyping = (data) => {
            onEventRef.current?.({
                type: 'user-typing',
                payload: data
            });
        };

        // ==================== POLL EVENTS ====================

        const handlePollCreated = (data) => {
            onEventRef.current?.({
                type: 'poll-created',
                payload: data
            });
        };

        const handlePollUpdated = (data) => {
            onEventRef.current?.({
                type: 'poll-updated',
                payload: data
            });
        };

        const handlePollRemoved = (data) => {
            onEventRef.current?.({
                type: 'poll-removed',
                payload: data
            });
        };

        // ==================== CHANNEL EVENTS ====================

        const handleChannelUpdated = (data) => {
            onEventRef.current?.({
                type: 'channel-updated',
                payload: data
            });
        };

        const handleMemberJoined = (data) => {
            onEventRef.current?.({
                type: 'member-joined',
                payload: data
            });
        };

        const handleMemberLeft = (data) => {
            onEventRef.current?.({
                type: 'member-left',
                payload: data
            });
        };

        // ==================== READ RECEIPTS ====================


        const handleMessageRead = (data) => {
            onEventRef.current?.({
                type: 'message-read',
                payload: data
            });
        };

        // Register all event listeners
        socket.on('new-message', handleNewMessage);
        socket.on('message-sent', handleMessageSent);
        socket.on('send-error', handleSendError);
        socket.on('message-deleted', handleMessageDeleted);
        socket.on('message-updated', handleMessageUpdated);
        socket.on('message-pinned', handleMessagePinned);
        socket.on('message-unpinned', handleMessageUnpinned);

        socket.on('reaction-added', handleReactionAdded);
        socket.on('reaction-removed', handleReactionRemoved);

        socket.on('chat:user_typing', handleUserTyping);

        socket.on('poll:new', handlePollCreated);
        socket.on('poll:updated', handlePollUpdated);
        socket.on('poll:removed', handlePollRemoved);

        socket.on('channel-updated', handleChannelUpdated);
        socket.on('member-joined', handleMemberJoined);
        socket.on('member-left', handleMemberLeft);

        socket.on('message-read', handleMessageRead);

        // Cleanup on unmount
        return () => {
            socket.off('new-message', handleNewMessage);
            socket.off('message-sent', handleMessageSent);
            socket.off('send-error', handleSendError);
            socket.off('message-deleted', handleMessageDeleted);
            socket.off('message-updated', handleMessageUpdated);
            socket.off('message-pinned', handleMessagePinned);
            socket.off('message-unpinned', handleMessageUnpinned);

            socket.off('reaction-added', handleReactionAdded);
            socket.off('reaction-removed', handleReactionRemoved);

            socket.off('chat:user_typing', handleUserTyping);

            socket.off('poll:new', handlePollCreated);
            socket.off('poll:updated', handlePollUpdated);
            socket.off('poll:removed', handlePollRemoved);

            socket.off('channel-updated', handleChannelUpdated);
            socket.off('member-joined', handleMemberJoined);
            socket.off('member-left', handleMemberLeft);

            socket.off('message-read', handleMessageRead);

            // Remove connect listener
            socket.off('connect', handleConnect);

            // Leave room on unmount
            leaveConversation();
        };
    }, [socket, conversationId, conversationType, joinConversation, leaveConversation]);

    return {
        connected: socket?.connected || false,
        joinConversation,
        leaveConversation,
        emitTyping,
        markAsRead
    };
}
