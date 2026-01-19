// client/src/modules/chat/components/MessageList.jsx
/**
 * Unified Message List Component
 * 
 * Displays messages for both channels and DMs with E2EE support
 * Replaces multiple legacy MessageList implementations
 * 
 * @module chat/components
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { MessageEvent } from '../../../components/messagesComp/events';
import chatEncryption from '../encryption/chatEncryption';

/**
 * MessageList - Displays a list of messages with auto-scroll
 * 
 * @param {Object} props
 * @param {Array} props.messages - Array of message objects
 * @param {Boolean} props.loading - Loading state
 * @param {Boolean} props.hasMore - Whether more messages can be loaded
 * @param {Function} props.onLoadMore - Callback to load more messages
 * @param {Function} props.onReply - Callback when reply button clicked
 * @param {Object} props.currentUser - Current authenticated user
 * @param {Object} props.chatContext - Chat context (type, chatId, workspaceId)
 */
export function MessageList({
    messages = [],
    loading = false,
    hasMore = false,
    onLoadMore,
    onReply,
    currentUser,
    chatContext
}) {
    const messagesEndRef = useRef(null);
    const containerRef = useRef(null);
    const previousScrollHeight = useRef(0);

    /**
     * Decrypt message if encrypted
     */
    const decryptMessageIfNeeded = useCallback(
        async (message) => {
            if (!message.isEncrypted || !message.ciphertext || !message.messageIv) {
                // Not encrypted, return as-is
                return {
                    ...message,
                    decryptedText: message.payload?.text || message.text || ''
                };
            }

            try {
                const decryptedText = await chatEncryption.decryptReceivedMessage(
                    message.ciphertext,
                    message.messageIv,
                    chatContext.workspaceId
                );

                return {
                    ...message,
                    decryptedText
                };
            } catch (error) {
                console.error('Failed to decrypt message:', error);
                return {
                    ...message,
                    decryptedText: '🔒 [Encrypted message - decryption failed]',
                    decryptionError: true
                };
            }
        },
        [chatContext.workspaceId]
    );

    /**
     * Scroll to bottom on new messages
     */
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    /**
     * Handle infinite scroll - load more when scrolling up
     */
    const handleScroll = useCallback(() => {
        if (!containerRef.current || loading || !hasMore) return;

        const { scrollTop } = containerRef.current;

        // If scrolled near top, load more
        if (scrollTop < 100 && onLoadMore) {
            previousScrollHeight.current = containerRef.current.scrollHeight;
            onLoadMore();
        }
    }, [loading, hasMore, onLoadMore]);

    /**
     * Restore scroll position after loading more messages
     */
    useEffect(() => {
        if (containerRef.current && previousScrollHeight.current > 0) {
            const newScrollHeight = containerRef.current.scrollHeight;
            const scrollDiff = newScrollHeight - previousScrollHeight.current;
            containerRef.current.scrollTop = scrollDiff;
            previousScrollHeight.current = 0;
        }
    }, [messages.length]);

    /**
     * Auto-scroll to bottom on initial load
     */
    useEffect(() => {
        if (messages.length > 0 && !loading) {
            scrollToBottom();
        }
    }, [messages.length, loading, scrollToBottom]);

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            className="message-list"
            style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Loading indicator at top */}
            {loading && (
                <div className="loading-indicator" style={{ textAlign: 'center', padding: '1rem' }}>
                    <span>Loading messages...</span>
                </div>
            )}

            {/* Load more indicator */}
            {hasMore && !loading && (
                <div className="load-more" style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#666' }}>
                        Scroll up to load more
                    </span>
                </div>
            )}

            {/* Messages */}
            {messages.map((message, index) => (
                <MessageEvent
                    key={message._id || index}
                    message={message}
                    currentUser={currentUser}
                    onReply={onReply}
                    chatContext={chatContext}
                    decryptMessage={decryptMessageIfNeeded}
                />
            ))}

            {/* Empty state */}
            {messages.length === 0 && !loading && (
                <div className="empty-state" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                    <p>No messages yet. Start the conversation! 💬</p>
                </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
        </div>
    );
}

export default MessageList;
