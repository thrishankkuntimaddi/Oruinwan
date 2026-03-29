// client/src/hooks/useMessageActions.js
// Centralize all message actions (send, react, delete, pin, forward)

import { useCallback, useRef, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext'; // ✅ FIX 6: Import useAuth
import api from '@services/api';
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
    const sendMessage = useCallback(async ({ text, attachment = null, type = 'message', attachments = [], replyTo = null, quotedMessageId = null, contact = null, linkPreview = null }) => {

        // ⚠️ CRITICAL FIX 6: Block send if encryption not ready
        if (!encryptionReady) {
            console.error('🛑 [E2EE] Message send BLOCKED - Encryption not ready yet');
            return {
                success: false,
                error: 'ENCRYPTION_NOT_READY',
                message: 'Encryption is initializing. Please wait a moment and try again.'
            };
        }

        // Phase 7.1: Attachment messages (image/video/file/voice) bypass text & E2EE validation
        const isAttachmentMessage = ['image', 'video', 'file', 'voice'].includes(type) && attachment;
        // Phase 7.4: Contact messages bypass E2EE (structured, not sensitive text)
        const isContactMessage = type === 'contact' && contact;

        if (!conversationId || (!text?.trim() && attachments.length === 0 && !isAttachmentMessage && !isContactMessage)) {
            console.error('❌ [sendMessage] Validation failed:', { conversationId, text: text?.trim(), attachments, type });
            return { success: false, error: 'Message content required' };
        }

        const tempId = generateTempId();

        // ── CONTACT PATH (Phase 7.4): skip E2EE ──────────────────────────────
        if (isContactMessage) {
            try {
                const payload = conversationType === 'channel'
                    ? { channelId: conversationId, type: 'contact', contact, clientTempId: tempId }
                    : { dmSessionId: conversationId, workspaceId, type: 'contact', contact, clientTempId: tempId };

                const endpoint = conversationType === 'channel'
                    ? '/api/v2/messages/channel'
                    : '/api/v2/messages/direct';

                const response = await api.post(endpoint, payload);

                if (socket?.connected) {
                    socket.emit('chat:message', {
                        channelId: conversationId,
                        message: response.data.message,
                        clientTempId: tempId
                    });
                }

                return {
                    success: true,
                    tempId,
                    message: { ...response.data.message, contact, type: 'contact' },
                };
            } catch (err) {
                console.error('❌ [sendMessage] Contact send error:', err);
                return { success: false, error: err.response?.data?.message || 'Failed to share contact' };
            }
        }

        // ── ATTACHMENT PATH (Phase 7.1): skip E2EE, send structured payload ──
        if (isAttachmentMessage) {
            try {
                // Normalise attachment to AttachmentSchema shape
                const attachmentDoc = {
                    type: attachment.type,   // 'image' | 'video' | 'file' | 'voice'
                    url: attachment.url,
                    name: attachment.name,
                    size: attachment.size,
                    mimeType: attachment.mimeType,
                };

                const payload = conversationType === 'channel'
                    ? { channelId: conversationId, type, attachments: [attachmentDoc], clientTempId: tempId }
                    : { dmSessionId: conversationId, workspaceId, type, attachments: [attachmentDoc], clientTempId: tempId };

                const endpoint = conversationType === 'channel'
                    ? '/api/v2/messages/channel'
                    : '/api/v2/messages/direct';

                const response = await api.post(endpoint, payload);

                if (socket?.connected) {
                    socket.emit('chat:message', {
                        channelId: conversationId,
                        message: response.data.message,
                        clientTempId: tempId
                    });
                }

                return {
                    success: true,
                    tempId,
                    message: { ...response.data.message, attachment, type },
                };
            } catch (err) {
                console.error('❌ [sendMessage] Attachment send error:', err);
                return { success: false, error: err.response?.data?.message || 'Failed to send attachment' };
            }
        }

        // ── TEXT PATH (existing E2EE flow) ────────────────────────────────────
        let optimisticMessage = {
            _id: tempId,
            type: 'message',
            payload: { text, attachments },
            sender: {
                _id: user?.sub || user?._id,
                username: user?.username,
                profilePicture: user?.profilePicture
            },
            parentId: replyTo,
            quotedMessageId,
            createdAt: new Date().toISOString(),
            reactions: [],
            isPinned: false,
            status: 'sending'
        };

        let ciphertext;
        let messageIv;

        try {
            const conversationKeyService = (await import('../services/conversationKeyService')).default;
            let key = await conversationKeyService.getConversationKey(conversationId, conversationType);

            if (key && typeof key === 'object' && key.status === 'MISSING_FOR_USER') {
                return {
                    success: false,
                    error: 'KEY_NOT_AVAILABLE',
                    message: 'You do not have access to this conversation\'s encryption key. Please wait for key distribution or contact an admin.'
                };
            }

            if (!key && conversationType === 'channel') {
                return {
                    success: false,
                    error: 'CHANNEL_NOT_ENCRYPTED',
                    message: 'This channel is not properly encrypted. Please contact an administrator.'
                };
            }

            if (!key) {
                return {
                    success: false,
                    error: 'Conversation is not encrypted yet. Please wait for encryption to be initialized.'
                };
            }

            const encrypted = await encryptMessageForSending(
                text,
                conversationId,
                conversationType,
                replyTo
            );

            ciphertext = encrypted.ciphertext;
            messageIv = encrypted.messageIv;

        } catch (encError) {
            console.error('❌ [E2EE] Encryption failed:', encError);
            return {
                success: false,
                error: 'ENCRYPTION_FAILED',
                message: `Message encryption failed. ${encError.message.includes('not found') ? 'Conversation not yet encrypted. Please refresh and try again.' : 'Please try again.'}`
            };
        }

        try {
            let response;

            if (conversationType === 'channel') {
                response = await api.post('/api/v2/messages/channel', {
                    channelId: conversationId,
                    ciphertext,
                    messageIv,
                    isEncrypted: true,
                    attachments,
                    replyTo,
                    quotedMessageId,
                    clientTempId: tempId,
                    // Phase 7.5 — link preview
                    linkPreview: linkPreview || undefined,
                });
            } else if (conversationType === 'dm') {
                response = await api.post('/api/v2/messages/direct', {
                    dmSessionId: conversationId,
                    workspaceId,
                    ciphertext,
                    messageIv,
                    isEncrypted: true,
                    attachments,
                    replyTo,
                    quotedMessageId,
                    clientTempId: tempId,
                    // Phase 7.5 — link preview
                    linkPreview: linkPreview || undefined,
                });
            }

            if (socket?.connected) {
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
            const response = await api.post(`/api/v2/messages/${messageId}/react`, { emoji });

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
            const response = await api.delete(`/api/v2/messages/${messageId}/react`, {
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
    // scope: 'me' (hide for current user only) | 'everyone' (delete for all, sender only)
    const deleteMessage = useCallback(async (messageId, scope = 'everyone') => {
        if (!messageId) return { success: false };

        try {
            // Pass socket id so server can send 'message:hidden' back to just this client
            const headers = {};
            if (socket?.id) {
                headers['x-socket-id'] = socket.id;
            }

            await api.delete(`/api/v2/messages/${messageId}`, {
                data: { scope },
                headers
            });

            return { success: true, messageId, scope };
        } catch (err) {
            console.error('Error deleting message:', err);
            return { success: false, error: err.response?.data?.message };
        }
    }, [conversationId, socket]);

    // Pin message
    const pinMessage = useCallback(async (messageId) => {
        if (!messageId) return { success: false };

        try {
            const response = await api.post(`/api/v2/messages/${messageId}/pin`);

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
            const response = await api.post(`/api/v2/messages/${messageId}/pin`, { pin: false });

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
            const response = await api.post('/api/v2/messages/forward', {
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
            const response = await api.patch(`/api/v2/messages/${messageId}`, {
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


