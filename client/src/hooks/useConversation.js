import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { useAuth } from '../contexts/AuthContext'; 
import api from '@services/api';
import { batchDecryptMessages } from '../services/messageEncryptionService';
import logger from '../utils/logger';
import { normalizeMessage, mergeUniqueEvents, newestPersistedEvent } from './conversationUtils';

export function useConversation(conversationId, conversationType, workspaceId) {
    
    const { encryptionReady } = useAuth(); 
    const navigate = useNavigate(); 
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [hasMoreNewer, setHasMoreNewer] = useState(false);
    const [error, setError] = useState(null);
    const [historyLoaded, setHistoryLoaded] = useState(false); 

    const loadedRef = useRef(false);
    const eventsMapRef = useRef(new Map()); 
    // Incremented on every reset (conversation switch); async loads capture it
    // and drop their results if it changed while they were in flight.
    const generationRef = useRef(0);
    const abortRef = useRef(null);

    const isCancelled = (err) => err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED';

    
    const loadMessages = useCallback(async (opts = {}) => {
        if (!conversationId) return;
        if (loadedRef.current && !opts.around) return;

        const generation = generationRef.current;
        const controller = new AbortController();
        abortRef.current = controller;
        const isStale = () => generation !== generationRef.current || controller.signal.aborted;

        setLoading(true);
        loadedRef.current = true; 
        setError(null); 

        try {
            let response;
            const params = { limit: 50 };
            if (opts.around) {
                params.around = opts.around;
            }

            if (conversationType === 'channel') {
                response = await api.get(`/api/v2/messages/channel/${conversationId}`, {
                    params,
                    signal: controller.signal
                });
            } else if (conversationType === 'dm') {
                response = await api.get(`/api/v2/messages/workspace/${workspaceId}/dm/${conversationId}`, {
                    params,
                    signal: controller.signal
                });
                if (isStale()) return;

                
                
                
                
                
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

            if (isStale()) return;
            const messages = response?.data?.messages || [];
            const hasMore = response?.data?.hasMore || false; 
            const hasMoreNewer = response?.data?.hasMoreNewer || false;

            const normalized = messages.map(normalizeMessage);

            let decrypted = normalized;
            if (normalized.length > 0) {
                decrypted = await batchDecryptMessages(normalized, conversationId, conversationType, null);
            }
            if (isStale()) return;

            
            if (opts.around) {
                eventsMapRef.current.clear();
            }
            decrypted.forEach(event => {
                eventsMapRef.current.set(event.id, event);
            });

            
            setEvents(Array.from(eventsMapRef.current.values()));
            setHasMore(hasMore);
            setHasMoreNewer(hasMoreNewer);
            setHistoryLoaded(true); 
        } catch (err) {
            if (isStale() || isCancelled(err)) return;
            logger.error('Error loading messages:', err);
            setError(err.response?.data?.message || 'Failed to load messages');
            setHistoryLoaded(true); 
        } finally {
            if (!isStale()) setLoading(false);
            if (abortRef.current === controller) abortRef.current = null;
        }
    }, [conversationId, conversationType, workspaceId, navigate]);

    
    const loadMore = useCallback(async () => {
        if (!conversationId || loading || !hasMore) return;

        const oldestEvent = events[0];
        if (!oldestEvent) return;

        const generation = generationRef.current;
        const isStale = () => generation !== generationRef.current;
        setLoading(true);

        try {
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
            if (isStale()) return;

            const { messages = [], hasMore: more = false } = response?.data || {};
            const normalized = messages.map(normalizeMessage);

            let decrypted = normalized;
            if (normalized.length > 0) {
                decrypted = await batchDecryptMessages(normalized, conversationId, conversationType, null);
            }
            if (isStale()) return;

            decrypted.forEach(event => {
                if (!eventsMapRef.current.has(event.id)) {
                    eventsMapRef.current.set(event.id, event);
                }
            });

            setEvents(prev => mergeUniqueEvents(prev, decrypted, 'prepend'));
            setHasMore(more);
        } catch (err) {
            if (!isStale()) logger.error('Error loading more messages:', err);
        } finally {
            if (!isStale()) setLoading(false);
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
                logger.error('[THREAD][REALTIME][DECRYPT] Failed to decrypt thread reply:', err);
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

            
            
            const generation = generationRef.current;
            const decrypted = await batchDecryptMessages([event], messageChannelId, conversationType, null);
            if (generation !== generationRef.current) return; // conversation switched meanwhile
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
                logger.warn(`⚠️ [useConversation] No optimistic message found for clientTempId or status`);
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
        generationRef.current += 1;
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        setLoading(false);
        setEvents([]);
        setError(null);
        setHistoryLoaded(false); 
        loadedRef.current = false;
        eventsMapRef.current.clear();
        setHasMoreNewer(false);
    }, []);

    
    // `force` bypasses hasMoreNewer — used after a socket reconnect to fetch
    // messages that arrived while disconnected.
    const loadNewer = useCallback(async ({ force = false } = {}) => {
        if (!conversationId || loading) return;
        if (!force && !hasMoreNewer) return;

        const newestEvent = newestPersistedEvent(events);
        if (!newestEvent) return;

        const generation = generationRef.current;
        const isStale = () => generation !== generationRef.current;
        setLoading(true);

        try {
            let response;
            const params = { limit: 50, after: newestEvent.id };

            if (conversationType === 'channel') {
                response = await api.get(`/api/v2/messages/channel/${conversationId}`, {
                    params
                });
            } else if (conversationType === 'dm') {
                response = await api.get(`/api/v2/messages/workspace/${workspaceId}/dm/${conversationId}`, {
                    params
                });
            }
            if (isStale()) return;

            const { messages = [], hasMoreNewer: moreNewer = false } = response?.data || {};
            const normalized = messages.map(normalizeMessage);

            let decrypted = normalized;
            if (normalized.length > 0) {
                decrypted = await batchDecryptMessages(normalized, conversationId, conversationType, null);
            }
            if (isStale()) return;

            decrypted.forEach(event => {
                if (!eventsMapRef.current.has(event.id)) {
                    eventsMapRef.current.set(event.id, event);
                }
            });

            setEvents(prev => mergeUniqueEvents(prev, decrypted, 'append'));
            setHasMoreNewer(moreNewer);
        } catch (err) {
            if (!isStale()) logger.error('Error loading newer messages:', err);
        } finally {
            if (!isStale()) setLoading(false);
        }
    }, [conversationId, conversationType, workspaceId, events, loading, hasMoreNewer]);

    
    const jumpToDate = useCallback(async (dayStart, dayEnd) => {
        if (!conversationId) return null;

        setLoading(true);
        setError(null);

        try {
            const response = await api.get(`/api/v2/messages/channel/${conversationId}/jump-anchor`, {
                params: { dayStart, dayEnd }
            });

            const { anchorMessageId, isFallback } = response.data;

            if (anchorMessageId) {
                reset();
                loadedRef.current = true;
                await loadMessages({ around: anchorMessageId });
            }

            return { anchorMessageId, isFallback };
        } catch (err) {
            logger.error('Error jumping to date:', err);
            setError(err.response?.data?.message || 'Failed to jump to date');
            return null;
        } finally {
            setLoading(false);
        }
    }, [conversationId, reset, loadMessages]);

    useEffect(() => {
        if (conversationId) {
            reset();
            loadMessages();
        }
    }, [conversationId, conversationType, workspaceId, reset, loadMessages]); 

    useEffect(() => () => {
        generationRef.current += 1;
        if (abortRef.current) abortRef.current.abort();
    }, []);

    return {
        events,
        loading,
        hasMore,
        hasMoreNewer,
        error,
        historyLoaded, 
        loadMore,
        loadNewer,
        jumpToDate,
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
