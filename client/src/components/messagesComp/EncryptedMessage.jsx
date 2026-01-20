// client/src/components/messagesComp/EncryptedMessage.jsx
/**
 * EncryptedMessage Component
 * Handles decryption and display of encrypted messages
 */

import React, { useState, useEffect } from 'react';
import { useEncryption } from '../../hooks/useEncryption';
import { Lock, AlertCircle } from 'lucide-react';

/**
 * Component for displaying encrypted messages with automatic decryption
 * @param {Object} props
 * @param {string} props.ciphertext - Base64-encoded ciphertext
 * @param {string} props.messageIv - Base64-encoded IV
 * @param {string} props.senderId - Sender's user ID
 * @param {string} props.currentUserId - Current user's ID
 */
function EncryptedMessage({ ciphertext, messageIv, senderId, currentUserId }) {
    const [decrypted, setDecrypted] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const { decryptMessage, hasKeys } = useEncryption(currentUserId);

    useEffect(() => {
        const decrypt = async () => {
            if (!ciphertext || !messageIv || !senderId) {
                setError('Missing encryption data');
                setLoading(false);
                return;
            }

            if (!hasKeys) {
                setError('Encryption keys not loaded');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const plaintext = await decryptMessage(ciphertext, messageIv, senderId);
                setDecrypted(plaintext);
                setError(null);
            } catch (err) {
                console.error('Failed to decrypt message:', err);
                setError('Decryption failed');
            } finally {
                setLoading(false);
            }
        };

        decrypt();
    }, [ciphertext, messageIv, senderId, currentUserId, decryptMessage, hasKeys]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                <Lock size={14} className="animate-pulse" />
                <span className="italic">Decrypting message...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 text-red-500 dark:text-red-400 text-sm">
                <AlertCircle size={14} />
                <span className="italic">{error}</span>
            </div>
        );
    }

    if (!decrypted) {
        return (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                <Lock size={14} />
                <span className="italic">Encrypted message - no content</span>
            </div>
        );
    }

    // Render decrypted message with encryption indicator
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Lock size={12} />
                <span>End-to-end encrypted</span>
            </div>
            <div className="text-gray-900 dark:text-gray-100">
                {decrypted}
            </div>
        </div>
    );
}

export default EncryptedMessage;
