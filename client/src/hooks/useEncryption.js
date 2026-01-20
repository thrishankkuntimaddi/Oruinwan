// client/src/hooks/useEncryption.js
/**
 * useEncryption Hook
 * 
 * React hook for managing end-to-end encryption in the application
 * Handles key initialization, shared secret caching, and message encryption/decryption
 * 
 * @module hooks/useEncryption
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import * as encryption from '../utils/encryptionUtils';

/**
 * Hook for E2EE functionality
 * @param {string} userId - Current user ID
 * @returns {Object} Encryption utilities and state
 */
export function useEncryption(userId) {
    const [keys, setKeys] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Cache shared secrets per conversation to avoid re-deriving
    const sharedSecretsRef = useRef(new Map());

    /**
     * Clear encryption keys (on logout)
     */
    const clearEncryption = useCallback(async () => {
        try {
            await encryption.clearKeys(userId);
            setKeys(null);
            sharedSecretsRef.current.clear();
            console.log('🗑️ Encryption keys cleared');
        } catch (err) {
            console.error('Failed to clear keys:', err);
        }
    }, [userId]);

    /**
     * Load encryption keys from IndexedDB or server
     */
    const loadKeys = useCallback(async () => {
        try {
            setLoading(true);

            // Try to load from IndexedDB first (faster)
            const storedKeys = await encryption.getStoredKeys(userId);

            if (storedKeys && storedKeys.privateKey) {
                console.log('🔑 Loaded encryption keys from IndexedDB');
                setKeys(storedKeys);
                setLoading(false);
                return;
            }

            // Check if user has keys on server
            const response = await api.get('/api/v2/encryption/personal/keys');

            if (response.data.hasKeys) {
                console.log('⚠️ User has keys on server but not in IndexedDB');
                console.log('💡 User needs to log in with password to decrypt private key');
                // Keys exist on server but need password to decrypt
                setKeys(null);
            } else {
                console.log('ℹ️ User has not initialized E2EE yet');
                setKeys(null);
            }

            setLoading(false);
        } catch (err) {
            console.error('Failed to load encryption keys:', err);
            setError(err.message);
            setLoading(false);
        }
    }, [userId]);

    /**
     * Load and decrypt private key with password (for returning users)
     * @param {string} password - User password
     * @returns {Promise<boolean>} Success status
     */
    const unlockEncryption = useCallback(async (password) => {
        try {
            setLoading(true);
            setError(null);

            console.log('🔐 Fetching encrypted private key from server...');

            // Get encrypted private key from server
            const response = await api.get('/api/v2/encryption/personal/keys');

            if (!response.data.hasKeys) {
                throw new Error('No encryption keys found. Initialize E2EE first.');
            }

            const { publicKey, encryptedPrivateKey } = response.data;
            const encryptedData = JSON.parse(encryptedPrivateKey);

            console.log('🔓 Decrypting private key with password...');

            // Decrypt private key
            const privateKey = await encryption.decryptPrivateKey(encryptedData, password);

            console.log('💾 Storing in IndexedDB for session...');

            // Store in IndexedDB for current session
            await encryption.storeKeys(userId, privateKey);

            setKeys({ userId, privateKey, publicKey });
            setLoading(false);

            console.log('✅ E2EE unlocked successfully');
            return true;
        } catch (err) {
            console.error('Failed to unlock encryption:', err);
            setError('Invalid password or decryption failed');
            setLoading(false);
            return false;
        }
    }, [userId]);

    // Load user's keys on mount
    useEffect(() => {
        if (userId) {
            loadKeys();
        }
    }, [userId, loadKeys]);

    // Auto-unlock with password from login (if available)
    useEffect(() => {
        const attemptAutoUnlock = async () => {
            const password = sessionStorage.getItem('e2ee_unlock_password');
            if (password && userId && !keys) {
                console.log('🔓 Attempting auto-unlock with login password...');
                const success = await unlockEncryption(password);
                if (success) {
                    // Clear password from session storage for security
                    sessionStorage.removeItem('e2ee_unlock_password');
                }
            }
        };

        attemptAutoUnlock();
    }, [userId, keys, unlockEncryption]); // Re-run when userId or keys change

    // Listen for logout event to clear keys
    useEffect(() => {
        const handleLogout = () => {
            clearEncryption();
        };

        window.addEventListener('auth:logout', handleLogout);
        return () => window.removeEventListener('auth:logout', handleLogout);
    }, [clearEncryption]);

    /**
     * Initialize encryption for user (first-time setup)
     * @param {string} password - User password for encrypting private key
     * @returns {Promise<boolean>} Success status
     */
    const initializeEncryption = useCallback(async (password) => {
        try {
            setLoading(true);
            setError(null);

            console.log('🔐 Generating ECDH keypair...');

            // Generate keypair
            const { publicKey, privateKey } = await encryption.generateKeyPair();

            console.log('🔒 Encrypting private key with password...');

            // Encrypt private key with password
            const encryptedPrivateKey = await encryption.encryptPrivateKey(privateKey, password);

            console.log('📤 Storing keys on server...');

            // Store on server
            await api.post('/api/v2/encryption/personal/keys', {
                publicKey,
                encryptedPrivateKey: JSON.stringify(encryptedPrivateKey)
            });

            console.log('💾 Storing private key in IndexedDB...');

            // Store private key in IndexedDB for current session
            await encryption.storeKeys(userId, privateKey);

            setKeys({ userId, privateKey, publicKey });
            setLoading(false);

            console.log('✅ E2EE initialized successfully');
            return true;
        } catch (err) {
            console.error('Failed to initialize encryption:', err);
            setError(err.message);
            setLoading(false);
            return false;
        }
    }, [userId]);

    /**
     * Get or derive shared secret for a conversation
     * @param {string} otherUserId - Other user's ID
     * @returns {Promise<CryptoKey|null>} Shared secret
     */
    const getSharedSecret = useCallback(async (otherUserId) => {
        if (!keys || !keys.privateKey) {
            console.error('Private key not loaded');
            return null;
        }

        // Check cache first
        if (sharedSecretsRef.current.has(otherUserId)) {
            console.log(`✅ Using cached shared secret for user ${otherUserId}`);
            return sharedSecretsRef.current.get(otherUserId);
        }

        try {
            console.log(`🔑 Fetching public key for user ${otherUserId}...`);

            // Fetch other user's public key
            const response = await api.get(`/api/v2/encryption/personal/users/${otherUserId}/public-key`);

            if (!response.data.hasPublicKey) {
                console.warn(`⚠️ User ${otherUserId} has not enabled E2EE`);
                return null;
            }

            const theirPublicKey = response.data.publicKey;

            console.log(`🔐 Deriving shared secret with user ${otherUserId}...`);

            // Derive shared secret
            const sharedSecret = await encryption.deriveSharedSecret(keys.privateKey, theirPublicKey);

            // Cache it
            sharedSecretsRef.current.set(otherUserId, sharedSecret);

            console.log(`✅ Shared secret derived and cached`);
            return sharedSecret;
        } catch (err) {
            console.error('Failed to derive shared secret:', err);
            return null;
        }
    }, [keys]);

    /**
     * Encrypt a message for sending
     * @param {string} plaintext - Message text
     * @param {string} otherUserId - Recipient user ID
     * @returns {Promise<{ciphertext: string, messageIv: string}>}
     */
    const encryptMessage = useCallback(async (plaintext, otherUserId) => {
        if (!keys) {
            throw new Error('Encryption not initialized');
        }

        const sharedSecret = await getSharedSecret(otherUserId);
        if (!sharedSecret) {
            throw new Error('Failed to get shared secret');
        }

        console.log('🔒 Encrypting message...');
        const encrypted = await encryption.encryptMessage(plaintext, sharedSecret);
        console.log('✅ Message encrypted');

        return encrypted;
    }, [keys, getSharedSecret]);

    /**
     * Decrypt a received message
     * @param {string} ciphertext - Base64-encoded ciphertext
     * @param {string} messageIv - Base64-encoded IV
     * @param {string} otherUserId - Sender user ID
     * @returns {Promise<string>} Decrypted plaintext
     */
    const decryptMessage = useCallback(async (ciphertext, messageIv, otherUserId) => {
        if (!keys) {
            return '[Encrypted - keys not loaded]';
        }

        const sharedSecret = await getSharedSecret(otherUserId);
        if (!sharedSecret) {
            return '[Encrypted - failed to derive key]';
        }

        const plaintext = await encryption.decryptMessage(ciphertext, messageIv, sharedSecret);
        return plaintext;
    }, [keys, getSharedSecret]);

    return {
        // State
        keys,
        loading,
        error,
        isEncryptionEnabled: !!keys,
        hasKeys: !!keys,

        // Methods
        initializeEncryption,
        unlockEncryption,
        encryptMessage,
        decryptMessage,
        getSharedSecret,
        clearEncryption,
        reload: loadKeys
    };
}
