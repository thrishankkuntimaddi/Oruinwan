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


        try {
            // ✅ PHASE 3: For channels, conversation key may not exist yet (UNINITIALIZED state)
            // If no key exists, generate it CLIENT-SIDE before encrypting the first message
            const conversationKeyService = (await import('../services/conversationKeyService')).default;
            let key = await conversationKeyService.getConversationKey(conversationId, conversationType);

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // ✅ PHASE 3: FIRST MESSAGE KEY GENERATION
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            if (!key && conversationType === 'channel') {
                console.log('🔑 [PHASE 3] No key found — FIRST MESSAGE — generating conversation key');

                // Fetch channel members to encrypt key for all of them
                const api = (await import('../services/api')).default;
                const channelResponse = await api.get(`/api/channels/${conversationId}/details`);
                const channelMembers = channelResponse.data.channel.members || [];
                const memberIds = channelMembers.map(m => m.user._id || m.user);

                console.log(`🔑 [PHASE 3] Encrypting for ${memberIds.length} members`);

                try {
                    // Generate key and encrypt for all members
                    const result = await conversationKeyService.createAndStoreConversationKey(
                        conversationId,
                        'channel',
                        workspaceId,
                        memberIds
                    );

                    key = result.conversationKey;
                    console.log('✅ [PHASE 3] Conversation key created and stored');

                } catch (keyError) {
                    // Handle 409 (key already exists - race condition)
                    if (keyError.message && keyError.message.includes('already exist')) {
                        console.log('⚠️ [PHASE 3] Key already exists (409) - fetching existing key');
                        // Fetch the existing key
                        key = await conversationKeyService.fetchAndDecryptConversationKey(
                            conversationId,
                            'channel'
                        );
                        console.log('✅ [PHASE 3] Fetched existing conversation key');
                    } else {
                        // Re-throw other errors
                        throw keyError;
                    }
                }
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
    }, [conversationId, conversationType, workspaceId, user, socket, generateTempId]);

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


