import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { messageService } from '../services/messageService';

const STORAGE_KEY = (id) => `lastSeen:${id}`;

function readLastSeen(conversationId) {
    try {
        return localStorage.getItem(STORAGE_KEY(conversationId)) || null;
    } catch {
        return null;
    }
}

function writeLastSeen(conversationId, messageId) {
    try {
        localStorage.setItem(STORAGE_KEY(conversationId), messageId);
    } catch {
        
    }
}

export function useOfflineRecovery({ conversationId, conversationType, onMissedMessages }) {
    const { addMessageListener } = useSocket();

    
    const isFetchingRef = useRef(false);

    
    const fetchMissed = useCallback(async () => {
        if (!conversationId || !conversationType) return;
        if (isFetchingRef.current) return; 

        isFetchingRef.current = true;
        try {
            const lastSeenMessageId = readLastSeen(conversationId);

            const response = await messageService.getMissedMessages(
                conversationId,
                conversationType,
                lastSeenMessageId
            );

            const { messages = [] } = response.data;
            if (messages.length === 0) return;

            
            
            
            
            onMissedMessages(messages); 

            
            const lastMsg = messages[messages.length - 1];
            if (lastMsg?._id) {
                writeLastSeen(conversationId, lastMsg._id);
            }
        } catch (err) {
            
            console.warn('[useOfflineRecovery] Fetch failed, will retry on next reconnect:', err.message);
        } finally {
            isFetchingRef.current = false;
        }
    }, [conversationId, conversationType, onMissedMessages]);

    
    useEffect(() => {
        if (!conversationId) return;

        const removeListener = addMessageListener((event) => {
            if (event === 'reconnected') {
                fetchMissed();
            }
        });

        return removeListener; 
    }, [addMessageListener, fetchMissed, conversationId]);

    
    const updateLastSeen = useCallback((messageId) => {
        if (conversationId && messageId) {
            writeLastSeen(conversationId, messageId);
        }
    }, [conversationId]);

    return { updateLastSeen };
}
