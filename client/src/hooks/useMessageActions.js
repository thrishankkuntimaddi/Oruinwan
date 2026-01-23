// client/src/hooks/useMessageActions.js
// Centralize all message actions (send, react, delete, pin, forward)

import { useCallback, useRef, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
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
    const { user } = useAuth();

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

    /**
     * 🔐 LAZY E2EE: Ensure conversation key exists before sending message
     * Implements Safeguard #1 (single-writer) and Safeguard #2 (non-blocking)
     * 
     *
     * @param {string} conversationId - Channel ID or DM Session ID
     * @param {string} conversationType - "channel" | "dm"
     * @param {string} workspaceId - Workspace ID
     * @param {Array} participantUserIds - Array of user IDs who need access
     * @returns {Promise<CryptoKey|null>} Conversation key or null if failed
     */
    const ensureConversationKey = useCallback(async (conversationId, conversationType, workspaceId, participantUserIds) => {
        console.log('🔐 [Lazy E2EE] Checking for conversation key...');

        // Dynamically import to avoid circular dependencies
        const conversationKeyService = (await import('../services/conversationKeyService')).default;

        // Try to get existing key from cache or server
        let key = await conversationKeyService.getConversationKey(conversationId, conversationType);

        if (!key) {
            // ✅ Key doesn't exist - could be NEW channel or existing channel we don't have access to
            // Check if keys exist on server for this conversation
            try {
                const checkResponse = await api.get(`/api/v2/conversations/${conversationId}/keys/exists?type=${conversationType}`);
                const keysExistOnServer = checkResponse?.data?.exists;

                if (keysExistOnServer) {
                    // ❌ Keys exist on server but we don't have them
                    // This means we're a NEW JOINER to EXISTING encrypted channel
                    // Do NOT generate new key - wait for distribution
                    console.error('❌ [Lazy E2EE] Channel is encrypted but you don\'t have the key yet');
                    console.error('❌ Waiting for existing member to distribute key...');
                    throw new Error('Conversation encryption not ready. Waiting for secure key exchange...');
                } else {
                    // ✅ No keys on server - this is a BRAND NEW conversation
                    // Safe to generate keys
                    console.log('🔐 [Lazy E2EE] New conversation - generating keys...');

                    const keyData = await conversationKeyService.createAndDistributeConversationKey(participantUserIds, workspaceId);

                    await conversationKeyService.storeConversationKeysOnServer(
                        conversationId,
                        conversationType,
                        workspaceId,
                        keyData.encryptedKeys,
                        keyData.workspaceEncryptedKey,
                        keyData.workspaceKeyIv,
                        keyData.workspaceKeyAuthTag
                    );

                    console.log('✅ [Lazy E2EE] Conversation key generated and stored');
                    key = keyData.conversationKey;
                }
            } catch (checkError) {
                if (checkError.message?.includes('not ready') || checkError.message?.includes('Waiting for')) {
                    throw checkError;
                }
                // If check fails, assume new conversation (fallback)
                console.warn('⚠️ Could not check key existence, assuming new conversation');
                const keyData = await conversationKeyService.createAndDistributeConversationKey(participantUserIds, workspaceId);
                await conversationKeyService.storeConversationKeysOnServer(
                    conversationId,
                    conversationType,
                    workspaceId,
                    keyData.encryptedKeys,
                    keyData.workspaceEncryptedKey,
                    keyData.workspaceKeyIv,
                    keyData.workspaceKeyAuthTag
                );
                key = keyData.conversationKey;
            }
        }

        console.log('✅ [Lazy E2EE] Conversation key ready');
        return key;
    }, []);

    // Send message
    const sendMessage = useCallback(async ({ text, attachments = [], replyTo = null }) => {
        console.log('📤 [sendMessage] Called with:', { text, attachments, replyTo });
        console.log('📤 [sendMessage] Context:', { conversationId, conversationType, workspaceId });

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
        let encryptionReady = true;

        try {
            // ⚡ SAFEGUARD #2: Encryption is NON-BLOCKING
            // If this fails, message still sends (encryption eventual)
            try {
                // 🔧 FIX #1: Extract real user IDs from channel members
                let participantUserIds = [];

                // 🔧 FIX: Use ref to get latest channel members (avoid stale closure)
                const latestChannelMembers = channelMembersRef.current;

                if (conversationType === 'channel' && latestChannelMembers && latestChannelMembers.length > 0) {
                    // Extract user IDs from channel members
                    participantUserIds = latestChannelMembers
                        .map(m => m.userId || m.user?._id || m.user)
                        .filter(id => id); // Remove any undefined/null values

                    console.log(`🔐 [E2EE] Channel members found: ${participantUserIds.length} participants`);
                } else if (conversationType === 'dm') {
                    // For DMs, include current user (TODO: add recipient)
                    participantUserIds = [user?.sub || user?._id];
                } else {
                    // Fallback: at minimum include current user
                    participantUserIds = [user?.sub || user?._id];
                    console.warn('⚠️ [E2EE] No channel members provided, using current user only');
                }

                await ensureConversationKey(conversationId, conversationType, workspaceId, participantUserIds);
            } catch (encryptionSetupError) {
                console.error('🔐 [Non-blocking] Encryption setup failed:', encryptionSetupError);
                encryptionReady = false;
                // DO NOT throw - message send continues
            }

            // 🔧 FIX #2 & #3: Only encrypt if key setup succeeded
            if (!encryptionReady) {
                console.error('❌ [E2EE] Skipping encryption - key setup failed');
                return {
                    success: false,
                    error: 'Message encryption failed. Conversation not yet encrypted. Please refresh and try again.'
                };
            }

            // ============ E2EE: ENCRYPT MESSAGE ============
            // ✅ NON-BLOCKING: Never throw to UI, always graceful fallback
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
            // ✅ CRITICAL: Non-blocking error handling
            // If encryption fails, we could either:
            // 1. Block send (current behavior - safer)
            // 2. Send plaintext with warning (less safe)
            // Current: Block send for security
            console.error('❌ [E2EE] Encryption failed:', encError);
            console.error('❌ [E2EE] Context:', { conversationId, conversationType });

            return {
                success: false,
                error: `Message encryption failed. ${encError.message.includes('not found') ? 'Conversation not yet encrypted. Please refresh and try again.' : 'Please try again.'}`
            };
        }
        // ==============================================

        console.log('📤 [sendMessage] Optimistic message created:', optimisticMessage);

        try {
            let response;

            if (conversationType === 'channel') {
                console.log('📤 [sendMessage] Sending to channel:', conversationId);
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
                console.log('📤 [sendMessage] Sending DM to:', conversationId);
                response = await api.post('/api/v2/messages/direct', {
                    receiverId: conversationId,
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
    }, [conversationId, conversationType, workspaceId, user, socket, generateTempId, ensureConversationKey, channelMembersRef]);

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


