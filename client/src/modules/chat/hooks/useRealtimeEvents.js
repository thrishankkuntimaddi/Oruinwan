/**
 * useRealtimeEvents Hook
 * 
 * Handles real-time socket events for a conversation
 * Normalizes all socket events to RealtimeEvent primitives
 * 
 * @module chat/hooks/useRealtimeEvents
 */

import { useEffect, useCallback } from 'react';
import { useSocket } from '../../../contexts/SocketContext';
import { createRealtimeEvent } from '../types/primitives';

/**
 * Hook for handling realtime events
 * 
 * @param {string} conversationId - Conversation ID
 * @param {'channel'|'dm'|'thread'} conversationType - Conversation type
 * @param {Object} handlers - Event handlers
 * @param {Function} [handlers.onMessage] - New message handler
 * @param {Function} [handlers.onTyping] - Typing indicator handler
 * @param {Function} [handlers.onPresence] - Presence change handler
 * @param {Function} [handlers.onMessageUpdate] - Message edit/delete handler
 * @param {Function} [handlers.onPoll] - Poll event handler
 * @param {Function} [handlers.onMeeting] - Meeting event handler
 * @param {Function} [handlers.onConversationState] - Conversation state change handler
 * @param {Function} [handlers.onEvent] - Generic event handler (catches all)
 * @returns {Object} Event emitter functions
 */
export function useRealtimeEvents(conversationId, conversationType, handlers = {}) {
    const socket = useSocket();

    // ============================================================
    // EVENT LISTENERS
    // ============================================================

    /**
     * Listen for unified conversation events
     */
    useEffect(() => {
        if (!socket || !conversationId) return;

        const handleConversationEvent = (data) => {
            const event = createRealtimeEvent(data.event.type, {
                conversationId: data.conversationId,
                userId: data.event.userId,
                payload: data.event.payload,
                timestamp: data.event.timestamp
            });

            // Route to specific handler
            switch (event.type) {
                case 'message':
                    handlers.onMessage?.(event);
                    break;
                case 'poll':
                    handlers.onPoll?.(event);
                    break;
                case 'meeting':
                    handlers.onMeeting?.(event);
                    break;
                case 'system':
                    handlers.onConversationState?.(event);
                    break;
                case 'edit':
                case 'delete':
                    handlers.onMessageUpdate?.(event);
                    break;
                default:
                    console.log('Unknown event type:', event.type);
            }

            // Always call generic handler
            handlers.onEvent?.(event);
        };

        socket.on('conversation:event', handleConversationEvent);

        return () => {
            socket.off('conversation:event', handleConversationEvent);
        };
    }, [socket, conversationId, handlers]);

    /**
     * Listen for typing indicators
     */
    useEffect(() => {
        if (!socket || !conversationId) return;

        const handleTyping = (data) => {
            const event = createRealtimeEvent('typing', {
                conversationId,
                userId: data.userId,
                payload: { isTyping: data.isTyping },
                timestamp: new Date()
            });

            handlers.onTyping?.(event);
            handlers.onEvent?.(event);
        };

        socket.on('chat:user_typing', handleTyping);

        return () => {
            socket.off('chat:user_typing', handleTyping);
        };
    }, [socket, conversationId, handlers]);

    /**
     * Listen for presence updates (workspace-wide)
     */
    useEffect(() => {
        if (!socket) return;

        const handleOnline = (data) => {
            const event = createRealtimeEvent('presence', {
                userId: data.userId,
                payload: { status: 'online' },
                timestamp: data.timestamp
            });

            handlers.onPresence?.(event);
            handlers.onEvent?.(event);
        };

        const handleOffline = (data) => {
            const event = createRealtimeEvent('presence', {
                userId: data.userId,
                payload: { status: 'offline', lastSeen: data.lastSeen },
                timestamp: new Date()
            });

            handlers.onPresence?.(event);
            handlers.onEvent?.(event);
        };

        const handleStatusChange = (data) => {
            const event = createRealtimeEvent('presence', {
                userId: data.userId,
                payload: {
                    status: data.status,
                    customStatus: data.customStatus
                },
                timestamp: data.timestamp || new Date()
            });

            handlers.onPresence?.(event);
            handlers.onEvent?.(event);
        };

        socket.on('user:online', handleOnline);
        socket.on('user:offline', handleOffline);
        socket.on('user:status_change', handleStatusChange);

        return () => {
            socket.off('user:online', handleOnline);
            socket.off('user:offline', handleOffline);
            socket.off('user:status_change', handleStatusChange);
        };
    }, [socket, handlers]);

    /**
     * Listen for poll events (legacy)
     */
    useEffect(() => {
        if (!socket || !conversationId || conversationType !== 'channel') return;

        const handlePollNew = (poll) => {
            const event = createRealtimeEvent('poll', {
                conversationId,
                payload: poll,
                timestamp: new Date()
            });

            handlers.onPoll?.(event);
            handlers.onEvent?.(event);
        };

        const handlePollUpdate = (poll) => {
            const event = createRealtimeEvent('poll_update', {
                conversationId,
                payload: poll,
                timestamp: new Date()
            });

            handlers.onPoll?.(event);
            handlers.onEvent?.(event);
        };

        const handlePollRemoved = (data) => {
            const event = createRealtimeEvent('poll_removed', {
                conversationId,
                payload: data,
                timestamp: new Date()
            });

            handlers.onPoll?.(event);
            handlers.onEvent?.(event);
        };

        socket.on('poll:new', handlePollNew);
        socket.on('poll:update', handlePollUpdate);
        socket.on('poll:removed', handlePollRemoved);

        return () => {
            socket.off('poll:new', handlePollNew);
            socket.off('poll:update', handlePollUpdate);
            socket.off('poll:removed', handlePollRemoved);
        };
    }, [socket, conversationId, conversationType, handlers]);

    /**
     * Listen for meeting events
     */
    useEffect(() => {
        if (!socket || !conversationId || conversationType !== 'channel') return;

        const handleMeetingCreated = (meeting) => {
            const event = createRealtimeEvent('meeting', {
                conversationId,
                payload: { action: 'created', meeting },
                timestamp: new Date()
            });

            handlers.onMeeting?.(event);
            handlers.onEvent?.(event);
        };

        const handleMeetingJoined = (data) => {
            const event = createRealtimeEvent('meeting_joined', {
                conversationId,
                userId: data.userId,
                payload: data,
                timestamp: data.timestamp
            });

            handlers.onMeeting?.(event);
            handlers.onEvent?.(event);
        };

        const handleMeetingLeft = (data) => {
            const event = createRealtimeEvent('meeting_left', {
                conversationId,
                userId: data.userId,
                payload: data,
                timestamp: data.timestamp
            });

            handlers.onMeeting?.(event);
            handlers.onEvent?.(event);
        };

        const handleMeetingEnded = (data) => {
            const event = createRealtimeEvent('meeting_ended', {
                conversationId,
                payload: data,
                timestamp: data.timestamp
            });

            handlers.onMeeting?.(event);
            handlers.onEvent?.(event);
        };

        socket.on('meeting:created', handleMeetingCreated);
        socket.on('meeting:joined', handleMeetingJoined);
        socket.on('meeting:left', handleMeetingLeft);
        socket.on('meeting:ended', handleMeetingEnded);

        return () => {
            socket.off('meeting:created', handleMeetingCreated);
            socket.off('meeting:joined', handleMeetingJoined);
            socket.off('meeting:left', handleMeetingLeft);
            socket.off('meeting:ended', handleMeetingEnded);
        };
    }, [socket, conversationId, conversationType, handlers]);

    // ============================================================
    // EVENT EMITTERS
    // ============================================================

    /**
     * Emit a conversation event
     */
    const emitConversationEvent = useCallback((eventType, payload) => {
        if (!socket || !conversationId) return;

        socket.emit('conversation:event', {
            conversationId,
            conversationType,
            event: {
                type: eventType,
                payload,
                timestamp: new Date()
            }
        });
    }, [socket, conversationId, conversationType]);

    /**
     * Emit typing indicator
     */
    const emitTyping = useCallback((isTyping) => {
        if (!socket || !conversationId) return;

        socket.emit('chat:typing', {
            [conversationType === 'channel' ? 'channelId' : 'dmId']: conversationId,
            isTyping
        });
    }, [socket, conversationId, conversationType]);

    /**
     * Emit presence update
     */
    const emitPresence = useCallback((status, customStatus = null) => {
        if (!socket) return;

        socket.emit('user:status_change', {
            status,
            customStatus
        });
    }, [socket]);

    /**
     * Join a conversation room
     */
    const joinConversation = useCallback(() => {
        if (!socket || !conversationId) return;

        socket.emit('conversation:join', {
            conversationId,
            type: conversationType
        });
    }, [socket, conversationId, conversationType]);

    /**
     * Leave a conversation room
     */
    const leaveConversation = useCallback(() => {
        if (!socket || !conversationId) return;

        socket.emit('conversation:leave', {
            conversationId,
            type: conversationType
        });
    }, [socket, conversationId, conversationType]);

    // ============================================================
    // RETURN
    // ============================================================

    return {
        // Emitters
        emitConversationEvent,
        emitTyping,
        emitPresence,
        joinConversation,
        leaveConversation
    };
}

export default useRealtimeEvents;
