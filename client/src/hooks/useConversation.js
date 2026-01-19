// client/src/hooks/useConversation.js
// Manage conversation state, pagination, and optimistic updates

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

/**
 * Manages conversation events (messages, polls, system events)
 * @param {string} conversationId - Channel ID or DM Session ID
 * @param {string} conversationType - "channel" | "dm"
 * @param {string} workspaceId - Workspace ID (for DMs)
 * @returns {object} Conversation state and methods
 */
export function useConversation(conversationId, conversationType, workspaceId = null) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState(null);
    const [totalCount, setTotalCount] = useState(0);

    const loadedRef = useRef(false);
    const eventsMapRef = useRef(new Map()); // For deduplication

    // Load initial messages
    const loadMessages = useCallback(async () => {
        if (!conversationId || loadedRef.current) return;

        setLoading(true);
        loadedRef.current = true; // Use loadedRef consistently
        setError(null); // Keep error reset

        try {
            let response;

            if (conversationType === 'channel') {
                response = await api.get(`/api/v2/messages/channel/${conversationId}`, {
                    params: { limit: 50, offset: 0 }
                });
            } else if (conversationType === 'dm') {
                response = await api.get(`/api/v2/messages/workspace/${workspaceId}/dm/${conversationId}`, {
                    params: { limit: 50, offset: 0 }
                });
            }

            const messages = response?.data?.messages || [];

            // Normalize messages into events with safe defaults
            const normalized = messages.map(msg => ({
                id: msg._id,
                type: msg.pollId ? 'poll' : 'message',
                payload: {
                    ...msg,
                    replyCount: msg.replyCount || 0,
                    reactions: msg.reactions || [],
                    isPinned: msg.isPinned || false,
                    attachments: msg.attachments || [],
                    isDeleted: msg.isDeleted || msg.deletedAt != null,
                    deletedBy: msg.deletedBy || null,
                    deletedByName: msg.deletedByName || null
                },
                sender: msg.sender,
                createdAt: msg.createdAt,
                parentId: msg.threadParent
            }));

            // Populate dedup map (re-adding this as it was removed in the snippet but is crucial for eventsMapRef)
            normalized.forEach(event => {
                eventsMapRef.current.set(event.id, event);
            });

            setEvents(normalized);
            setHasMore(messages.length >= 50);
            // setTotalCount(response?.data?.total || 0); // Re-add totalCount update if needed, or remove state if not used
        } catch (err) {
            console.error('Error loading messages:', err);
            setError(err.response?.data?.message || 'Failed to load messages');
        } finally {
            setLoading(false);
            // loadedRef.current = false; // Do not reset loadedRef here, it indicates initial load is done
        }
    }, [conversationId, conversationType, workspaceId]);

    // Load more messages (pagination)
    const loadMore = useCallback(async () => {
        if (!conversationId || loading || !hasMore) return;

        setLoading(true);

        try {
            const oldestEvent = events[0];
            if (!oldestEvent) return;

            let response;

            if (conversationType === 'channel') {
                response = await api.get(`/api/v2/messages/channel/${conversationId}`, {
                    params: { limit: 50, before: oldestEvent.id }
                });
            } else if (conversationType === 'dm') {
                response = await api.get(`/api/v2/messages/workspace/${workspaceId}/dm/${conversationId}`, {
                    params: { limit: 50, before: oldestEvent.id }
                });
            }

            const { messages = [], hasMore: more = false } = response.data;

            const newEvents = messages.map(msg => ({
                id: msg._id,
                type: msg.pollId ? 'poll' : 'message',
                payload: msg,
                sender: msg.sender,
                createdAt: msg.createdAt,
                parentId: msg.threadParent
            }));

            // Add to dedup map
            newEvents.forEach(event => {
                if (!eventsMapRef.current.has(event.id)) {
                    eventsMapRef.current.set(event.id, event);
                }
            });

            // Prepend older messages
            setEvents(prev => [...newEvents, ...prev]);
            setHasMore(more);
        } catch (err) {
            console.error('Error loading more messages:', err);
        } finally {
            setLoading(false);
        }
    }, [conversationId, conversationType, workspaceId, events, loading, hasMore]);

    // Add optimistic event (for sending messages)
    const addOptimisticEvent = useCallback((event) => {
        // Check for duplicates
        if (eventsMapRef.current.has(event.id)) {
            return;
        }

        eventsMapRef.current.set(event.id, event);
        setEvents(prev => [...prev, event]);
    }, []);

    // Update existing event
    const updateEvent = useCallback((eventId, updates) => {
        setEvents(prev => prev.map(event => {
            if (event.id === eventId) {
                // Deep merge for payload to preserve nested properties
                const updated = { ...event, ...updates };
                if (updates.payload && event.payload) {
                    updated.payload = { ...event.payload, ...updates.payload };
                }
                return updated;
            }
            return event;
        }));

        // Update dedup map
        const existing = eventsMapRef.current.get(eventId);
        if (existing) {
            const updated = { ...existing, ...updates };
            if (updates.payload && existing.payload) {
                updated.payload = { ...existing.payload, ...updates.payload };
            }
            eventsMapRef.current.set(eventId, updated);
        }
    }, []);

    // Remove event (for deletions)
    const removeEvent = useCallback((eventId) => {
        setEvents(prev => prev.filter(event => event.id !== eventId));
        eventsMapRef.current.delete(eventId);
    }, []);

    // Replace optimistic event with real one
    const replaceEvent = useCallback((tempId, realEvent) => {
        setEvents(prev => prev.map(event =>
            event.id === tempId ? realEvent : event
        ));

        eventsMapRef.current.delete(tempId);
        eventsMapRef.current.set(realEvent.id, realEvent);
    }, []);

    // Add real-time event (from socket)
    const addRealtimeEvent = useCallback((event, currentUserId = null) => {
        console.log(`🔄 [useConversation] Processing realtime event:`, {
            eventId: event.id,
            eventType: event.type,
            sender: event.sender?._id,
            currentUser: currentUserId,
            hasExisting: eventsMapRef.current.has(event.id),
            currentEventCount: eventsMapRef.current.size
        });

        // Deduplicate by ID
        if (eventsMapRef.current.has(event.id)) {
            console.log(`⚠️ [useConversation] Event ${event.id} already exists, updating instead`);
            // Update instead of add (might have new data like reactions)
            updateEvent(event.id, event);
            return;
        }

        // Check if this is the sender's own message (replace optimistic message)
        if (currentUserId && event.sender?._id === currentUserId) {
            console.log(`🔍 [useConversation] Message is from current user, looking for optimistic message...`);

            // Get all events and log them
            const allEvents = [...eventsMapRef.current.values()];
            console.log(`📋 [useConversation] Current events:`, allEvents.map(e => ({
                id: e.id,
                status: e.status,
                sender: e.sender?._id,
                text: e.payload?.text?.substring(0, 20)
            })));

            // Find any optimistic message with status 'sending' from this user
            const optimisticMessage = allEvents.find(
                e => e.status === 'sending' && e.sender?._id === currentUserId
            );

            if (optimisticMessage) {
                console.log(`✅ [useConversation] Found optimistic message to replace:`, {
                    optimisticId: optimisticMessage.id,
                    realId: event.id,
                    optimisticText: optimisticMessage.payload?.text,
                    realText: event.payload?.text || event.payload?.payload?.text
                });
                // Remove optimistic from map
                eventsMapRef.current.delete(optimisticMessage.id);
                // Add real message
                eventsMapRef.current.set(event.id, event);
                // Replace in state
                setEvents(prev => prev.map(e => e.id === optimisticMessage.id ? event : e));
                return;
            } else {
                console.warn(`⚠️ [useConversation] No optimistic message found for sender ${currentUserId}`);
            }
        }

        console.log(`✅ [useConversation] Adding new realtime event ${event.id} to conversation`);
        eventsMapRef.current.set(event.id, event);
        setEvents(prev => {
            const newEvents = [...prev, event];
            console.log(`📊 [useConversation] Events count: ${prev.length} -> ${newEvents.length}`);
            return newEvents;
        });
    }, [updateEvent]);

    // Reset conversation (for switching conversations)
    const reset = useCallback(() => {
        setEvents([]);
        setLoading(false);
        setHasMore(false);
        setError(null);
        setTotalCount(0);
        loadedRef.current = false;
        eventsMapRef.current.clear();
    }, []);

    // Load messages on mount or when conversation changes
    useEffect(() => {
        if (conversationId) {
            reset();
            loadMessages();
        }
    }, [conversationId, conversationType, workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        events,
        loading,
        hasMore,
        error,
        totalCount,
        loadMore,
        addOptimisticEvent,
        updateEvent,
        removeEvent,
        replaceEvent,
        addRealtimeEvent,
        reset,
        reload: loadMessages
    };
}
