// client/src/hooks/useConversation.js
// Manage conversation state, pagination, and optimistic updates

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext'; // ✅ FIX 4: Import useAuth
import api from '../services/api';
import { batchDecryptMessages } from '../services/messageEncryptionService';

/**
 * Manages conversation events (messages, polls, system events)
 * @param {string} conversationId - Channel ID or DM Session ID
 * @param {string} conversationType - "channel" | "dm"
 * @param {string} workspaceId - Workspace ID (for DMs)
 * @returns {object} Conversation state and methods
 */
export function useConversation(conversationId, conversationType, workspaceId) {
    // eslint-disable-next-line no-unused-vars
    const { encryptionReady } = useAuth(); // ✅ FIX 4: Get encryption ready flag (prepared for guarded prefetch)
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState(null);
    const [historyLoaded, setHistoryLoaded] = useState(false); // Flag for deterministic socket join

    const loadedRef = useRef(false);
    const eventsMapRef = useRef(new Map()); // For deduplication with stable Map

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
                    params: { limit: 50 } // Cursor-based, no offset
                });
            } else if (conversationType === 'dm') {
                response = await api.get(`/api/v2/messages/workspace/${workspaceId}/dm/${conversationId}`, {
                    params: { limit: 50 } // Cursor-based, no offset
                });
            }

            const messages = response?.data?.messages || [];
            const hasMore = response?.data?.hasMore || false; // Get hasMore from backend

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

            // 🔐 Decrypt messages before displaying (ONLY if messages exist)
            // Server already filters messages by joinedAt, so we don't need client-side filtering
            let decrypted = normalized;
            if (normalized.length > 0) {
                decrypted = await batchDecryptMessages(normalized, conversationId, conversationType, null);
            } else {
                console.log('ℹ️ [PHASE 3] No messages to decrypt - channel UNINITIALIZED');
            }

            // Populate Map for deduplication
            decrypted.forEach(event => {
                eventsMapRef.current.set(event.id, event);
            });

            // Set state from Map to ensure no duplicates
            setEvents(Array.from(eventsMapRef.current.values()));
            setHasMore(hasMore);
            setHistoryLoaded(true); // Mark history as loaded for socket join
        } catch (err) {
            console.error('Error loading messages:', err);
            setError(err.response?.data?.message || 'Failed to load messages');
            setHistoryLoaded(true); // Mark as loaded even on error to prevent blocking
        } finally {
            setLoading(false);
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

            const normalized = messages.map(msg => ({
                id: msg._id,
                type: msg.pollId ? 'poll' : 'message',
                payload: msg,
                sender: msg.sender,
                createdAt: msg.createdAt,
                parentId: msg.threadParent
            }));

            // 🔐 Decrypt messages before displaying (ONLY if messages exist)
            // Server already filters messages by joinedAt, so we don't need client-side filtering
            let decrypted = normalized;
            if (normalized.length > 0) {
                decrypted = await batchDecryptMessages(normalized, conversationId, conversationType, null);
            }

            // Add to dedup map
            decrypted.forEach(event => {
                if (!eventsMapRef.current.has(event.id)) {
                    eventsMapRef.current.set(event.id, event);
                }
            });

            // Prepend older messages
            setEvents(prev => [...decrypted, ...prev]);
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
    const addRealtimeEvent = useCallback(async (event, currentUserId = null) => {
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

        // ✅ THREAD FIX: Handle thread replies separately
        // Thread replies should NOT be inserted into main conversation message list
        const isThreadReply = event.payload?.parentId || event.payload?.message?.parentId;

        if (isThreadReply) {
            console.log(`[THREAD][REALTIME][DECRYPT] Thread reply received, bypassing main message list:`, {
                messageId: event.id || event.payload?._id,
                parentId: event.payload?.parentId || event.payload?.message?.parentId,
                channelId: event.payload?.channelId || event.payload?.channel
            });

            // Decrypt thread reply using message's channel context
            const messageChannelId = event.payload?.channelId
                || event.payload?.channel?._id
                || event.payload?.channel
                || conversationId;

            console.log(`[THREAD][REALTIME][DECRYPT] Decrypting thread reply with channel context: ${messageChannelId}`);

            try {
                await batchDecryptMessages([event], messageChannelId, conversationType, null);
                console.log(`✅ [THREAD][REALTIME][DECRYPT] Thread reply decrypted successfully`);

                // Thread replies are handled by ThreadPanel listeners, not main conversation
                // Exit early to prevent insertion into main message list
            } catch (err) {
                console.error('[THREAD][REALTIME][DECRYPT] Failed to decrypt thread reply:', err);
            }

            return; // Exit early - thread replies don't go in main message list
        }

        // 🔐 Decrypt message if it's encrypted (ALL messages are encrypted now)
        let processedEvent = event;
        if (event.type === 'message') {
            console.log(`🔐 [useConversation] Decrypting realtime message ${event.id}:`, {
                hasPayload: !!event.payload,
                hasCiphertext: !!event.payload?.ciphertext,
                hasNestedPayload: !!event.payload?.payload,
                hasNestedCiphertext: !!event.payload?.payload?.ciphertext,
                isEncrypted: event.payload?.isEncrypted || event.payload?.payload?.isEncrypted
            });

            // ✅ CRITICAL FIX: Extract channelId from MESSAGE, not from hook closure
            // This prevents using stale/wrong conversationId for decryption
            // Handle multiple possible payload structures:
            // 1. event.payload.channelId (direct field)
            // 2. event.payload.channel (ObjectId or populated)
            // 3. event.payload.message.channelId (nested structure from socket)
            // 4. event.payload.message.channel (nested structure from socket)
            const messageChannelId = event.payload?.channelId
                || event.payload?.channel?._id
                || event.payload?.channel
                || event.payload?.message?.channelId
                || event.payload?.message?.channel?._id
                || event.payload?.message?.channel
                || conversationId; // Fallback for DMs or legacy messages

            console.log(`🔐 [useConversation] Decryption context:`, {
                eventId: event.id,
                extractedMessageChannelId: messageChannelId,
                activeConversationId: conversationId,
                isMatch: messageChannelId === conversationId
            });

            // Server-sent realtime messages are already valid for this user
            // No need for client-side filtering
            const decrypted = await batchDecryptMessages([event], messageChannelId, conversationType, null);
            processedEvent = decrypted[0] || event;

            console.log(`✅ [useConversation] Decrypted realtime message:`, {
                id: processedEvent.id,
                hasDecryptedContent: !!processedEvent.decryptedContent,
                decryptedText: processedEvent.decryptedContent?.substring(0, 20)
            });
        }

        // Check if this is the sender's own message (replace optimistic message)
        if (currentUserId && processedEvent.sender?._id === currentUserId) {
            console.log(`🔍 [useConversation] Message is from current user, checking for optimistic match...`);

            // First try to match by clientTempId (most reliable)
            if (processedEvent.payload?.clientTempId || processedEvent.clientTempId) {
                const clientTempId = processedEvent.payload?.clientTempId || processedEvent.clientTempId;
                const optimisticMessage = [...eventsMapRef.current.values()].find(
                    e => e.id === clientTempId
                );

                if (optimisticMessage) {
                    console.log(`✅ [useConversation] Found optimistic message by clientTempId:`, {
                        optimisticId: optimisticMessage.id,
                        realId: processedEvent.id,
                        clientTempId
                    });
                    // Remove optimistic from map
                    eventsMapRef.current.delete(optimisticMessage.id);
                    // Add real message
                    eventsMapRef.current.set(processedEvent.id, processedEvent);
                    // Replace in state
                    setEvents(prev => prev.map(e => e.id === optimisticMessage.id ? processedEvent : e));
                    return;
                }
            }

            // Fallback: Find by status 'sending' (legacy)
            const allEvents = [...eventsMapRef.current.values()];
            const optimisticMessage = allEvents.find(
                e => e.status === 'sending' && e.sender?._id === currentUserId
            );

            if (optimisticMessage) {
                console.log(`✅ [useConversation] Found optimistic message by status:`, {
                    optimisticId: optimisticMessage.id,
                    realId: processedEvent.id
                });
                eventsMapRef.current.delete(optimisticMessage.id);
                eventsMapRef.current.set(processedEvent.id, processedEvent);
                setEvents(prev => prev.map(e => e.id === optimisticMessage.id ? processedEvent : e));
                return;
            } else {
                console.warn(`⚠️ [useConversation] No optimistic message found for clientTempId or status`);
            }
        }

        console.log(`✅ [useConversation] Adding new realtime event ${processedEvent.id} to conversation`);
        eventsMapRef.current.set(processedEvent.id, processedEvent);
        setEvents(prev => {
            // Ensure the new event isn't already in the array (extra safety)
            const exists = prev.some(e => e.id === processedEvent.id);
            if (exists) {
                console.warn(`⚠️ [useConversation] Event ${processedEvent.id} already in state array, skipping add`);
                return prev;
            }
            const newEvents = [...prev, processedEvent];
            console.log(`📊 [useConversation] Events count: ${prev.length} -> ${newEvents.length}`, {
                newEventId: processedEvent.id,
                newEventText: processedEvent.decryptedContent?.substring(0, 30) || processedEvent.payload?.text?.substring(0, 30)
            });
            return newEvents;
        });
    }, [conversationId, conversationType, updateEvent]);

    // Reset conversation (for switching conversations)
    const reset = useCallback(() => {
        setEvents([]);
        setError(null);
        setHistoryLoaded(false); // Reset history loaded flag
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
        historyLoaded, // Export for socket join guard
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
