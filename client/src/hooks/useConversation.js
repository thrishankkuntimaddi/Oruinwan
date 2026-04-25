import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { useAuth } from '../contexts/AuthContext'; 
import api from '@services/api';
import { batchDecryptMessages } from '../services/messageEncryptionService';

export function useConversation(conversationId, conversationType, workspaceId) {
    
    const { encryptionReady } = useAuth(); 
    const navigate = useNavigate(); 
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState(null);
    const [historyLoaded, setHistoryLoaded] = useState(false); 

    const loadedRef = useRef(false);
    const eventsMapRef = useRef(new Map()); 

    
    const loadMessages = useCallback(async () => {
        if (!conversationId || loadedRef.current) return;

        setLoading(true);
        loadedRef.current = true; 
        setError(null); 

        try {
            let response;

            if (conversationType === 'channel') {
                response = await api.get(`/api/v2/messages/channel/${conversationId}`, {
                    params: { limit: 50 } 
                });
            } else if (conversationType === 'dm') {
                response = await api.get(`/api/v2/messages/workspace/${workspaceId}/dm/${conversationId}`, {
                    params: { limit: 50 } 
                });

                
                
                
                
                
                if (response.data?.redirectRequired && response.data?.dmSessionId) {
                    const correctSessionId = response.data.dmSessionId;

                    
                    
                    const currentPath = window.location.pathname;
                    let newPath;

                    if (currentPath.includes('/home/dm/')) {
                        
                        newPath = `/workspace/${workspaceId}/home/dm/${correctSessionId}`;
                    } else if (currentPath.includes('/messages/dm/')) {
                        
                        newPath = `/workspace/${workspaceId}/messages/dm/${correctSessionId}`;
                    } else if (currentPath.includes('/dm/')) {
                        
                        newPath = currentPath.replace(
                            `/dm/${conversationId}`,
                            `/dm/${correctSessionId}`
                        );
                    }

                    if (newPath) {

                        navigate(newPath, { replace: true }); 
                        return; 
                    }
                }
            }

            const messages = response?.data?.messages || [];
            const hasMore = response?.data?.hasMore || false; 

            
            const ATTACHMENT_TYPES = ['image', 'video', 'file', 'voice'];
            const normalized = messages.map(msg => ({
                id: msg._id,
                
                
                
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
                    
                    attachment: ATTACHMENT_TYPES.includes(msg.type) ? (msg.attachments?.[0] || null) : undefined,
                    isDeleted: msg.isDeleted || msg.deletedAt != null,
                    deletedBy: msg.deletedBy || null,
                    deletedByName: msg.deletedByName || null
                },
                
                ...((msg.type === 'poll' || msg.pollId) && { poll: msg.poll }),
                
                ...(msg.type === 'contact' && { contact: msg.contact }),
                
                ...(msg.type === 'system' && {
                    systemEvent: msg.systemEvent,
                    systemData: msg.systemData,
                }),
                sender: msg.sender,
                createdAt: msg.createdAt,
                parentId: msg.parentId
            }));

            
            
            let decrypted = normalized;
            if (normalized.length > 0) {
                decrypted = await batchDecryptMessages(normalized, conversationId, conversationType, null);
            } else {

            }

            
            decrypted.forEach(event => {
                eventsMapRef.current.set(event.id, event);
            });

            
            setEvents(Array.from(eventsMapRef.current.values()));
            setHasMore(hasMore);
            setHistoryLoaded(true); 
        } catch (err) {
            console.error('Error loading messages:', err);
            setError(err.response?.data?.message || 'Failed to load messages');
            setHistoryLoaded(true); 
        } finally {
            setLoading(false);
        }
    }, [conversationId, conversationType, workspaceId, navigate]);

    
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

            
            
            let decrypted = normalized;
            if (normalized.length > 0) {
                decrypted = await batchDecryptMessages(normalized, conversationId, conversationType, null);
            }

            
            decrypted.forEach(event => {
                if (!eventsMapRef.current.has(event.id)) {
                    eventsMapRef.current.set(event.id, event);
                }
            });

            
            setEvents(prev => [...decrypted, ...prev]);
            setHasMore(more);
        } catch (err) {
            console.error('Error loading more messages:', err);
        } finally {
            setLoading(false);
        }
    }, [conversationId, conversationType, workspaceId, events, loading, hasMore]);

    
    const addOptimisticEvent = useCallback((event) => {
        
        if (eventsMapRef.current.has(event.id)) {
            return;
        }

        eventsMapRef.current.set(event.id, event);
        setEvents(prev => [...prev, event]);
    }, []);

    
    const updateEvent = useCallback((eventId, updates) => {
        setEvents(prev => prev.map(event => {
            if (event.id === eventId) {
                
                const updated = { ...event, ...updates };
                if (updates.payload && event.payload) {
                    updated.payload = { ...event.payload, ...updates.payload };
                }
                return updated;
            }
            return event;
        }));

        
        const existing = eventsMapRef.current.get(eventId);
        if (existing) {
            const updated = { ...existing, ...updates };
            if (updates.payload && existing.payload) {
                updated.payload = { ...existing.payload, ...updates.payload };
            }
            eventsMapRef.current.set(eventId, updated);
        }
    }, []);

    
    const removeEvent = useCallback((eventId) => {
        setEvents(prev => prev.filter(event => event.id !== eventId));
        eventsMapRef.current.delete(eventId);
    }, []);

    
    const replaceEvent = useCallback((tempId, realEvent) => {
        setEvents(prev => prev.map(event =>
            event.id === tempId ? realEvent : event
        ));

        eventsMapRef.current.delete(tempId);
        eventsMapRef.current.set(realEvent.id, realEvent);
    }, []);

    
    const clearEvents = useCallback((keepEvent = null) => {
        eventsMapRef.current.clear();
        if (keepEvent) {
            eventsMapRef.current.set(keepEvent.id, keepEvent);
            setEvents([keepEvent]);
        } else {
            setEvents([]);
        }
    }, []);

    
    const addRealtimeEvent = useCallback(async (event, currentUserId = null) => {

        
        if (eventsMapRef.current.has(event.id)) {

            
            
            
            const existingEvent = eventsMapRef.current.get(event.id);
            const existingQuotedId = existingEvent?.quotedMessageId;
            const incomingQuotedId = event.quotedMessageId;

            
            const preferredQuotedId =
                (typeof incomingQuotedId === 'object' && incomingQuotedId) ? incomingQuotedId
                    : (typeof existingQuotedId === 'object' && existingQuotedId) ? existingQuotedId
                        : incomingQuotedId || existingQuotedId || null;

            const mergedEvent = { ...event, quotedMessageId: preferredQuotedId };
            updateEvent(event.id, mergedEvent);
            return;
        }

        
        
        const isThreadReply = event.payload?.parentId || event.payload?.message?.parentId;

        if (isThreadReply) {
            
            const messageChannelId = event.payload?.channelId
                || event.payload?.channel?._id
                || event.payload?.channel
                || conversationId;

            try {
                await batchDecryptMessages([event], messageChannelId, conversationType, null);

                
                
            } catch (err) {
                console.error('[THREAD][REALTIME][DECRYPT] Failed to decrypt thread reply:', err);
            }

            return; 
        }

        
        let processedEvent = event;
        if (event.type === 'message') {

            
            
            
            
            
            
            
            const messageChannelId = event.payload?.channelId
                || event.payload?.channel?._id
                || event.payload?.channel
                || event.payload?.message?.channelId
                || event.payload?.message?.channel?._id
                || event.payload?.message?.channel
                || conversationId; 

            
            
            const decrypted = await batchDecryptMessages([event], messageChannelId, conversationType, null);
            processedEvent = decrypted[0] || event;

        }

        
        if (currentUserId && processedEvent.sender?._id === currentUserId) {

            
            if (processedEvent.payload?.clientTempId || processedEvent.clientTempId) {
                const clientTempId = processedEvent.payload?.clientTempId || processedEvent.clientTempId;
                const optimisticMessage = [...eventsMapRef.current.values()].find(
                    e => e.id === clientTempId
                );

                if (optimisticMessage) {

                    
                    eventsMapRef.current.delete(optimisticMessage.id);
                    
                    eventsMapRef.current.set(processedEvent.id, processedEvent);
                    
                    setEvents(prev => prev.map(e => e.id === optimisticMessage.id ? processedEvent : e));
                    return;
                }
            }

            
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
            
            const exists = prev.some(e => e.id === processedEvent.id);
            if (exists) {
                return prev;
            }
            return [...prev, processedEvent];
        });
    }, [conversationId, conversationType, updateEvent]);

    
    const reset = useCallback(() => {
        setEvents([]);
        setError(null);
        setHistoryLoaded(false); 
        loadedRef.current = false;
        eventsMapRef.current.clear();
    }, []);

    
    useEffect(() => {
        if (conversationId) {
            reset();
            loadMessages();
        }
    }, [conversationId, conversationType, workspaceId, reset, loadMessages]); 

    return {
        events,
        loading,
        hasMore,
        error,
        historyLoaded, 
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
