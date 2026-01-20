// client/src/hooks/useMessageActions.js
// Centralize all message actions (send, react, delete, pin, forward)

import { useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { encryptMessage } from '../utils/crypto';
import { getWorkspaceKeyForEncryption } from '../services/keyManagement';

/**
 * Provides message action methods
 * @param {string} conversationId - Channel ID or DM Session ID
 * @param {string} conversationType - "channel" | "dm"
 * @param {string} workspaceId - Workspace ID (for DMs)
 * @returns {object} Message action methods
 */
export function useMessageActions(conversationId, conversationType, workspaceId = null) {
    const { socket } = useSocket();
    const { user } = useAuth();

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

        try {
            // ============ E2EE: ENCRYPT MESSAGE ============
            let ciphertext;
            let messageIv;

            // Check workspace context
            if (!workspaceId) {
                console.error('❌ workspaceId is required for E2EE');
                return {
                    success: false,
                    error: 'Workspace context required for secure messaging'
                };
            }

            // Encrypt the message
            try {
                const workspaceKey = await getWorkspaceKeyForEncryption(workspaceId);
                if (!workspaceKey) {
                    throw new Error('E2EE keys not initialized. Please log in again.');
                }

                const encrypted = await encryptMessage(text, workspaceKey);
                ciphertext = encrypted.ciphertext;
                messageIv = encrypted.iv;

                console.log('🔐 Message encrypted successfully');
            } catch (encError) {
                console.error('❌ Encryption failed:', encError);
                return {
                    success: false,
                    error: `Encryption failed: ${encError.message}. Try logging in again.`
                };
            }
            // ==============================================

            console.log('📤 [sendMessage] Optimistic message created:', optimisticMessage);

            let response;

            if (conversationType === 'channel') {
                console.log('📤 [sendMessage] Sending to channel:', conversationId);
                response = await api.post('/api/v2/messages/channel', {
                    channelId: conversationId,
                    ciphertext,
                    messageIv,
                    isEncrypted: true,
                    attachments,
                    replyTo
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
                    replyTo
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


