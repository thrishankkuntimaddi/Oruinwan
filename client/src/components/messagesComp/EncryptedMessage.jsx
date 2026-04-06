// client/src/components/messagesComp/EncryptedMessage.jsx
/**
 * EncryptedMessage Component (E2EE with Conversation Keys)
 * Handles decryption and display of encrypted messages using conversation/thread keys
 */

import React, { useState, useEffect } from 'react';
import { decryptReceivedMessage } from '../../services/messageEncryptionService';
import { Lock } from 'lucide-react';

/**
 * Component for displaying encrypted messages with automatic decryption
 * @param {Object} props
 * @param {string} props.ciphertext - Base64-encoded ciphertext
 * @param {string} props.messageIv - Base64-encoded IV
 * @param {string} props.conversationId - Channel ID or DM session ID
 * @param {string} props.conversationType - "channel" or "dm"
 * @param {string} props.parentMessageId - Parent message ID for thread key derivation (optional)
 */
function EncryptedMessage({ ciphertext, messageIv, conversationId, conversationType, parentMessageId = null }) {
    const [decrypted, setDecrypted] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // ✅ Correction #3: NON-BLOCKING decryption
        // Never throw, never block render, always show something
        const decrypt = async () => {
            if (!ciphertext || !messageIv) {
                setDecrypted('🔒 Encrypted message');
                setLoading(false);
                return;
            }

            if (!conversationId || !conversationType) {
                setDecrypted('🔒 Encrypted message');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);

                // Use conversation key service with thread derivation support
                const plaintext = await decryptReceivedMessage(
                    ciphertext,
                    messageIv,
                    conversationId,
                    conversationType,
                    parentMessageId  // Derives thread key if present
                );

                setDecrypted(plaintext);
            } catch (err) {
                // ✅ CRITICAL: Non-blocking error handling
                // Show user-friendly message, log details for debugging
                console.error('[E2EE] Decryption failed (non-blocking):', err);

                // UI only knows: "Show plaintext" or "Show 🔒"
                if (err.message?.includes('not found')) {
                    setDecrypted('🔒 Encrypted message (key not available)');
                } else {
                    setDecrypted('🔒 Unable to decrypt message');
                }
            } finally {
                setLoading(false);
            }
        };

        decrypt();
    }, [ciphertext, messageIv, conversationId, conversationType, parentMessageId]);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px' }}>
                <Lock size={13} style={{ animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontStyle: 'italic' }}>Decrypting...</span>
            </div>
        );
    }

    // If decryption failed, show lock emoji (already set in decrypted state)
    if (decrypted?.startsWith('🔒')) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px' }}>
                <Lock size={13} />
                <span style={{ fontStyle: 'italic' }}>{decrypted}</span>
            </div>
        );
    }

    // Successfully decrypted - show plaintext
    return (
        <div style={{ color: 'var(--text-primary)' }}>
            {decrypted}
        </div>
    );
}

export default EncryptedMessage;
