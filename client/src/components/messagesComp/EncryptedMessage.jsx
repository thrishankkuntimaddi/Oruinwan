import React, { useState, useEffect } from 'react';
import { decryptReceivedMessage } from '../../services/messageEncryptionService';
import { Lock } from 'lucide-react';

function EncryptedMessage({ ciphertext, messageIv, conversationId, conversationType, parentMessageId = null }) {
    const [decrypted, setDecrypted] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        
        
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

                
                const plaintext = await decryptReceivedMessage(
                    ciphertext,
                    messageIv,
                    conversationId,
                    conversationType,
                    parentMessageId  
                );

                setDecrypted(plaintext);
            } catch (err) {
                
                
                console.error('[E2EE] Decryption failed (non-blocking):', err);

                
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

    
    if (decrypted?.startsWith('🔒')) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px' }}>
                <Lock size={13} />
                <span style={{ fontStyle: 'italic' }}>{decrypted}</span>
            </div>
        );
    }

    
    return (
        <div style={{ color: 'var(--text-primary)' }}>
            {decrypted}
        </div>
    );
}

export default EncryptedMessage;
