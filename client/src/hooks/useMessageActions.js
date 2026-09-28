import { useCallback, useRef, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext'; 
import api from '@services/api';
import { encryptMessageForSending } from '../services/messageEncryptionService';
import logger from '../utils/logger';

export function useMessageActions(conversationId, conversationType, workspaceId = null, channelMembers = []) {
    const { socket } = useSocket();
    const { user, encryptionReady } = useAuth(); 

    
    const channelMembersRef = useRef(channelMembers);

    
    useEffect(() => {
        channelMembersRef.current = channelMembers;
    }, [channelMembers]);

    
    const generateTempId = useCallback(() => {
        return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }, []);

    
    const sendMessage = useCallback(async ({ text, attachment = null, type = 'message', attachments = [], replyTo = null, quotedMessageId = null, contact = null, meeting = null, checklist = null, linkPreview = null, mentionText = '' }) => {

        // A checklist is an encrypted message whose body is JSON; the server only
        // stores one checked/unchecked slot per item.
        const isChecklist = type === 'checklist' && checklist?.items?.length > 0;
        if (isChecklist) text = JSON.stringify({ title: checklist.title || '', items: checklist.items });
        const checklistFields = isChecklist ? { type: 'checklist', checklistCount: checklist.items.length } : {};

        
        if (!encryptionReady) {
            logger.error('🛑 [E2EE] Message send BLOCKED - Encryption not ready yet');
            return {
                success: false,
                error: 'ENCRYPTION_NOT_READY',
                message: 'Encryption is initializing. Please wait a moment and try again.'
            };
        }

        
        const isAttachmentMessage = ['image', 'video', 'file', 'voice'].includes(type) && attachment;
        
        // Structured cards (contact, meeting) carry their data in their own field, not in text.
        const structured = (type === 'contact' && contact) ? { contact } : (type === 'meeting' && meeting) ? { meeting } : null;
        const isContactMessage = !!structured;

        if (!conversationId || (!text?.trim() && attachments.length === 0 && !isAttachmentMessage && !isContactMessage)) {
            logger.error('❌ [sendMessage] Validation failed:', { conversationId, text: text?.trim(), attachments, type });
            return { success: false, error: 'Message content required' };
        }

        const tempId = generateTempId();

        
        if (isContactMessage) {
            try {
                const payload = conversationType === 'channel'
                    ? { channelId: conversationId, type, ...structured, clientTempId: tempId }
                    : { dmSessionId: conversationId, workspaceId, type, ...structured, clientTempId: tempId };

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
                    message: { ...response.data.message, ...structured, type },
                };
            } catch (err) {
                logger.error(`❌ [sendMessage] ${type} send error:`, err);
                return { success: false, error: err.response?.data?.message || (type === 'meeting' ? 'Failed to schedule meeting' : 'Failed to share contact') };
            }
        }

        
        if (isAttachmentMessage) {
            try {
                
                const attachmentDoc = {
                    type: attachment.type,   
                    url: attachment.url,
                    name: attachment.name,
                    size: attachment.size,
                    mimeType: attachment.mimeType,
                    // Duration (voice/video) and pixel size let receivers show length and
                    // reserve space before the media loads.
                    ...(Number.isFinite(attachment.duration) ? { duration: attachment.duration } : {}),
                    ...(Number.isFinite(attachment.width) ? { width: attachment.width } : {}),
                    ...(Number.isFinite(attachment.height) ? { height: attachment.height } : {}),
                    ...(attachment.variant ? { variant: attachment.variant } : {}),
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
                logger.error('❌ [sendMessage] Attachment send error:', err);
                return { success: false, error: err.response?.data?.message || 'Failed to send attachment' };
            }
        }

        
        let optimisticMessage = {
            _id: tempId,
            type: isChecklist ? 'checklist' : 'message',
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
            const key = await conversationKeyService.getConversationKey(conversationId, conversationType);

            if (!(key instanceof CryptoKey)) {
                return {
                    success: false,
                    error: key?.status || 'KEY_NOT_AVAILABLE',
                    message: key?.message || (conversationType === 'channel'
                        ? 'This channel\'s encryption key is not available to you yet. Please refresh and try again.'
                        : 'This conversation\'s encryption key is not ready yet. Please try again in a moment.'),
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
            logger.error('❌ [E2EE] Encryption failed:', encError);
            return {
                success: false,
                error: encError?.code || 'ENCRYPTION_FAILED',
                message: /not initialized/i.test(encError?.message || '')
                    ? 'Encryption is still unlocking. Please wait a moment and try again.'
                    : `Message encryption failed. ${encError?.code ? encError.message : 'Please try again.'}`
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
                    mentionText: mentionText || undefined,
                    ...checklistFields,
                    
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
                    mentionText: mentionText || undefined,
                    ...checklistFields,
                    
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
                logger.warn('⚠️ [sendMessage] Socket not connected');
            }

            return {
                success: true,
                tempId,
                message: response.data.message,
                optimisticMessage
            };
        } catch (err) {
            logger.error('❌ [sendMessage] Error:', err);
            logger.error('❌ [sendMessage] Error response:', err.response?.data);
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
    }, [conversationId, conversationType, workspaceId, user, socket, encryptionReady, generateTempId]); 

    
    const addReaction = useCallback(async (messageId, emoji) => {
        if (!messageId || !emoji) return { success: false };

        try {
            const response = await api.post(`/api/v2/messages/${messageId}/react`, { emoji });

            
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
            logger.error('Error adding reaction:', err);
            return { success: false, error: err.response?.data?.message };
        }
    }, [conversationId, user, socket]);

    
    const removeReaction = useCallback(async (messageId, emoji) => {
        if (!messageId || !emoji) return { success: false };

        try {
            const response = await api.delete(`/api/v2/messages/${messageId}/react`, {
                data: { emoji }
            });

            
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
            logger.error('Error removing reaction:', err);
            return { success: false, error: err.response?.data?.message };
        }
    }, [conversationId, user, socket]);

    
    
    const deleteMessage = useCallback(async (messageId, scope = 'everyone') => {
        if (!messageId) return { success: false };

        try {
            
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
            logger.error('Error deleting message:', err);
            return { success: false, error: err.response?.data?.message };
        }
    }, [conversationId, socket]);

    
    const pinMessage = useCallback(async (messageId) => {
        if (!messageId) return { success: false };

        try {
            const response = await api.post(`/api/v2/messages/${messageId}/pin`);

            
            if (socket?.connected) {
                socket.emit('message:pin', {
                    channelId: conversationId,
                    messageId
                });
            }

            return { success: true, message: response.data.message };
        } catch (err) {
            logger.error('Error pinning message:', err);
            return { success: false, error: err.response?.data?.message };
        }
    }, [conversationId, socket]);

    
    const unpinMessage = useCallback(async (messageId) => {
        if (!messageId) return { success: false };

        try {
            const response = await api.post(`/api/v2/messages/${messageId}/pin`, { pin: false });

            
            if (socket?.connected) {
                socket.emit('message:unpin', {
                    channelId: conversationId,
                    messageId
                });
            }

            return { success: true, message: response.data.message };
        } catch (err) {
            logger.error('Error unpinning message:', err);
            return { success: false, error: err.response?.data?.message };
        }
    }, [conversationId, socket]);

    
    const forwardMessage = useCallback(async (messageId, targets) => {
        if (!messageId || !targets?.length) return { success: false };

        try {
            const response = await api.post('/api/v2/messages/forward', {
                messageId,
                targets 
            });

            return { success: true, forwardedCount: response.data.forwardedCount };
        } catch (err) {
            logger.error('Error forwarding message:', err);
            return { success: false, error: err.response?.data?.message };
        }
    }, []);

    
    const editMessage = useCallback(async (messageId, newText) => {
        if (!messageId || !newText?.trim()) return { success: false };

        try {
            const response = await api.patch(`/api/v2/messages/${messageId}`, {
                text: newText
            });

            
            if (socket?.connected) {
                socket.emit('message:edit', {
                    channelId: conversationId,
                    messageId,
                    text: newText
                });
            }

            return { success: true, message: response.data.message };
        } catch (err) {
            logger.error('Error editing message:', err);
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
