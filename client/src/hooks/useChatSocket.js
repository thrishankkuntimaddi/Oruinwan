// client/src/hooks/useChatSocket.js
// Single source of truth for socket lifecycle and event listeners

import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext'; // ✅ FIX 5: Import useAuth for encryptionReady

/**
 * Manages socket connection lifecycle for a conversation
 * @param {string} conversationId - Channel ID or DM Session ID
 * @param {string} conversationType - "channel" | "dm" | "broadcast"
 * @param {function} eventHandler - Callback for incoming socket events
 * @returns {object} Socket utilities and state
 */
export function useChatSocket(conversationId, conversationType, eventHandler) {
    const { socket } = useSocket();
    const { encryptionReady } = useAuth(); // ✅ FIX 5: Get encryption ready flag
    const eventHandlerRef = useRef(eventHandler); // Changed from onEventRef
    // eslint-disable-next-line no-unused-vars
    const lastEventHashRef = useRef(new Set()); // Track processed event hashes (reserved for deduplication)

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔍 DEBUG LOG: Hook initialization
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('[DEBUG][useChatSocket][INIT]', {
        conversationId,
        conversationType
    });

    // Keep callback ref fresh
    useEffect(() => {
        eventHandlerRef.current = eventHandler;
    }, [eventHandler]);

    // Join conversation room
    const joinConversation = useCallback(() => {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 🚫 DM GUARD: Skip chat:join for Direct Messages
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // DMs use 'join-dm' event (handled in ChatWindowV2.jsx)
        // Channels/threads use 'chat:join' (continue normally below)
        if (conversationType === 'dm') {
            console.log('🚫 [useChatSocket] Skipping chat:join for DM (using join-dm instead)');
            return; // Exit early - DM join handled elsewhere
        }

        if (!conversationId || !conversationType) {
            console.log('⚠️ [chat:join] Skipped - missing conversation details');
            return;
        }

        // ⚠️ GUARDRAIL FIX 5: Explicit ordering checks

        // Step 1: Check encryption ready
        if (!encryptionReady) {
            console.log('🛑 [chat:join] BLOCKED - Encryption not ready yet');
            console.log('   Waiting for identity keys to load...');
            return;
        }

        // Step 2: Check socket connected
        if (!socket?.connected) {
            console.log('🛑 [chat:join] BLOCKED - Socket not connected yet');
            console.log('   Waiting for socket connection...');
            return;
        }

        // Step 3: Emit join only after all prerequisites met
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📤 [chat:join] All checks passed:');
        console.log('   ✅ Encryption ready');
        console.log('   ✅ Socket connected');
        console.log('   🎯 Joining:', conversationType, conversationId);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 🔍 DEBUG LOG: What event is being emitted
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log('[DEBUG][JOIN][EMIT]', {
            conversationId,
            conversationType,
            event: 'chat:join',
            payload: conversationId // What's being sent as first parameter
        });

        // ✅ CRITICAL FIX: Server expects conversationId as first param, NOT an object
        socket.emit('chat:join', conversationId, (response) => {
            if (response?.error) {
                console.error(`❌[chat: join] Failed to join ${conversationType}: ${response.error} `, response);

                // Handle specific error codes
                if (response.code === 'UNAUTHORIZED') {
                    console.error(`🚫[chat: join] Not authorized to join channel ${conversationId} `);
                    eventHandlerRef.current?.({
                        type: 'join-error',
                        payload: {
                            error: response.error,
                            code: response.code,
                            conversationId
                        }
                    });
                }
            } else if (response?.success) {
                console.log(`✅[chat: join] Successfully joined ${conversationType}: `, conversationId);
            }
        });
    }, [socket, conversationId, conversationType, encryptionReady]); // ✅ FIX 5: Add encryptionReady

    // Leave conversation room
    const leaveConversation = useCallback(() => {
        // 🚫 DM GUARD: Skip chat:leave for Direct Messages
        if (conversationType === 'dm') {
            console.log('🚫 [useChatSocket] Skipping chat:leave for DM (handled separately)');
            return;
        }

        if (!socket || !conversationId) return;

        // The `joinedRef` is removed, so we just emit leave if socket is connected
        if (socket.connected) {
            socket.emit('chat:leave', { conversationId });
            console.log(`👋 Left ${conversationType}: `, conversationId);
        }
    }, [socket, conversationId, conversationType]);

    // Auto-join when prerequisites are met
    useEffect(() => {
        // ✅ FIX 5: Join only when encryption ready AND socket connected
        if (encryptionReady && socket?.connected && conversationId) {
            console.log('✅ [useChatSocket] Prerequisites met, joining conversation');
            joinConversation();
        } else {
            console.log('⏳ [useChatSocket] Waiting for prerequisites:', {
                encryptionReady,
                socketConnected: socket?.connected,
                hasConversationId: !!conversationId
            });
        }

        return () => {
            if (socket?.connected && conversationId) {
                console.log(`📌 [chat:leave] Leaving ${conversationType}:`, conversationId);
                socket.emit('chat:leave', conversationId);
            }
        };
    }, [socket, conversationId, conversationType, encryptionReady, joinConversation]); // ✅ FIX 5: Add encryptionReady

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
            joinConversation();
        };

        socket.on('connect', handleConnect);

        // ==================== MESSAGE EVENTS ====================

        const handleNewMessage = (data) => {
            // Extract message and channelId from payload
            const message = data.message || data;
            const messageChannelId = message.channelId || message.channel?._id || message.channel;

            // ✅ CRITICAL FIX: Only process if message belongs to active conversation
            // Prevents cross-channel contamination when user is in multiple rooms
            // Also rejects messages with missing/invalid channelId
            if (messageChannelId !== conversationId) {
                console.log(`⏭️[useChatSocket] Message from different channel IGNORED: `, {
                    activeConversationId: conversationId,
                    receivedMessageChannelId: messageChannelId || 'MISSING',
                    action: 'IGNORED'
                });
                return; // Ignore messages from other channels
            }

            // ✅ THREAD FIX: Route thread replies separately
            // Thread replies should NOT appear in main chat message list
            if (message.parentId) {
                console.log(`[THREAD][SOCKET][RECEIVE] Thread reply detected: `, {
                    messageId: message._id,
                    parentId: message.parentId,
                    channelId: messageChannelId,
                    action: 'ROUTING_TO_THREAD_HANDLER'
                });

                eventHandlerRef.current?.({
                    type: 'thread-reply',
                    payload: data
                });
                return; // Do NOT emit as regular message
            }

            eventHandlerRef.current?.({
                type: 'new-message',
                payload: data
            });
        };

        const handleMessageSent = (data) => {
            eventHandlerRef.current?.({
                type: 'message-sent',
                payload: data
            });
        };

        // ✅ THREAD FIX: Listen for dedicated thread-reply events from backend
        const handleThreadReply = (data) => {
            console.log(`[SOCKET][THREAD - REPLY] Received thread reply event: `, {
                parentId: data.parentId,
                replyId: data.reply?._id,
                hasReply: !!data.reply
            });

            // Route to conversation handler as thread-reply event
            eventHandlerRef.current?.({
                type: 'thread-reply',
                payload: data
            });
        };

        // ✅ THREAD AWARENESS: Listen for thread:created when first reply is added
        const handleThreadCreated = (data) => {
            console.log('🧵 [THREAD][REALTIME] Thread created:', {
                parentMessageId: data.parentMessageId,
                replyCount: data.replyCount
            });

            // Route to conversation handler to update parent message
            eventHandlerRef.current?.({
                type: 'thread:created',
                payload: data
            });
        };

        const handleSendError = (data) => {
            eventHandlerRef.current?.({
                type: 'send-error',
                payload: data
            });
        };

        const handleMessageDeleted = (data) => {
            eventHandlerRef.current?.({
                type: 'message-deleted',
                payload: data
            });
        };

        const handleMessageUpdated = (data) => {
            eventHandlerRef.current?.({
                type: 'message-updated',
                payload: data
            });
        };


        const handleMessagePinned = (data) => {
            eventHandlerRef.current?.({
                type: 'message-pinned',
                payload: data
            });
        };

        const handleMessageUnpinned = (data) => {
            eventHandlerRef.current?.({
                type: 'message-unpinned',
                payload: data
            });
        };

        // ==================== REACTION EVENTS ====================

        const handleReactionAdded = (data) => {
            eventHandlerRef.current?.({
                type: 'reaction-added',
                payload: data
            });
        };

        const handleReactionRemoved = (data) => {
            eventHandlerRef.current?.({
                type: 'reaction-removed',
                payload: data
            });
        };

        // ==================== TYPING EVENTS ====================

        const handleUserTyping = (data) => {
            eventHandlerRef.current?.({
                type: 'user-typing',
                payload: data
            });
        };

        // ==================== POLL EVENTS ====================

        const handlePollCreated = (data) => {
            eventHandlerRef.current?.({
                type: 'poll-created',
                payload: data
            });
        };

        const handlePollUpdated = (data) => {
            eventHandlerRef.current?.({
                type: 'poll-updated',
                payload: data
            });
        };

        const handlePollRemoved = (data) => {
            eventHandlerRef.current?.({
                type: 'poll-removed',
                payload: data
            });
        };

        // ==================== CHANNEL EVENTS ====================

        const handleChannelUpdated = (data) => {
            eventHandlerRef.current?.({
                type: 'channel-updated',
                payload: data
            });
        };

        const handleMemberJoined = (data) => {
            eventHandlerRef.current?.({
                type: 'member-joined',
                payload: data
            });
        };

        const handleMemberLeft = (data) => {
            eventHandlerRef.current?.({
                type: 'member-left',
                payload: data
            });
        };

        // ==================== READ RECEIPTS ====================


        const handleMessageRead = (data) => {
            eventHandlerRef.current?.({
                type: 'message-read',
                payload: data
            });
        };

        // Register all event listeners
        socket.on('new-message', handleNewMessage);
        socket.on('thread-reply', handleThreadReply); // ✅ NEW: Listen for thread replies
        socket.on('thread:created', handleThreadCreated); // ✅ NEW: Listen for thread creation
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
            socket.off('thread-reply', handleThreadReply); // ✅ Cleanup thread-reply listener
            socket.off('thread:created', handleThreadCreated); // ✅ Cleanup thread:created listener
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
