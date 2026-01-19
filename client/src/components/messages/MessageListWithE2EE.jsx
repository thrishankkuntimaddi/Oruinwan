/**
 * Example: Message Component with E2EE Decryption
 * 
 * Shows how to integrate useDecryptMessages into your message display
 */

import React from 'react';
import { useDecryptMessages } from '../hooks/useDecryptMessages';

/**
 * MessageList Component with automatic decryption
 * 
 * Usage:
 *   <MessageList messages={messages} workspaceId={currentWorkspaceId} />
 */
export function MessageListWithE2EE({ messages, workspaceId }) {
    const {
        messages: decryptedMessages,
        isDecrypting,
        decryptionError
    } = useDecryptMessages(messages, workspaceId);

    if (isDecrypting) {
        return (
            <div className="flex items-center justify-center p-4">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                <span className="ml-2 text-gray-600">🔓 Decrypting messages...</span>
            </div>
        );
    }

    if (decryptionError) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded">
                <p className="text-red-800">⚠️ Decryption Error: {decryptionError}</p>
                <p className="text-sm text-red-600 mt-1">
                    Try logging out and back in to refresh your encryption keys.
                </p>
            </div>
        );
    }

    return (
        <div className="message-list">
            {decryptedMessages.map((msg) => (
                <MessageItem key={msg._id} message={msg} />
            ))}
        </div>
    );
}

/**
 * Individual Message Item
 * Displays decrypted text or encryption status
 */
function MessageItem({ message }) {
    // Get decrypted text (already decrypted by useDecryptMessages)
    const displayText = message.decryptedText || message.payload?.text || '';

    return (
        <div className="message-item p-3 hover:bg-gray-50 rounded">
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <img
                    src={message.sender?.profilePicture}
                    alt={message.sender?.username}
                    className="w-8 h-8 rounded-full"
                />

                <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">
                            {message.sender?.username}
                        </span>
                        <span className="text-xs text-gray-500">
                            {new Date(message.createdAt).toLocaleTimeString()}
                        </span>

                        {/* Encryption Badge */}
                        {message.isEncrypted && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                                🔒 Encrypted
                            </span>
                        )}

                        {/* Decryption Status Badges */}
                        {message.decryptionStatus === 'key-unavailable' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                                🔑 Key Unavailable
                            </span>
                        )}

                        {message.decryptionStatus === 'failed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                                ❌ Decryption Failed
                            </span>
                        )}
                    </div>

                    {/* Message Content */}
                    <div className="text-sm text-gray-900 whitespace-pre-wrap">
                        {displayText}
                    </div>

                    {/* Show error details if decryption failed */}
                    {message.decryptionStatus === 'failed' && message.decryptionError && (
                        <div className="mt-1 text-xs text-red-600">
                            Error: {message.decryptionError}
                        </div>
                    )}

                    {/* Attachments */}
                    {message.payload?.attachments?.length > 0 && (
                        <div className="mt-2">
                            {message.payload.attachments.map((attachment, idx) => (
                                <AttachmentItem key={idx} attachment={attachment} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Attachment Item (placeholder)
 */
function AttachmentItem({ attachment }) {
    return (
        <div className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 rounded text-sm">
            📎 {attachment.filename || 'Attachment'}
        </div>
    );
}

export default MessageListWithE2EE;
