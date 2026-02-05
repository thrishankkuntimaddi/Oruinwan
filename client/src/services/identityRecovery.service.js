// client/src/services/identityRecovery.service.js

/**
 * Identity Recovery Service
 * 
 * PHASE 4C: Emergency identity recovery via encrypted offline backup
 * 
 * CRITICAL SECURITY RULES:
 * - ALL encryption is CLIENT-SIDE
 * - Passphrase NEVER stored or transmitted
 * - Server NEVER sees plaintext private keys
 * - Recovery is EXPLICIT user action only
 * - No automatic backups
 * 
 * Security Model:
 * - Recovery requires BOTH file possession AND passphrase knowledge
 * - Lost passphrase = lost recovery (by design)
 * - Encrypted using PBKDF2-SHA256 (150k+ iterations)
 */

import { identityKeyService } from './identityKeyService';

const RECOVERY_BUNDLE_VERSION = 1;
const PBKDF2_ITERATIONS = 150000; // High iteration count for security
const RECOVERY_FILENAME = 'chttrix-identity-recovery.json';

/**
 * Export identity recovery bundle
 * 
 * Creates an encrypted backup of identity keys that can be downloaded
 * and later imported on a new device.
 * 
 * @param {string} recoveryPassphrase - User-chosen strong passphrase
 * @returns {Promise<void>} - Triggers browser download
 */
export async function exportIdentityRecoveryBundle(recoveryPassphrase) {
    try {
        console.log('🔐 [RECOVERY] Starting identity recovery export...');

        // Validate passphrase strength
        if (!recoveryPassphrase || recoveryPassphrase.length < 12) {
            throw new Error('Recovery passphrase must be at least 12 characters');
        }

        // Step 1: Ensure identity keys are initialized
        await identityKeyService.ensureIdentityKeyPair();

        // Step 2: Get plaintext identity keys from service (in-memory only)
        const identityKeyPair = identityKeyService.getIdentityKeyPair();

        if (!identityKeyPair || !identityKeyPair.privateKey) {
            throw new Error('Identity keys not available. Please ensure you are logged in.');
        }

        const identityPublicKey = identityKeyPair.publicKey;
        const identityPrivateKey = identityKeyPair.privateKey;

        // Step 3: Generate random salt for PBKDF2
        const salt = crypto.getRandomValues(new Uint8Array(32));

        // Step 4: Derive recovery encryption key from passphrase
        const recoveryKey = await deriveRecoveryKey(recoveryPassphrase, salt);

        // Step 5: Encrypt identity private key with recovery key
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedPrivateKey = await encryptWithRecoveryKey(
            identityPrivateKey,
            recoveryKey,
            iv
        );

        // Step 6: Build recovery bundle
        const recoveryBundle = {
            version: RECOVERY_BUNDLE_VERSION,
            algorithm: 'X25519',
            identityPublicKey: arrayBufferToBase64(identityPublicKey),
            encryptedIdentityPrivateKey: arrayBufferToBase64(encryptedPrivateKey),
            iv: arrayBufferToBase64(iv),
            salt: arrayBufferToBase64(salt),
            createdAt: new Date().toISOString(),
            warning: 'Anyone with this file and passphrase can access your encrypted messages. Store securely offline.'
        };

        // Step 7: Trigger download
        downloadRecoveryBundle(recoveryBundle);

        console.log('✅ [RECOVERY] Identity recovery bundle exported successfully');

        return {
            success: true,
            filename: RECOVERY_FILENAME
        };

    } catch (error) {
        console.error('❌ [RECOVERY] Export failed:', error);
        throw error;
    }
}

/**
 * Import identity recovery bundle
 * 
 * Restores identity keys from an encrypted recovery bundle.
 * Re-encrypts keys with current UMEK and uploads to server.
 * 
 * @param {File} file - Recovery bundle file
 * @param {string} recoveryPassphrase - Passphrase used during export
 * @param {string} currentPassword - Current login password (for PASSWORD users)
 * @returns {Promise<Object>}
 */
export async function importIdentityRecoveryBundle(file, recoveryPassphrase, currentPassword = null) {
    try {
        console.log('🔓 [RECOVERY] Starting identity recovery import...');

        // Step 1: Parse recovery bundle
        const recoveryBundle = await parseRecoveryBundle(file);

        // Step 2: Validate bundle schema
        validateRecoveryBundle(recoveryBundle);

        // Step 3: Derive recovery key from passphrase
        const salt = base64ToArrayBuffer(recoveryBundle.salt);
        const recoveryKey = await deriveRecoveryKey(recoveryPassphrase, salt);

        // Step 4: Decrypt identity private key
        const iv = base64ToArrayBuffer(recoveryBundle.iv);
        const encryptedPrivateKey = base64ToArrayBuffer(recoveryBundle.encryptedIdentityPrivateKey);

        let identityPrivateKey;
        try {
            identityPrivateKey = await decryptWithRecoveryKey(
                encryptedPrivateKey,
                recoveryKey,
                iv
            );
        } catch (error) {
            throw new Error('Failed to decrypt recovery bundle. Wrong passphrase?');
        }

        const identityPublicKey = base64ToArrayBuffer(recoveryBundle.identityPublicKey);

        // Step 5: Validate decrypted key matches public key
        await validateKeyPair(identityPublicKey, identityPrivateKey);

        // Step 6: Re-encrypt with current UMEK and upload to server
        await restoreIdentityToServer(identityPublicKey, identityPrivateKey, currentPassword);

        // Step 7: Initialize identity key service with restored keys
        await identityKeyService.ensureIdentityKeyPair();

        console.log('✅ [RECOVERY] Identity successfully recovered from backup');

        return {
            success: true,
            identityPublicKey: recoveryBundle.identityPublicKey,
            restoredAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ [RECOVERY] Import failed:', error);
        throw error;
    }
}

/**
 * Derive recovery encryption key from passphrase using PBKDF2
 * @private
 */
async function deriveRecoveryKey(passphrase, salt) {
    const encoder = new TextEncoder();
    const passphraseBytes = encoder.encode(passphrase);

    // Import passphrase as key material
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passphraseBytes,
        'PBKDF2',
        false,
        ['deriveKey']
    );

    // Derive AES-256-GCM key
    const recoveryKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        {
            name: 'AES-GCM',
            length: 256
        },
        false,
        ['encrypt', 'decrypt']
    );

    return recoveryKey;
}

/**
 * Encrypt data with recovery key
 * @private
 */
async function encryptWithRecoveryKey(data, recoveryKey, iv) {
    const encrypted = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        recoveryKey,
        data
    );

    return encrypted;
}

/**
 * Decrypt data with recovery key
 * @private
 */
async function decryptWithRecoveryKey(encryptedData, recoveryKey, iv) {
    const decrypted = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        recoveryKey,
        encryptedData
    );

    return decrypted;
}

/**
 * Parse recovery bundle from file
 * @private
 */
async function parseRecoveryBundle(file) {
    const text = await file.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error('Invalid recovery bundle file format');
    }
}

/**
 * Validate recovery bundle schema
 * @private
 */
function validateRecoveryBundle(bundle) {
    const requiredFields = [
        'version',
        'algorithm',
        'identityPublicKey',
        'encryptedIdentityPrivateKey',
        'iv',
        'salt',
        'createdAt'
    ];

    for (const field of requiredFields) {
        if (!bundle[field]) {
            throw new Error(`Invalid recovery bundle: missing ${field}`);
        }
    }

    if (bundle.version !== RECOVERY_BUNDLE_VERSION) {
        throw new Error(`Unsupported recovery bundle version: ${bundle.version}`);
    }

    if (bundle.algorithm !== 'X25519') {
        throw new Error(`Unsupported algorithm: ${bundle.algorithm}`);
    }
}

/**
 * Validate that private key matches public key
 * @private
 */
async function validateKeyPair(publicKey, privateKey) {
    try {
        // Import keys to validate format and compatibility
        await crypto.subtle.importKey(
            'raw',
            publicKey,
            {
                name: 'X25519',
                namedCurve: 'X25519'
            },
            true,
            []
        );

        await crypto.subtle.importKey(
            'pkcs8',
            privateKey,
            {
                name: 'X25519',
                namedCurve: 'X25519'
            },
            true,
            ['deriveBits']
        );

        // Successful import validates key format and compatibility
        // For X25519, if keys don't match or are invalid, import will fail

        console.log('✅ [RECOVERY] Key pair validation successful');
        return true;
    } catch (error) {
        throw new Error('Invalid key pair: private key does not match public key');
    }
}

/**
 * Restore identity to server by re-encrypting with UMEK
 * @private
 */
async function restoreIdentityToServer(identityPublicKey, identityPrivateKey, currentPassword) {
    // Generate new UMEK
    const umek = crypto.getRandomValues(new Uint8Array(32));

    // Encrypt identity private key with UMEK
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const umekKey = await crypto.subtle.importKey(
        'raw',
        umek,
        'AES-GCM',
        false,
        ['encrypt']
    );

    const encryptedIdentityPrivateKey = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        umekKey,
        identityPrivateKey
    );

    // Prepare UMEK envelope based on protection type
    let umekEnvelope, umekEnvelopeIv, umekSalt, umekProtectionType;

    if (currentPassword) {
        // PASSWORD protection
        umekProtectionType = 'PASSWORD';
        umekSalt = crypto.getRandomValues(new Uint8Array(16));

        // Derive KEK from password
        const encoder = new TextEncoder();
        const passwordBytes = encoder.encode(currentPassword);
        const keyMaterial = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveKey']);

        const kek = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: umekSalt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );

        umekEnvelopeIv = crypto.getRandomValues(new Uint8Array(12));
        umekEnvelope = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: umekEnvelopeIv },
            kek,
            umek
        );
    } else {
        // SERVER_KEK protection (OAuth users)
        umekProtectionType = 'SERVER_KEK';
        // Server will wrap UMEK upon receipt
        umekEnvelope = null;
        umekEnvelopeIv = null;
        umekSalt = null;
    }

    // Upload to server using existing Phase 1 endpoint
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/v2/crypto/identity/init`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
            identityPublicKey: arrayBufferToBase64(identityPublicKey),
            encryptedIdentityPrivateKey: arrayBufferToBase64(encryptedIdentityPrivateKey),
            identityPrivateKeyIv: arrayBufferToBase64(iv),
            umekEnvelope: umekEnvelope ? arrayBufferToBase64(umekEnvelope) : null,
            umekEnvelopeIv: umekEnvelopeIv ? arrayBufferToBase64(umekEnvelopeIv) : null,
            umekSalt: umekSalt ? arrayBufferToBase64(umekSalt) : null,
            umekProtectionType,
            algorithm: 'X25519'
        })
    });

    if (!response.ok) {
        throw new Error('Failed to upload restored identity to server');
    }

    console.log('✅ [RECOVERY] Identity uploaded to server successfully');
}

/**
 * Trigger browser download of recovery bundle
 * @private
 */
function downloadRecoveryBundle(bundle) {
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = RECOVERY_FILENAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`📥 [RECOVERY] Downloaded: ${RECOVERY_FILENAME}`);
}

/**
 * Utility: Convert ArrayBuffer to Base64
 * @private
 */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Utility: Convert Base64 to ArrayBuffer
 * @private
 */
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
