// client/src/modules/chat/components/ChatWindow.jsx
/**
 * Unified Chat Window Component
 * 
 * Supports both channel and DM conversations with E2EE
 * This is the NEW unified component that replaces:
 * - ChatWindowV2.jsx
 * - DMChatWindow.jsx
 * - ChatWindowUnified.jsx
 * 
 * @module chat/components
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useChatSocket, useConversation, useMessageActions } from '../../../hooks';
import { ConversationStream } from '../../../components/messagesComp/events';
import { Footer } from '../../../components/messagesComp/chatWindowComp/footer/Footer';

/**
 * ChatWindow - Unified chat interface for channels and DMs
 * 
 * @param {Object} props
 * @param {String} props.type - 'channel' or 'dm'
 * @param {String} props.chatId - Channel ID or DM Session ID
 * @param {String} props.workspaceId - Current workspace ID
 * @param {Object} props.currentUser - Authenticated user object
 */
export function ChatWindow({ type, chatId, workspaceId, currentUser }) {
    const [replyingTo, setReplyingTo] = useState(null);
    const [isEncryptionEnabled, setIsEncryptionEnabled] = useState(true);

    // Use existing hooks for socket and conversation management
    const { messages, loading, hasMore, loadMore } = useConversation({
        type,
        chatId,
        workspaceId
    });

    const { sendMessage } = useMessageActions({
        type,
        chatId,
        workspaceId,
        isEncrypted: isEncryptionEnabled
    });

    // Real-time socket updates
    useChatSocket({
        type,
        chatId,
        onNewMessage: (message) => {
            console.log('📨 Real-time message received:', message);
            // Message will be added by useConversation hook
        }
    });

    // Handle sending messages
    const handleSendMessage = useCallback(
        async (messageData) => {
            try {
                await sendMessage({
                    ...messageData,
                    parentId: replyingTo?._id || null
                });

                // Clear reply state after sending
                if (replyingTo) {
                    setReplyingTo(null);
                }
            } catch (error) {
                console.error('Failed to send message:', error);
                // TODO: Show error toast
            }
        },
        [sendMessage, replyingTo]
    );

    // Handle reply action
    const handleReply = useCallback((message) => {
        setReplyingTo(message);
    }, []);

    // Cancel reply
    const handleCancelReply = useCallback(() => {
        setReplyingTo(null);
    }, []);

    const chatContext = useMemo(
        () => ({
            type,
            chatId,
            workspaceId,
            currentUser,
            isEncrypted: isEncryptionEnabled
        }),
        [type, chatId, workspaceId, currentUser, isEncryptionEnabled]
    );

    return (
        <div className="chat-window">
            {/* Chat Header */}
            <div className="chat-header">
                <div className="chat-title">
                    {type === 'channel' ? '# Channel' : 'Direct Message'}
                </div>

                {/* E2EE Toggle */}
                <div className="chat-controls">
                    <button
                        onClick={() => setIsEncryptionEnabled(!isEncryptionEnabled)}
                        className={`encryption-toggle ${isEncryptionEnabled ? 'active' : ''}`}
                        title={isEncryptionEnabled ? 'E2EE Enabled' : 'E2EE Disabled'}
                    >
                        {isEncryptionEnabled ? '🔐 Encrypted' : '🔓 Unencrypted'}
                    </button>
                </div>
            </div>

            {/* Messages Stream */}
            <div className="chat-messages">
                <ConversationStream
                    messages={messages}
                    loading={loading}
                    hasMore={hasMore}
                    onLoadMore={loadMore}
                    onReply={handleReply}
                    currentUser={currentUser}
                    chatContext={chatContext}
                />
            </div>

            {/* Message Input */}
            <Footer
                onSendMessage={handleSendMessage}
                replyingTo={replyingTo}
                onCancelReply={handleCancelReply}
                isEncrypted={isEncryptionEnabled}
                chatContext={chatContext}
            />
        </div>
    );
}

export default ChatWindow;
