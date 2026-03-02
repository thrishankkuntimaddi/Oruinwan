/**
 * useConversation Hook
 * 
 * Manages a single conversation (channel, DM, or thread)
 * This hook encapsulates all conversation state and actions
 * 
 * @module chat/hooks/useConversation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useSocket } from '../../../contexts/SocketContext';
import { createConversation, createMessage } from '../types/primitives';
import chatEncryption from '../encryption/chatEncryption';

/**
 * Hook for managing a conversation
 * 
 * @param {Object} params
 * @param {string} params.conversationId - Conversation ID (channelId, dmId, or threadId)
 * @param {'channel'|'dm'|'thread'} params.type - Conversation type
 * @param {string} params.workspaceId - Workspace ID
 * @param {Object} params.currentUser - Current user object
 * @returns {Object} Conversation state and actions
 */
export function useConversation({ conversationId, type, workspaceId, currentUser }) {
    const socket = useSocket();

    // State
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState(null);

    // Typing indicators
    const [typingUsers, setTypingUsers] = useState(new Set());
    const typingTimeoutRef = useRef({});

    // ============================================================
    // LOAD CONVERSATION
    // ============================================================

    /**
     * Load conversation metadata and initial messages
     */
    const loadConversation = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            let conversationData;
            let messagesData;

            // Load based on type
            if (type === 'channel') {
                // Load channel info
                const channelRes = await axios.get(`/api/channels/${conversationId}`);
                conversationData = createConversation(channelRes.data, 'channel');

                // Load channel messages
                const messagesRes = await axios.get(`/api/v2/messages/channel/${conversationId}?limit=50`);
                messagesData = messagesRes.data.messages || [];
                setHasMore(messagesRes.data.hasMore || false);
            } else if (type === 'dm') {
                // Load DM session
                // DM session metadata — loaded from parent context, not a dedicated endpoint
                conversationData = createConversation({ _id: conversationId, workspace: workspaceId }, 'dm');

                // Load DM messages
                const messagesRes = await axios.get(`/api/v2/messages/dm/${conversationId}?limit=50`);
                messagesData = messagesRes.data.messages || [];
                setHasMore(messagesRes.data.hasMore || false);
            } else if (type === 'thread') {
                // For threads, load parent message and replies
                const threadRes = await axios.get(`/api/v2/messages/thread/${conversationId}`);
                conversationData = createConversation({
                    _id: conversationId,
                    parentMessage: threadRes.data.parent,
                    workspace: workspaceId
                }, 'thread');
                messagesData = threadRes.data.replies || [];
            }

            setConversation(conversationData);

            // Convert messages to primitive format
            const messagePrimitives = messagesData.map(msg => createMessage(msg));

            // Decrypt encrypted messages if needed
            const decryptedMessages = await Promise.all(
                messagePrimitives.map(async (msg) => {
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

            setMessages(decryptedMessages);
            setLoading(false);
        } catch (err) {
            console.error('Error loading conversation:', err);
            setError(err.message || 'Failed to load conversation');
            setLoading(false);
        }
    }, [conversationId, type, workspaceId]);

    // Load on mount
    useEffect(() => {
        if (conversationId && type && workspaceId) {
            loadConversation();
        }
    }, [loadConversation, conversationId, type, workspaceId]);

    // ============================================================
    // SOCKET HANDLERS
    // ============================================================

    /**
     * Join conversation room
     */
    useEffect(() => {
        if (!socket || !conversationId || !type) return;

        // Join room
        socket.emit('conversation:join', {
            conversationId,
            type,
            workspaceId
        });


        // Leave on unmount
        return () => {
            socket.emit('conversation:leave', {
                conversationId,
                type
            });
        };
    }, [socket, conversationId, type, workspaceId]);

    /**
     * Listen for new messages
     */
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = async (message) => {
            const msgPrimitive = createMessage(message);

            // Decrypt if needed
            if (msgPrimitive.isEncrypted && msgPrimitive.ciphertext && msgPrimitive.messageIv) {
                try {
                    const plaintext = await chatEncryption.decryptReceivedMessage(
                        msgPrimitive.ciphertext,
                        msgPrimitive.messageIv,
                        workspaceId
                    );
                    msgPrimitive.content.text = plaintext;
                } catch (err) {
                    console.error('Decryption error:', err);
                    msgPrimitive.content.text = '🔒 [Decryption failed]';
                }
            }

            // Add to messages
            setMessages(prev => [...prev, msgPrimitive]);
        };

        socket.on('new-message', handleNewMessage);

        return () => {
            socket.off('new-message', handleNewMessage);
        };
    }, [socket, workspaceId]);

    /**
     * Listen for message mutations (edit, delete, pin, react)
     */
    useEffect(() => {
        if (!socket) return;

        // message:edited — update text + mark as edited
        const handleEdited = (updated) => {
            setMessages(prev => prev.map(m =>
                (m.id === updated._id || m.id === updated.id)
                    ? { ...m, text: updated.text, editedAt: updated.editedAt }
                    : m
            ));
        };

        // message:deleted — mark soft-deleted
        const handleDeleted = ({ messageId, deletedBy, deletedByName }) => {
            setMessages(prev => prev.map(m =>
                (m.id === messageId)
                    ? { ...m, isDeleted: true, isDeletedUniversally: true, deletedBy, deletedByName }
                    : m
            ));
        };

        // message:reaction_added / message:reaction_removed — replace reactions array
        const handleReactionAdded = ({ messageId, reactions }) => {
            setMessages(prev => prev.map(m =>
                (m.id === messageId) ? { ...m, reactions } : m
            ));
        };

        const handleReactionRemoved = ({ messageId, reactions }) => {
            setMessages(prev => prev.map(m =>
                (m.id === messageId) ? { ...m, reactions } : m
            ));
        };

        // message-pinned / message-unpinned
        const handlePinned = ({ messageId, pinnedBy, pinnedAt }) => {
            setMessages(prev => prev.map(m =>
                (m.id === messageId) ? { ...m, isPinned: true, pinnedBy, pinnedAt } : m
            ));
        };

        const handleUnpinned = ({ messageId }) => {
            setMessages(prev => prev.map(m =>
                (m.id === messageId) ? { ...m, isPinned: false, pinnedBy: null, pinnedAt: null } : m
            ));
        };

        socket.on('message:edited', handleEdited);
        socket.on('message:deleted', handleDeleted);
        socket.on('message:reaction_added', handleReactionAdded);
        socket.on('message:reaction_removed', handleReactionRemoved);
        socket.on('message-pinned', handlePinned);
        socket.on('message-unpinned', handleUnpinned);

        return () => {
            socket.off('message:edited', handleEdited);
            socket.off('message:deleted', handleDeleted);
            socket.off('message:reaction_added', handleReactionAdded);
            socket.off('message:reaction_removed', handleReactionRemoved);
            socket.off('message-pinned', handlePinned);
            socket.off('message-unpinned', handleUnpinned);
        };
    }, [socket]);


    useEffect(() => {
        if (!socket) return;

        const handleTyping = ({ userId, isTyping }) => {
            if (userId === currentUser?._id) return; // Ignore own typing

            setTypingUsers(prev => {
                const updated = new Set(prev);
                if (isTyping) {
                    updated.add(userId);

                    // Clear existing timeout
                    if (typingTimeoutRef.current[userId]) {
                        clearTimeout(typingTimeoutRef.current[userId]);
                    }

                    // Auto-remove after 3 seconds
                    typingTimeoutRef.current[userId] = setTimeout(() => {
                        setTypingUsers(prev => {
                            const next = new Set(prev);
                            next.delete(userId);
                            return next;
                        });
                    }, 3000);
                } else {
                    updated.delete(userId);
                    if (typingTimeoutRef.current[userId]) {
                        clearTimeout(typingTimeoutRef.current[userId]);
                    }
                }
                return updated;
            });
        };

        socket.on('chat:user_typing', handleTyping);

        return () => {
            socket.off('chat:user_typing', handleTyping);
            // Clear all timeouts on unmount
            const timeouts = typingTimeoutRef.current; // eslint-disable-line react-hooks/exhaustive-deps
            Object.values(timeouts).forEach(clearTimeout);
        };
    }, [socket, currentUser]);

    // ============================================================
    // ACTIONS
    // ============================================================

    /**
     * Send a message
     */
    const sendMessage = useCallback(async (content, options = {}) => {
        if (!content.trim() && !options.attachments?.length) return;

        try {
            setSending(true);

            const payload = {
                workspaceId,
                text: content,
                attachments: options.attachments || [],
                replyTo: options.replyTo || null
            };

            // Encrypt if enabled
            if (conversation?.isEncrypted) {
                const { ciphertext, messageIv } = await chatEncryption.encryptMessageForSending(
                    content,
                    workspaceId
                );
                payload.ciphertext = ciphertext;
                payload.messageIv = messageIv;
                payload.isEncrypted = true;
                payload.text = ''; // Clear plaintext
            }

            // Send via HTTP
            let response;
            if (type === 'channel') {
                payload.channelId = conversationId;
                response = await axios.post('/api/v2/messages/channel', payload);
            } else if (type === 'dm') {
                payload.dmId = conversationId;
                response = await axios.post('/api/v2/messages/direct', payload);
            } else if (type === 'thread') {
                payload.parentId = conversationId;
                response = await axios.post(`/api/v2/messages/thread/${conversationId}`, payload);
            }

            // Message will be added via socket event
            setSending(false);
            return response.data;
        } catch (err) {
            console.error('Error sending message:', err);
            setSending(false);
            throw err;
        }
    }, [conversationId, type, workspaceId, conversation]);

    /**
     * Emit typing indicator
     */
    const setTyping = useCallback((isTyping) => {
        if (!socket) return;

        socket.emit('chat:typing', {
            [type === 'channel' ? 'channelId' : 'dmId']: conversationId,
            isTyping
        });
    }, [socket, conversationId, type]);

    /**
     * Load more messages (pagination)
     */
    const loadMore = useCallback(async () => {
        if (!hasMore || loading) return;

        try {
            setLoading(true);
            const oldestMessageId = messages[0]?.id;

            let response;
            if (type === 'channel') {
                response = await axios.get(
                    `/api/v2/messages/channel/${conversationId}?limit=50&before=${oldestMessageId}`
                );
            } else if (type === 'dm') {
                response = await axios.get(
                    `/api/v2/messages/dm/${conversationId}?limit=50&before=${oldestMessageId}`
                );
            }

            const olderMessages = response.data.messages.map(msg => createMessage(msg));

            // Decrypt if needed
            const decrypted = await Promise.all(
                olderMessages.map(async (msg) => {
                    if (msg.isEncrypted && msg.ciphertext && msg.messageIv) {
                        try {
                            const plaintext = await chatEncryption.decryptReceivedMessage(
                                msg.ciphertext,
                                msg.messageIv,
                                workspaceId
                            );
                            return { ...msg, content: { ...msg.content, text: plaintext } };
                        } catch (err) {
                            return { ...msg, content: { ...msg.content, text: '🔒 [Decryption failed]' } };
                        }
                    }
                    return msg;
                })
            );

            setMessages(prev => [...decrypted, ...prev]);
            setHasMore(response.data.hasMore || false);
            setLoading(false);
        } catch (err) {
            console.error('Error loading more messages:', err);
            setLoading(false);
        }
    }, [conversationId, type, workspaceId, messages, hasMore, loading]);

    // ============================================================
    // RETURN
    // ============================================================

    return {
        // Primitives
        conversation,
        messages,

        // State
        loading,
        sending,
        hasMore,
        error,

        // Typing
        typingUsers: Array.from(typingUsers),
        isTyping: typingUsers.size > 0,

        // Actions
        sendMessage,
        setTyping,
        loadMore,
        reload: loadConversation
    };
}

export default useConversation;
