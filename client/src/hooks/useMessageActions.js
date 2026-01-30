// client/src/hooks/useMessageActions.js
// Centralize all message actions (send, react, delete, pin, forward)

import { useCallback, useRef, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext'; // ✅ FIX 6: Import useAuth
import api from '../services/api';
import { encryptMessageForSending } from '../services/messageEncryptionService';

/**
 * Provides message action methods
 * @param {string} conversationId - Channel ID or DM Session ID
 * @param {string} conversationType - "channel" | "dm"
 * @param {string} workspaceId - Workspace ID (for DMs)
 * @param {Array} channelMembers - Array of channel members (reactive)
 * @returns {object} Message action methods
 */
export function useMessageActions(conversationId, conversationType, workspaceId = null, channelMembers = []) {
    const { socket } = useSocket();
    const { user, encryptionReady } = useAuth(); // ✅ FIX 6: Get encryption ready flag

    // 🔧 FIX: Use ref to store latest channelMembers (avoid stale closure)
    const channelMembersRef = useRef(channelMembers);

    // Update ref whenever channelMembers changes
    useEffect(() => {
        channelMembersRef.current = channelMembers;
    }, [channelMembers]);

    // Generate temporary ID for optimistic UI
    const generateTempId = useCallback(() => {
        return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }, []);

    // Send message
    const sendMessage = useCallback(async ({ text, attachments = [], replyTo = null }) => {
        console.log('📤 [sendMessage] Called with:', { text, attachments, replyTo });
        console.log('📤 [sendMessage] Context:', { conversationId, conversationType, workspaceId });

        // ⚠️ CRITICAL FIX 6: Block send if encryption not ready
        if (!encryptionReady) {
            console.error('🛑 [E2EE] Message send BLOCKED - Encryption not ready yet');
            console.error('   Identity keys are still loading from IndexedDB');
            console.error('   This prevents "Encryption failed" errors during rehydration');
            return {
                success: false,
                error: 'ENCRYPTION_NOT_READY',
                message: 'Encryption is initializing. Please wait a moment and try again.'
            };
        }

        if (!conversationId || (!text?.trim() && attachments.length === 0)) {
            console.error('❌ [sendMessage] Validation failed:', { conversationId, text: text?.trim(), attachments });
            return { success: false, error: 'Message content required' };
        }

        const tempId = generateTempId();

        // Create optimistic message structure early so it's available in catch block
        // ✅ ALLOWED: Plaintext in optimistic message for LOCAL display only
        let optimisticMessage = {
            _id: tempId,
            type: 'message',
            payload: {
                text,  // OK - never leaves browser
                attachments
            },
            sender: {
                _id: user?.sub || user?._id,
                username: user?.username,
                profilePicture: user?.profilePicture
            },
            parentId: replyTo,
            createdAt: new Date().toISOString(),
            reactions: [],
            isPinned: false,
            status: 'sending'
        };

        // Declare variables for encrypted payload
        let ciphertext;
        let messageIv;


        try {
            // ✅ PHASE 3/4: Fetch conversation key
            const conversationKeyService = (await import('../services/conversationKeyService')).default;
            let key = await conversationKeyService.getConversationKey(conversationId, conversationType);

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 🔐 PHASE 4 FIX: DETECT MISSING KEY STATE
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            if (key && typeof key === 'object' && key.status === 'MISSING_FOR_USER') {
                // 🛑 CRITICAL: Key exists but not distributed to this user
                // This is a LATE JOINER or LEGACY KEY scenario
                // BLOCK message sending - DO NOT regenerate key
                console.error('🛑 [PHASE 4] Conversation key missing for user - blocking message send');
                console.error('   User is a late joiner or legacy key detected');
                console.error('   Key distribution required before sending');

                return {
                    success: false,
                    error: 'KEY_NOT_AVAILABLE',
                    message: 'You do not have access to this conversation\'s encryption key. Please wait for key distribution or contact an admin.'
                };
            }

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 🔐 PHASE 5/6: NO LAZY KEY CREATION
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            if (!key && conversationType === 'channel') {
                // PHASE 5: Channels MUST be encrypted at birth (no lazy creation)
                // PHASE 6: Joiners receive keys via Phase 4 distribution
                console.error('❌ [PHASE 5/6] Channel has no conversation key');
                console.error('   PHASE 5 ensures channels are encrypted at creation');
                console.error('   PHASE 6 ensures joiners receive keys via distribution');
                console.error('   This channel was not properly initialized');

                return {
                    success: false,
                    error: 'CHANNEL_NOT_ENCRYPTED',
                    message: 'This channel is not properly encrypted. Please contact an administrator.'
                };
            }

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // ✅ PHASE 3: ENCRYPT MESSAGE (for both first and subsequent messages)
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

            if (!key) {
                // DMs must have keys initialized first (Phase 4 requirement)
                console.error('❌ [E2EE] No conversation key found for DM');
                return {
                    success: false,
                    error: 'Conversation is not encrypted yet. Please wait for encryption to be initialized.'
                };
            }

            // ============ E2EE: ENCRYPT MESSAGE ============
            console.log('🔐 [E2EE] Encrypting message with conversation key...');
            console.log('🔐 [E2EE] Context:', { conversationId, conversationType, parentId: replyTo });

            // Use conversation key (or thread key if reply)
            const encrypted = await encryptMessageForSending(
                text,
                conversationId,
                conversationType,
                replyTo // parentMessageId for thread derivation
            );

            ciphertext = encrypted.ciphertext;
            messageIv = encrypted.messageIv;

            console.log('✅ [E2EE] Message encrypted successfully');
        } catch (encError) {
            // ✅ CRITICAL: Block send if encryption fails (security requirement)
            console.error('❌ [E2EE] Encryption failed:', encError);
            console.error('❌ [E2EE] Context:', { conversationId, conversationType });

            return {
                success: false,
                error: 'ENCRYPTION_FAILED',
                message: `Message encryption failed. ${encError.message.includes('not found') ? 'Conversation not yet encrypted. Please refresh and try again.' : 'Please try again.'}`
            };
        }
        // ==============================================

        console.log('📤 [sendMessage] Optimistic message created:', optimisticMessage);

        try {
            let response;

            if (conversationType === 'channel') {
                console.log('📤 [sendMessage] Sending encrypted message to channel:', conversationId);

                // ✅ PHASE 3: Always send encrypted (key was generated above if needed)
                response = await api.post('/api/v2/messages/channel', {
                    channelId: conversationId,
                    ciphertext,
                    messageIv,
                    isEncrypted: true,
                    attachments,
                    replyTo,
                    clientTempId: tempId
                });
            } else if (conversationType === 'dm') {
                console.log('📤 [sendMessage] Sending DM to session:', conversationId);
                response = await api.post('/api/v2/messages/direct', {
                    dmSessionId: conversationId,  // ✅ FIXED: Send DM session ID
                    workspaceId,
                    ciphertext,
                    messageIv,
                    isEncrypted: true,
                    attachments,
                    replyTo,
                    clientTempId: tempId
                });
            }

            console.log('✅ [sendMessage] API response:', response?.data);

            // Emit via socket for real-time delivery
            if (socket?.connected) {
                console.log('📡 [sendMessage] Emitting socket event');
                socket.emit('chat:message', {
                    channelId: conversationId,
                    message: response.data.message,
                    clientTempId: tempId
                });
            } else {
                console.warn('⚠️ [sendMessage] Socket not connected');
            }

            return {
                success: true,
                tempId,
                message: response.data.message,
                optimisticMessage
            };
        } catch (err) {
            console.error('❌ [sendMessage] Error:', err);
            console.error('❌ [sendMessage] Error response:', err.response?.data);
            return {
                success: false,
                tempId,
                error: err.response?.data?.message || 'Failed to send message',
                optimisticMessage: {
                    ...optimisticMessage,
                    status: 'failed'
                }
            };
        }
    }, [conversationId, conversationType, workspaceId, user, socket, encryptionReady, generateTempId]); // ✅ FIX 6: Add encryptionReady

    // Add reaction
    const addReaction = useCallback(async (messageId, emoji) => {
        if (!messageId || !emoji) return { success: false };

        try {
            const response = await api.post(`/api/messages/${messageId}/react`, { emoji });

            // Emit via socket for real-time update
            if (socket?.connected) {
                socket.emit('reaction:add', {
                    channelId: conversationId,
                    messageId,
                    emoji,
                    userId: user?.sub || user?._id
                });
            }

            return { success: true, message: response.data.message };
        } catch (err) {
            console.error('Error adding reaction:', err);
            return { success: false, error: err.response?.data?.message };
        }
    }, [conversationId, user, socket]);

    // Remove reaction
    const removeReaction = useCallback(async (messageId, emoji) => {
        if (!messageId || !emoji) return { success: false };

        try {
            const response = await api.delete(`/api/messages/${messageId}/react`, {
                data: { emoji }
            });

            // Emit via socket for real-time update
            if (socket?.connected) {
                socket.emit('reaction:remove', {
                    channelId: conversationId,
                    messageId,
                    emoji,
                    userId: user?.sub || user?._id
                });
            }

            return { success: true, message: response.data.message };
        } catch (err) {
            console.error('Error removing reaction:', err);
            return { success: false, error: err.response?.data?.message };
        }
    }, [conversationId, user, socket]);

    // Delete message
    const deleteMessage = useCallback(async (messageId, deleteForEveryone = false) => {
        if (!messageId) return { success: false };

        try {
            await api.delete(`/api/messages/${messageId}`, {
                data: { deleteForEveryone }
            });

            // Emit via socket for real-time update
            if (socket?.connected) {
                socket.emit('message:delete', {
                    channelId: conversationId,
                    messageId,
                    deleteForEveryone
                });
            }

            return { success: true, messageId };
        } catch (err) {
            console.error('Error deleting message:', err);
            return { success: false, error: err.response?.data?.message };
        }
    }, [conversationId, socket]);

    // Pin message
    const pinMessage = useCallback(async (messageId) => {
        if (!messageId) return { success: false };

        try {
            const response = await api.post(`/api/messages/${messageId}/pin`);

            // Emit via socket for real-time update
            if (socket?.connected) {
                socket.emit('message:pin', {
                    channelId: conversationId,
                    messageId
                });
            }

            return { success: true, message: response.data.message };
        } catch (err) {
            console.error('Error pinning message:', err);
            return { success: false, error: err.response?.data?.message };
        }
    }, [conversationId, socket]);

    // Unpin message
    const unpinMessage = useCallback(async (messageId) => {
        if (!messageId) return { success: false };

        try {
            const response = await api.post(`/api/messages/${messageId}/unpin`);

            // Emit via socket for real-time update
            if (socket?.connected) {
                socket.emit('message:unpin', {
                    channelId: conversationId,
                    messageId
                });
            }

            return { success: true, message: response.data.message };
        } catch (err) {
            console.error('Error unpinning message:', err);
            return { success: false, error: err.response?.data?.message };
        }
    }, [conversationId, socket]);

    // Forward message
    const forwardMessage = useCallback(async (messageId, targets) => {
        if (!messageId || !targets?.length) return { success: false };

        try {
            const response = await api.post('/api/messages/forward', {
                messageId,
                targets // [{ type: 'channel', id: '...' }, { type: 'dm', id: '...' }]
            });

            return { success: true, forwardedCount: response.data.forwardedCount };
        } catch (err) {
            console.error('Error forwarding message:', err);
            return { success: false, error: err.response?.data?.message };
        }
    }, []);

    // Edit message (future feature)
    const editMessage = useCallback(async (messageId, newText) => {
        if (!messageId || !newText?.trim()) return { success: false };

        try {
            const response = await api.put(`/api/messages/${messageId}`, {
                text: newText
            });

            // Emit via socket for real-time update
            if (socket?.connected) {
                socket.emit('message:edit', {
                    channelId: conversationId,
                    messageId,
                    text: newText
                });
            }

            return { success: true, message: response.data.message };
        } catch (err) {
            console.error('Error editing message:', err);
            return { success: false, error: err.response?.data?.message };
        }
    }, [conversationId, socket]);

    return {
        sendMessage,
        addReaction,
        removeReaction,
        deleteMessage,
        pinMessage,
        unpinMessage,
        forwardMessage,
        editMessage,
        generateTempId
    };
}


