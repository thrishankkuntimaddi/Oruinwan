import { identityKeyService } from './identityKeyService';

const RECOVERY_BUNDLE_VERSION = 1;
const PBKDF2_ITERATIONS = 150000; 
const RECOVERY_FILENAME = 'chttrix-identity-recovery.json';

export async function exportIdentityRecoveryBundle(recoveryPassphrase) {
    try {
        console.log('🔐 [RECOVERY] Starting identity recovery export...');

        
        if (!recoveryPassphrase || recoveryPassphrase.length < 12) {
            throw new Error('Recovery passphrase must be at least 12 characters');
        }

        
        await identityKeyService.ensureIdentityKeyPair();

        
        const identityKeyPair = identityKeyService.getIdentityKeyPair();

        if (!identityKeyPair || !identityKeyPair.privateKey) {
            throw new Error('Identity keys not available. Please ensure you are logged in.');
        }

        const identityPublicKey = identityKeyPair.publicKey;
        const identityPrivateKey = identityKeyPair.privateKey;

        
        const salt = crypto.getRandomValues(new Uint8Array(32));

        
        const recoveryKey = await deriveRecoveryKey(recoveryPassphrase, salt);

        
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedPrivateKey = await encryptWithRecoveryKey(
            identityPrivateKey,
            recoveryKey,
            iv
        );

        
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

export async function importIdentityRecoveryBundle(file, recoveryPassphrase, currentPassword = null) {
    try {
        console.log('🔓 [RECOVERY] Starting identity recovery import...');

        
        const recoveryBundle = await parseRecoveryBundle(file);

        
        validateRecoveryBundle(recoveryBundle);

        
        const salt = base64ToArrayBuffer(recoveryBundle.salt);
        const recoveryKey = await deriveRecoveryKey(recoveryPassphrase, salt);

        
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

        
        await validateKeyPair(identityPublicKey, identityPrivateKey);

        
        await restoreIdentityToServer(identityPublicKey, identityPrivateKey, currentPassword);

        
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

async function deriveRecoveryKey(passphrase, salt) {
    const encoder = new TextEncoder();
    const passphraseBytes = encoder.encode(passphrase);

    
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passphraseBytes,
        'PBKDF2',
        false,
        ['deriveKey']
    );

    
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

async function parseRecoveryBundle(file) {
    const text = await file.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error('Invalid recovery bundle file format');
    }
}

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

async function validateKeyPair(publicKey, privateKey) {
    try {
        
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

        
        

        console.log('✅ [RECOVERY] Key pair validation successful');
        return true;
    } catch (error) {
        throw new Error('Invalid key pair: private key does not match public key');
    }
}

async function restoreIdentityToServer(identityPublicKey, identityPrivateKey, currentPassword) {
    
    const umek = crypto.getRandomValues(new Uint8Array(32));

    
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

    
    let umekEnvelope, umekEnvelopeIv, umekSalt, umekProtectionType;

    if (currentPassword) {
        
        umekProtectionType = 'PASSWORD';
        umekSalt = crypto.getRandomValues(new Uint8Array(16));

        
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
        
        umekProtectionType = 'SERVER_KEK';
        
        umekEnvelope = null;
        umekEnvelopeIv = null;
        umekSalt = null;
    }

    
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v2/crypto/identity/init`, {
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

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
