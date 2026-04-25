const CRYPTO_CONFIG = {
    
    algorithm: 'AES-GCM',
    keyLength: 256, 
    ivLength: 12, 
    tagLength: 128, 

    
    pbkdf2: {
        algorithm: 'PBKDF2',
        hash: 'SHA-256',
        iterations: 100000,
        saltLength: 16, 
        keyLength: 32 
    }
};

export async function generateWorkspaceKey() {
    try {
        const key = await crypto.subtle.generateKey(
            {
                name: CRYPTO_CONFIG.algorithm,
                length: CRYPTO_CONFIG.keyLength
            },
            true, 
            ['encrypt', 'decrypt']
        );

        return key;
    } catch (error) {
        console.error('Failed to generate workspace key:', error);
        throw new Error('Key generation failed');
    }
}

export function generateIV() {
    return crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.ivLength));
}

export function generateSalt() {
    return crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.pbkdf2.saltLength));
}

export async function deriveKeyFromPassword(password, salt, iterations = CRYPTO_CONFIG.pbkdf2.iterations) {
    try {
        
        const passwordBytes = new TextEncoder().encode(password);

        
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBytes,
            CRYPTO_CONFIG.pbkdf2.algorithm,
            false,
            ['deriveKey']
        );

        
        const derivedKey = await crypto.subtle.deriveKey(
            {
                name: CRYPTO_CONFIG.pbkdf2.algorithm,
                salt: salt,
                iterations: iterations,
                hash: CRYPTO_CONFIG.pbkdf2.hash
            },
            keyMaterial,
            {
                name: CRYPTO_CONFIG.algorithm,
                length: CRYPTO_CONFIG.keyLength
            },
            true, 
            ['encrypt', 'decrypt']
        );

        return derivedKey;
    } catch (error) {
        console.error('Failed to derive key from password:', error);
        throw new Error('Key derivation failed');
    }
}

export async function generateUMEK() {
    try {
        const umek = await crypto.subtle.generateKey(
            {
                name: CRYPTO_CONFIG.algorithm,
                length: CRYPTO_CONFIG.keyLength
            },
            true, 
            ['encrypt', 'decrypt']
        );
        return umek;
    } catch (error) {
        console.error('Failed to generate UMEK:', error);
        throw new Error('UMEK generation failed');
    }
}

export async function deriveUMEKFromPassword(password, salt) {
    return deriveKeyFromPassword(password, salt);
}

export async function encryptIdentityPrivateKey(privateKeyJWK, umek) {
    try {
        const iv = generateIV();
        const privateKeyBytes = new TextEncoder().encode(privateKeyJWK);

        const ciphertext = await crypto.subtle.encrypt(
            {
                name: CRYPTO_CONFIG.algorithm,
                iv: iv,
                tagLength: CRYPTO_CONFIG.tagLength
            },
            umek,
            privateKeyBytes
        );

        return {
            encryptedPrivateKey: arrayBufferToBase64(ciphertext),
            iv: arrayBufferToBase64(iv)
        };
    } catch (error) {
        console.error('Failed to encrypt identity private key:', error);
        throw new Error('Identity private key encryption failed');
    }
}

export async function decryptIdentityPrivateKey(encryptedPrivateKeyBase64, ivBase64, umek) {
    try {
        const encryptedPrivateKey = base64ToArrayBuffer(encryptedPrivateKeyBase64);
        const iv = base64ToArrayBuffer(ivBase64);

        const decryptedBytes = await crypto.subtle.decrypt(
            {
                name: CRYPTO_CONFIG.algorithm,
                iv: iv,
                tagLength: CRYPTO_CONFIG.tagLength
            },
            umek,
            encryptedPrivateKey
        );

        return new TextDecoder().decode(decryptedBytes);
    } catch (error) {
        console.error('Failed to decrypt identity private key:', error);
        throw new Error('Identity private key decryption failed');
    }
}

export async function deriveThreadKey(conversationKey, parentMessageId) {
    try {

        
        const info = new TextEncoder().encode(`thread:${parentMessageId}`);

        
        const conversationKeyBytes = await crypto.subtle.exportKey('raw', conversationKey);

        
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            conversationKeyBytes,
            'HKDF',
            false,
            ['deriveKey']
        );

        
        const threadKey = await crypto.subtle.deriveKey(
            {
                name: 'HKDF',
                hash: 'SHA-256',
                salt: new Uint8Array(32), 
                info: info
            },
            keyMaterial,
            {
                name: CRYPTO_CONFIG.algorithm,
                length: CRYPTO_CONFIG.keyLength
            },
            true, 
            ['encrypt', 'decrypt']
        );

        return threadKey;
    } catch (error) {
        console.error('Thread key derivation failed:', error);
        throw new Error('Thread key derivation failed');
    }
}

export async function encryptAESGCM(plaintext, key, iv = null) {
    try {
        
        const ivBytes = iv || generateIV();

        
        const plaintextBytes = typeof plaintext === 'string'
            ? new TextEncoder().encode(plaintext)
            : plaintext;

        
        const ciphertext = await crypto.subtle.encrypt(
            {
                name: CRYPTO_CONFIG.algorithm,
                iv: ivBytes,
                tagLength: CRYPTO_CONFIG.tagLength
            },
            key,
            plaintextBytes
        );

        return {
            ciphertext,
            iv: ivBytes
        };
    } catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Encryption failed');
    }
}

export async function encryptMessage(message, workspaceKey) {
    try {
        const { ciphertext, iv } = await encryptAESGCM(message, workspaceKey);

        return {
            ciphertext: arrayBufferToBase64(ciphertext),
            iv: arrayBufferToBase64(iv)
        };
    } catch (error) {
        console.error('Message encryption failed:', error);
        throw error;
    }
}

export async function decryptAESGCM(ciphertext, key, iv) {
    try {
        const plaintext = await crypto.subtle.decrypt(
            {
                name: CRYPTO_CONFIG.algorithm,
                iv: iv,
                tagLength: CRYPTO_CONFIG.tagLength
            },
            key,
            ciphertext
        );

        return plaintext;
    } catch (error) {
        console.error('Decryption failed:', error);
        throw new Error('Decryption failed - invalid key or corrupted data');
    }
}

export async function decryptMessage(ciphertextBase64, ivBase64, workspaceKey) {
    try {
        
        const ciphertext = base64ToArrayBuffer(ciphertextBase64);
        const iv = base64ToArrayBuffer(ivBase64);

        
        const plaintextBytes = await decryptAESGCM(ciphertext, workspaceKey, iv);

        
        const plaintext = new TextDecoder().decode(plaintextBytes);

        return plaintext;
    } catch (error) {
        console.error('Message decryption failed:', error);
        throw error;
    }
}

export async function exportKey(key) {
    try {
        const exported = await crypto.subtle.exportKey('raw', key);
        return exported;
    } catch (error) {
        console.error('Key export failed:', error);
        throw new Error('Key export failed');
    }
}

export async function importKey(keyBytes) {
    try {
        const key = await crypto.subtle.importKey(
            'raw',
            keyBytes,
            {
                name: CRYPTO_CONFIG.algorithm,
                length: CRYPTO_CONFIG.keyLength
            },
            true,
            ['encrypt', 'decrypt']
        );

        return key;
    } catch (error) {
        console.error('Key import failed:', error);
        throw new Error('Key import failed');
    }
}

export async function encryptWorkspaceKey(workspaceKey, kek) {
    try {
        
        const workspaceKeyBytes = await exportKey(workspaceKey);

        
        const { ciphertext, iv } = await encryptAESGCM(workspaceKeyBytes, kek);

        return {
            encryptedKey: arrayBufferToBase64(ciphertext),
            iv: arrayBufferToBase64(iv)
        };
    } catch (error) {
        console.error('Workspace key encryption failed:', error);
        throw error;
    }
}

export async function decryptWorkspaceKey(encryptedKeyBase64, ivBase64, kek) {
    try {
        
        const encryptedKey = base64ToArrayBuffer(encryptedKeyBase64);
        const iv = base64ToArrayBuffer(ivBase64);

        
        const workspaceKeyBytes = await decryptAESGCM(encryptedKey, kek, iv);

        
        const workspaceKey = await importKey(workspaceKeyBytes);

        return workspaceKey;
    } catch (error) {
        console.error('Workspace key decryption failed:', error);
        throw error;
    }
}

export function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export function uint8ArrayToBase64(bytes) {
    return arrayBufferToBase64(bytes.buffer);
}

export function base64ToUint8Array(base64) {
    return new Uint8Array(base64ToArrayBuffer(base64));
}

export function isCryptoSupported() {
    return (
        typeof crypto !== 'undefined' &&
        typeof crypto.subtle !== 'undefined' &&
        typeof crypto.getRandomValues !== 'undefined'
    );
}

export function isSecureContext() {
    return window.isSecureContext;
}

export function validateCryptoSetup() {
    if (!isCryptoSupported()) {
        throw new Error('Web Crypto API not supported in this browser');
    }

    if (!isSecureContext()) {
        throw new Error('Crypto functions require HTTPS or localhost');
    }
}

const cryptoUtils = {
    
    CRYPTO_CONFIG,

    
    generateWorkspaceKey,
    generateIV,
    generateSalt,

    
    deriveKeyFromPassword,
    deriveThreadKey,

    
    generateUMEK,
    deriveUMEKFromPassword,
    encryptIdentityPrivateKey,
    decryptIdentityPrivateKey,

    
    encryptAESGCM,
    decryptAESGCM,
    encryptMessage,
    decryptMessage,

    
    exportKey,
    importKey,
    encryptWorkspaceKey,
    decryptWorkspaceKey,

    
    arrayBufferToBase64,
    base64ToArrayBuffer,
    uint8ArrayToBase64,
    base64ToUint8Array,

    
    isCryptoSupported,
    isSecureContext,
    validateCryptoSetup
};

export default cryptoUtils;
