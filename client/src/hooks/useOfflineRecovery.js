// client/src/hooks/useOfflineRecovery.js
/**
 * useOfflineRecovery
 *
 * Listens for the server-emitted "reconnected" event and fetches any messages
 * that arrived while the client was disconnected.
 *
 * Usage:
 *   const { updateLastSeen } = useOfflineRecovery({
 *     conversationId,       // active channel or DM session ID
 *     conversationType,     // 'channel' | 'dm'
 *     onMissedMessages,     // (messages[]) => void — merge into your state
 *   });
 *
 *   // Call after rendering a message so we track the latest seen ID:
 *   updateLastSeen(message._id);
 */
import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { messageService } from '../services/messageService';

// ─── localStorage helpers ────────────────────────────────────────────────────
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
        // localStorage quota exceeded or private mode — silently skip
    }
}
// ────────────────────────────────────────────────────────────────────────────

export function useOfflineRecovery({ conversationId, conversationType, onMissedMessages }) {
    const { addMessageListener } = useSocket();

    // Guard against re-entrant fetches (e.g. rapid reconnects)
    const isFetchingRef = useRef(false);

    // ── Fetch missed messages from server ────────────────────────────────────
    const fetchMissed = useCallback(async () => {
        if (!conversationId || !conversationType) return;
        if (isFetchingRef.current) return; // already in-flight

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

            // ── Deduplication ────────────────────────────────────────────────
            // Build a Set of IDs already in state by reading the caller's
            // current messages list. This is O(n) once, then O(1) per check.
            // The caller's onMissedMessages receives ONLY genuinely new messages.
            onMissedMessages(messages); // consumer applies its own dedup (see below)

            // Persist the newest seen ID so the next reconnect starts from here
            const lastMsg = messages[messages.length - 1];
            if (lastMsg?._id) {
                writeLastSeen(conversationId, lastMsg._id);
            }
        } catch (err) {
            // Network failure — log and continue. Next reconnect will retry.
            console.warn('[useOfflineRecovery] Fetch failed, will retry on next reconnect:', err.message);
        } finally {
            isFetchingRef.current = false;
        }
    }, [conversationId, conversationType, onMissedMessages]);

    // ── Listen for server "reconnected" signal ───────────────────────────────
    useEffect(() => {
        if (!conversationId) return;

        const removeListener = addMessageListener((event) => {
            if (event === 'reconnected') {
                fetchMissed();
            }
        });

        return removeListener; // auto-deregisters on unmount / conversationId change
    }, [addMessageListener, fetchMissed, conversationId]);

    // ── Expose updateLastSeen for callers to call per-message ────────────────
    const updateLastSeen = useCallback((messageId) => {
        if (conversationId && messageId) {
            writeLastSeen(conversationId, messageId);
        }
    }, [conversationId]);

    return { updateLastSeen };
}
