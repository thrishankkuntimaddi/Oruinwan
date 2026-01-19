/**
 * useMessages Hook
 * 
 * Message CRUD operations with automatic encryption handling
 * 
 * @module chat/hooks/useMessages
 */

import { useState, useCallback } from 'react';
import axios from 'axios';
import chatEncryption from '../encryption/chatEncryption';
import { createMessage } from '../types/primitives';

/**
 * Hook for message operations
 * 
 * @param {string} conversationId - Conversation ID
 * @param {'channel'|'dm'|'thread'} conversationType - Conversation type
 * @param {string} workspaceId - Workspace ID
 * @param {boolean} isEncrypted - Whether E2EE is enabled
 * @returns {Object} Message actions
 */
export function useMessages(conversationId, conversationType, workspaceId, isEncrypted = false) {
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Send a message
     */
    const sendMessage = useCallback(async (text, options = {}) => {
        if (!text.trim() && !options.attachments?.length) {
            return null;
        }

        try {
            setSending(true);
            setError(null);

            const payload = {
                workspaceId,
                text,
                attachments: options.attachments || [],
                replyTo: options.replyTo || null
            };

            // Auto-encrypt if enabled
            if (isEncrypted && text.trim()) {
                const { ciphertext, messageIv } = await chatEncryption.encryptMessageForSending(
                    text,
                    workspaceId
                );
                payload.ciphertext = ciphertext;
                payload.messageIv = messageIv;
                payload.isEncrypted = true;
                payload.text = ''; // Clear plaintext
            }

            // Send via appropriate endpoint
            let response;
            if (conversationType === 'channel') {
                payload.channelId = conversationId;
                response = await axios.post('/api/v2/messages/channel', payload);
            } else if (conversationType === 'dm') {
                payload.dmId = conversationId;
                response = await axios.post('/api/v2/messages/direct', payload);
            } else if (conversationType === 'thread') {
                payload.parentId = conversationId;
                response = await axios.post('/api/messages/reply', payload);
            }

            setSending(false);
            return createMessage(response.data.message);
        } catch (err) {
            console.error('Error sending message:', err);
            setError(err.response?.data?.message || 'Failed to send message');
            setSending(false);
            throw err;
        }
    }, [conversationId, conversationType, workspaceId, isEncrypted]);

    /**
     * Edit a message
     */
    const editMessage = useCallback(async (messageId, newText) => {
        try {
            setError(null);

            const payload = { text: newText };

            // Encrypt if needed
            if (isEncrypted) {
                const { ciphertext, messageIv } = await chatEncryption.encryptMessageForSending(
                    newText,
                    workspaceId
                );
                payload.ciphertext = ciphertext;
                payload.messageIv = messageIv;
                payload.isEncrypted = true;
                payload.text = '';
            }

            const response = await axios.patch(`/api/messages/${messageId}`, payload);
            return createMessage(response.data.message);
        } catch (err) {
            console.error('Error editing message:', err);
            setError(err.response?.data?.message || 'Failed to edit message');
            throw err;
        }
    }, [workspaceId, isEncrypted]);

    /**
     * Delete a message
     */
    const deleteMessage = useCallback(async (messageId) => {
        try {
            setError(null);
            await axios.delete(`/api/messages/${messageId}`);
            return true;
        } catch (err) {
            console.error('Error deleting message:', err);
            setError(err.response?.data?.message || 'Failed to delete message');
            throw err;
        }
    }, []);

    /**
     * React to a message
     */
    const reactToMessage = useCallback(async (messageId, emoji) => {
        try {
            setError(null);
            const response = await axios.post(`/api/messages/${messageId}/react`, { emoji });
            return response.data;
        } catch (err) {
            console.error('Error reacting to message:', err);
            setError(err.response?.data?.message || 'Failed to react');
            throw err;
        }
    }, []);

    /**
     * Mark message as read
     */
    const markAsRead = useCallback(async (messageId) => {
        try {
            await axios.post(`/api/messages/${messageId}/read`);
            return true;
        } catch (err) {
            console.error('Error marking as read:', err);
            // Don't throw - not critical
            return false;
        }
    }, []);

    /**
     * Load message thread (replies)
     */
    const loadThread = useCallback(async (parentMessageId) => {
        try {
            setError(null);
            const response = await axios.get(`/api/messages/${parentMessageId}/replies`);

            const messages = response.data.replies.map(msg => createMessage(msg));

            // Decrypt if needed
            if (isEncrypted) {
                const decrypted = await Promise.all(
                    messages.map(async (msg) => {
                        if (msg.isEncrypted && msg.ciphertext && msg.messageIv) {
                            try {
                                const plaintext = await chatEncryption.decryptReceivedMessage(
                                    msg.ciphertext,
                                    msg.messageIv,
                                    workspaceId
                                );
                                return {
                                    ...msg,
                                    content: { ...msg.content, text: plaintext }
                                };
                            } catch (err) {
                                console.error('Decryption error:', err);
                                return {
                                    ...msg,
                                    content: { ...msg.content, text: '🔒 [Decryption failed]' }
                                };
                            }
                        }
                        return msg;
                    })
                );
                return decrypted;
            }

            return messages;
        } catch (err) {
            console.error('Error loading thread:', err);
            setError(err.response?.data?.message || 'Failed to load thread');
            throw err;
        }
    }, [workspaceId, isEncrypted]);

    return {
        // State
        sending,
        error,

        // Actions
        sendMessage,
        editMessage,
        deleteMessage,
        reactToMessage,
        markAsRead,
        loadThread
    };
}

export default useMessages;
