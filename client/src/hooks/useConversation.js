// client/src/hooks/useConversation.js
// Manage conversation state, pagination, and optimistic updates

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // Added for redirect handling
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
    const navigate = useNavigate(); // For handling session ID redirects
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

                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // CRITICAL: Handle DM session ID mismatch (backend auto-resolution)
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // Backend may create a new session if user navigates with user ID instead of session ID
                // If redirectRequired is true, update URL to use the correct session ID
                if (response.data?.redirectRequired && response.data?.dmSessionId) {
                    const correctSessionId = response.data.dmSessionId;


                    // Determine the correct URL path based on current location
                    // Preserve whether we're in /home/dm or /messages/dm context
                    const currentPath = window.location.pathname;
                    let newPath;

                    if (currentPath.includes('/home/dm/')) {
                        // Stay in Home view
                        newPath = `/workspace/${workspaceId}/home/dm/${correctSessionId}`;
                    } else if (currentPath.includes('/messages/dm/')) {
                        // Stay in Messages view
                        newPath = `/workspace/${workspaceId}/messages/dm/${correctSessionId}`;
                    } else if (currentPath.includes('/dm/')) {
                        // Fallback for any other /dm/ route
                        newPath = currentPath.replace(
                            `/dm/${conversationId}`,
                            `/dm/${correctSessionId}`
                        );
                    }

                    if (newPath) {

                        navigate(newPath, { replace: true }); // replace: true prevents back button issues
                        return; // Exit early - component will remount with correct ID
                    }
                }
            }

            const messages = response?.data?.messages || [];
            const hasMore = response?.data?.hasMore || false; // Get hasMore from backend

            // Normalize messages into events with safe defaults
            const ATTACHMENT_TYPES = ['image', 'video', 'file', 'voice'];
            const normalized = messages.map(msg => ({
                id: msg._id,
                // Preserve type for all rich messages (image/video/file/voice/system/poll)
                // IMPORTANT: check msg.type === 'poll' FIRST — embedded polls have type:'poll'
                // but no pollId field (they store poll data inline, not as a reference)
                type: msg.type === 'system' ? 'system'
                    : msg.type === 'poll' ? 'poll'
                        : msg.pollId ? 'poll'
                            : msg.type === 'contact' ? 'contact'
                                : msg.type === 'meeting' ? 'meeting'
                                    : ATTACHMENT_TYPES.includes(msg.type) ? msg.type
                                        : 'message',
                payload: {
                    ...msg,
                    replyCount: msg.replyCount || 0,
                    reactions: msg.reactions || [],
                    isPinned: msg.isPinned || false,
                    attachments: msg.attachments || [],
                    // Convenience alias: attachment types always have exactly one entry
                    attachment: ATTACHMENT_TYPES.includes(msg.type) ? (msg.attachments?.[0] || null) : undefined,
                    isDeleted: msg.isDeleted || msg.deletedAt != null,
                    deletedBy: msg.deletedBy || null,
                    deletedByName: msg.deletedByName || null
                },
                // Hoist poll data to top level so PollEvent can find it via event.poll
                ...((msg.type === 'poll' || msg.pollId) && { poll: msg.poll }),
                // Hoist contact data to top level so MessageEvent finds it at event.contact
                ...(msg.type === 'contact' && { contact: msg.contact }),
                // For system events, also hoist the fields SystemEvent.jsx needs to the top level
                ...(msg.type === 'system' && {
                    systemEvent: msg.systemEvent,
                    systemData: msg.systemData,
                }),
                sender: msg.sender,
                createdAt: msg.createdAt,
                parentId: msg.parentId
            }));

            // 🔐 Decrypt messages before displaying (ONLY if messages exist)
            // Server already filters messages by joinedAt, so we don't need client-side filtering
            let decrypted = normalized;
            if (normalized.length > 0) {
                decrypted = await batchDecryptMessages(normalized, conversationId, conversationType, null);
            } else {

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
    }, [conversationId, conversationType, workspaceId, navigate]);

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
                type: msg.type === 'system' ? 'system'
                    : msg.type === 'poll' ? 'poll'
                        : msg.pollId ? 'poll'
                            : ATTACHMENT_TYPES.includes(msg.type) ? msg.type
                                : 'message',
                payload: {
                    ...msg,
                    replyCount: msg.replyCount || 0,
                    reactions: msg.reactions || [],
                    isPinned: msg.isPinned || false,
                    attachments: msg.attachments || [],
                    attachment: ATTACHMENT_TYPES.includes(msg.type) ? (msg.attachments?.[0] || null) : undefined,
                    isDeleted: msg.isDeleted || msg.deletedAt != null,
                    deletedBy: msg.deletedBy || null,
                    deletedByName: msg.deletedByName || null
                },
                ...((msg.type === 'poll' || msg.pollId) && { poll: msg.poll }),
                ...(msg.type === 'system' && {
                    systemEvent: msg.systemEvent,
                    systemData: msg.systemData,
                }),
                sender: msg.sender,
                createdAt: msg.createdAt,
                parentId: msg.parentId
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

    // Clear all events (for messages-cleared socket event)
    const clearEvents = useCallback((keepEvent = null) => {
        eventsMapRef.current.clear();
        if (keepEvent) {
            eventsMapRef.current.set(keepEvent.id, keepEvent);
            setEvents([keepEvent]);
        } else {
            setEvents([]);
        }
    }, []);

    // Add real-time event (from socket)
    const addRealtimeEvent = useCallback(async (event, currentUserId = null) => {


        // Deduplicate by ID
        if (eventsMapRef.current.has(event.id)) {

            // Update instead of add (might have new data like reactions)
            // ✅ Always prefer a rich quotedMessageId object over a plain string ID,
            // regardless of which event arrives first (socket vs handleSend race).
            const existingEvent = eventsMapRef.current.get(event.id);
            const existingQuotedId = existingEvent?.quotedMessageId;
            const incomingQuotedId = event.quotedMessageId;

            // Pick the richer one: object > string > null
            const preferredQuotedId =
                (typeof incomingQuotedId === 'object' && incomingQuotedId) ? incomingQuotedId
                    : (typeof existingQuotedId === 'object' && existingQuotedId) ? existingQuotedId
                        : incomingQuotedId || existingQuotedId || null;

            const mergedEvent = { ...event, quotedMessageId: preferredQuotedId };
            updateEvent(event.id, mergedEvent);
            return;
        }

        // ✅ THREAD FIX: Handle thread replies separately
        // Thread replies should NOT be inserted into main conversation message list
        const isThreadReply = event.payload?.parentId || event.payload?.message?.parentId;

        if (isThreadReply) {
            // Decrypt thread reply using message's channel context
            const messageChannelId = event.payload?.channelId
                || event.payload?.channel?._id
                || event.payload?.channel
                || conversationId;

            try {
                await batchDecryptMessages([event], messageChannelId, conversationType, null);

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



            // Server-sent realtime messages are already valid for this user
            // No need for client-side filtering
            const decrypted = await batchDecryptMessages([event], messageChannelId, conversationType, null);
            processedEvent = decrypted[0] || event;


        }

        // Check if this is the sender's own message (replace optimistic message)
        if (currentUserId && processedEvent.sender?._id === currentUserId) {


            // First try to match by clientTempId (most reliable)
            if (processedEvent.payload?.clientTempId || processedEvent.clientTempId) {
                const clientTempId = processedEvent.payload?.clientTempId || processedEvent.clientTempId;
                const optimisticMessage = [...eventsMapRef.current.values()].find(
                    e => e.id === clientTempId
                );

                if (optimisticMessage) {

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

                eventsMapRef.current.delete(optimisticMessage.id);
                eventsMapRef.current.set(processedEvent.id, processedEvent);
                setEvents(prev => prev.map(e => e.id === optimisticMessage.id ? processedEvent : e));
                return;
            } else {
                console.warn(`⚠️ [useConversation] No optimistic message found for clientTempId or status`);
            }
        }

        eventsMapRef.current.set(processedEvent.id, processedEvent);
        setEvents(prev => {
            // Ensure the new event isn't already in the array (extra safety)
            const exists = prev.some(e => e.id === processedEvent.id);
            if (exists) {
                return prev;
            }
            return [...prev, processedEvent];
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
    }, [conversationId, conversationType, workspaceId, reset, loadMessages]); // eslint-disable-line react-hooks/exhaustive-deps

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
        clearEvents,
        addRealtimeEvent,
        reset,
        reload: loadMessages
    };
}
