/**
 * Message Decryption Hook
 * 
 * Handles decryption of incoming encrypted messages
 * Used by message display components
 */

import { useState, useEffect } from 'react';
import { decryptMessage } from '../utils/crypto';
import { getWorkspaceKeyForEncryption } from '../services/keyManagement';

/**
 * Decrypt a single message
 * 
 * @param {object} message - Message object from server
 * @param {string} workspaceId - Workspace ID
 * @returns {object} Decrypted message or original if not encrypted
 */
export async function decryptSingleMessage(message, workspaceId) {
    // If not encrypted, return as-is
    if (!message.isEncrypted || !message.ciphertext || !message.messageIv) {
        return {
            ...message,
            decryptedText: message.payload?.text || message.text || '',
            decryptionStatus: 'not-encrypted'
        };
    }

    try {
        // Get workspace key
        const workspaceKey = await getWorkspaceKeyForEncryption(workspaceId);

        if (!workspaceKey) {
            console.error('🔐 No workspace key available for decryption');
            return {
                ...message,
                decryptedText: '[🔒 Encrypted - Key Not Available]',
                decryptionStatus: 'key-unavailable'
            };
        }

        // Decrypt message
        const plaintext = await decryptMessage(
            message.ciphertext,
            message.messageIv,
            workspaceKey
        );

        return {
            ...message,
            decryptedText: plaintext,
            decryptionStatus: 'decrypted',
            payload: {
                ...message.payload,
                text: plaintext // Update payload with decrypted text
            }
        };
    } catch (error) {
        console.error('❌ Decryption failed for message:', message._id, error);
        return {
            ...message,
            decryptedText: '[🔒 Decryption Failed]',
            decryptionStatus: 'failed',
            decryptionError: error.message
        };
    }
}

/**
 * Hook to decrypt an array of messages
 * 
 * @param {Array} messages - Array of message objects
 * @param {string} workspaceId - Workspace ID
 * @returns {Array} Decrypted messages
 */
export function useDecryptMessages(messages, workspaceId) {
    const [decryptedMessages, setDecryptedMessages] = useState([]);
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [decryptionError, setDecryptionError] = useState(null);

    useEffect(() => {
        if (!messages || messages.length === 0) {
            setDecryptedMessages([]);
            return;
        }

        async function decryptAll() {
            setIsDecrypting(true);
            setDecryptionError(null);

            try {
                // Decrypt all messages in parallel
                const decrypted = await Promise.all(
                    messages.map(msg => decryptSingleMessage(msg, workspaceId))
                );

                setDecryptedMessages(decrypted);
            } catch (error) {
                console.error('❌ Batch decryption failed:', error);
                setDecryptionError(error.message);
                // Still set messages but mark as failed
                setDecryptedMessages(messages.map(msg => ({
                    ...msg,
                    decryptedText: '[🔒 Decryption Error]',
                    decryptionStatus: 'failed'
                })));
            } finally {
                setIsDecrypting(false);
            }
        }

        decryptAll();
    }, [messages, workspaceId]);

    return {
        messages: decryptedMessages,
        isDecrypting,
        decryptionError
    };
}

/**
 * Hook to decrypt a single message (for real-time updates)
 * 
 * @param {object} message - Single message object
 * @param {string} workspaceId - Workspace ID
 * @returns {object} Decrypted message
 */
export function useDecryptMessage(message, workspaceId) {
    const [decryptedMessage, setDecryptedMessage] = useState(null);
    const [isDecrypting, setIsDecrypting] = useState(false);

    useEffect(() => {
        if (!message) {
            setDecryptedMessage(null);
            return;
        }

        async function decrypt() {
            setIsDecrypting(true);
            const decrypted = await decryptSingleMessage(message, workspaceId);
            setDecryptedMessage(decrypted);
            setIsDecrypting(false);
        }

        decrypt();
    }, [message, workspaceId]);

    return {
        message: decryptedMessage,
        isDecrypting
    };
}

export default {
    decryptSingleMessage,
    useDecryptMessages,
    useDecryptMessage
};
