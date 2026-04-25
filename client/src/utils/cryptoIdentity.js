const IDENTITY_KEY_CONFIG = {
    
    x25519: {
        algorithm: 'X25519',
        namedCurve: 'X25519'
    },

    
    rsa: {
        algorithm: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]), 
        hash: 'SHA-256'
    },

    
    aesGcm: {
        algorithm: 'AES-GCM',
        length: 256
    }
};

const KEY_VERSION = 1;

export function checkCryptoSupport() {
    const support = {
        x25519: false,
        rsa: false,
        indexedDB: false
    };

    if (typeof crypto === 'undefined' || !crypto.subtle) {
        return support;
    }

    
    support.rsa = true;

    
    try {
        support.x25519 = crypto.subtle.generateKey !== undefined;
    } catch (e) {
        support.x25519 = false;
    }

    
    support.indexedDB = typeof indexedDB !== 'undefined';

    return support;
}

export async function generateX25519KeyPair() {
    try {
        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'ECDH',
                namedCurve: 'X25519'
            },
            true, 
            ['deriveKey']
        );

        return keyPair;
    } catch (error) {
        console.error('X25519 key generation failed:', error);
        throw new Error('Failed to generate X25519 keypair');
    }
}

export async function generateRSAKeyPair() {
    try {
        const keyPair = await crypto.subtle.generateKey(
            {
                name: IDENTITY_KEY_CONFIG.rsa.algorithm,
                modulusLength: IDENTITY_KEY_CONFIG.rsa.modulusLength,
                publicExponent: IDENTITY_KEY_CONFIG.rsa.publicExponent,
                hash: IDENTITY_KEY_CONFIG.rsa.hash
            },
            true, 
            ['encrypt', 'decrypt']
        );

        return keyPair;
    } catch (error) {
        console.error('RSA key generation failed:', error);
        throw new Error('Failed to generate RSA keypair');
    }
}

export async function generateIdentityKeyPair() {
    const support = checkCryptoSupport();

    if (!support.indexedDB) {
        throw new Error('IndexedDB not available - cannot store keys securely');
    }

    let keyPair;
    let algorithm;

    
    if (support.x25519) {
        try {
            keyPair = await generateX25519KeyPair();
            algorithm = 'X25519';
        } catch (error) {
            console.warn('X25519 generation failed, falling back to RSA:', error);
        }
    }

    
    if (!keyPair && support.rsa) {
        keyPair = await generateRSAKeyPair();
        algorithm = 'RSA-2048';
    }

    if (!keyPair) {
        throw new Error('No supported identity key algorithm available');
    }

    return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        algorithm,
        version: KEY_VERSION
    };
}

export async function exportPublicKeyPEM(publicKey, algorithm) {
    try {
        const format = algorithm === 'X25519' ? 'raw' : 'spki';
        const exported = await crypto.subtle.exportKey(format, publicKey);
        const exportedBase64 = btoa(String.fromCharCode(...new Uint8Array(exported)));

        
        
        
        const keyType = algorithm === 'X25519' ? 'X25519 PUBLIC KEY' : 'PUBLIC KEY';
        const pem = `-----BEGIN ${keyType}-----\n${exportedBase64}\n-----END ${keyType}-----`;

        return pem;
    } catch (error) {
        console.error('Public key export failed:', error);
        throw new Error('Failed to export public key');
    }
}

export async function importPublicKeyPEM(pemKey, algorithm) {
    try {
        
        const pemContents = pemKey
            .replace(/-----BEGIN [A-Z0-9 ]+-----/, '')
            .replace(/-----END [A-Z0-9 ]+-----/, '')
            .replace(/\s/g, '');

        const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

        let keyConfig;
        let format;

        if (algorithm === 'X25519') {
            format = 'raw';
            keyConfig = {
                name: 'ECDH',
                namedCurve: 'X25519'
            };
        } else {
            format = 'spki';
            keyConfig = {
                name: 'RSA-OAEP',
                hash: 'SHA-256'
            };
        }

        const publicKey = await crypto.subtle.importKey(
            format,
            binaryDer.buffer,
            keyConfig,
            true,
            algorithm === 'X25519' ? [] : ['encrypt']
        );

        return publicKey;
    } catch (error) {
        console.error('Public key import failed:', error);
        throw new Error('Failed to import public key');
    }
}

export async function exportPrivateKeyJWK(privateKey) {
    try {
        const jwk = await crypto.subtle.exportKey('jwk', privateKey);
        return jwk;
    } catch (error) {
        console.error('Private key export failed:', error);
        throw new Error('Failed to export private key');
    }
}

export async function importPrivateKeyJWK(jwk, algorithm) {
    try {
        let keyConfig;
        let usages;

        if (algorithm === 'X25519') {
            keyConfig = {
                name: 'ECDH',
                namedCurve: 'X25519'
            };
            usages = ['deriveKey'];
        } else {
            keyConfig = {
                name: 'RSA-OAEP',
                hash: 'SHA-256'
            };
            usages = ['decrypt'];
        }

        const privateKey = await crypto.subtle.importKey(
            'jwk',
            jwk,
            keyConfig,
            true,
            usages
        );

        return privateKey;
    } catch (error) {
        console.error('Private key import failed:', error);
        throw new Error('Failed to import private key');
    }
}

export async function wrapKeyWithRSA(conversationKeyBytes, recipientPublicKey) {
    try {
        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'RSA-OAEP'
            },
            recipientPublicKey,
            conversationKeyBytes
        );

        return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    } catch (error) {
        console.error('RSA key wrapping failed:', error);
        throw new Error('Failed to wrap key with RSA');
    }
}

export async function unwrapKeyWithRSA(encryptedKeyBase64, privateKey) {
    try {
        const encryptedKey = Uint8Array.from(atob(encryptedKeyBase64), c => c.charCodeAt(0));

        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'RSA-OAEP'
            },
            privateKey,
            encryptedKey
        );

        return decrypted;
    } catch (error) {
        console.error('RSA key unwrapping failed:', error);
        throw new Error('Failed to unwrap key with RSA');
    }
}

export async function wrapKeyWithX25519(conversationKeyBytes, recipientPublicKey) {
    try {
        
        const ephemeralKeyPair = await generateX25519KeyPair();

        
        const sharedSecret = await crypto.subtle.deriveKey(
            {
                name: 'ECDH',
                public: recipientPublicKey
            },
            ephemeralKeyPair.privateKey,
            {
                name: 'AES-GCM',
                length: 256
            },
            false,
            ['encrypt']
        );

        
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            sharedSecret,
            conversationKeyBytes
        );

        
        const ephemeralPublicKeyRaw = await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey);

        
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);

        return {
            encryptedKey: btoa(String.fromCharCode(...combined)),
            ephemeralPublicKey: btoa(String.fromCharCode(...new Uint8Array(ephemeralPublicKeyRaw)))
        };
    } catch (error) {
        console.error('X25519 key wrapping failed:', error);
        throw new Error('Failed to wrap key with X25519');
    }
}

export async function unwrapKeyWithX25519(encryptedKeyBase64, ephemeralPublicKeyBase64, privateKey) {
    try {
        
        const ephemeralPublicKeyRaw = Uint8Array.from(atob(ephemeralPublicKeyBase64), c => c.charCodeAt(0));
        const ephemeralPublicKey = await crypto.subtle.importKey(
            'raw',
            ephemeralPublicKeyRaw.buffer,
            {
                name: 'ECDH',
                namedCurve: 'X25519'
            },
            false,
            []
        );

        
        const sharedSecret = await crypto.subtle.deriveKey(
            {
                name: 'ECDH',
                public: ephemeralPublicKey
            },
            privateKey,
            {
                name: 'AES-GCM',
                length: 256
            },
            false,
            ['decrypt']
        );

        
        const combined = Uint8Array.from(atob(encryptedKeyBase64), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);

        
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            sharedSecret,
            ciphertext
        );

        return decrypted;
    } catch (error) {
        console.error('X25519 key unwrapping failed:', error);
        throw new Error('Failed to unwrap key with X25519');
    }
}

const cryptoIdentity = {
    
    checkCryptoSupport,

    
    generateIdentityKeyPair,
    generateX25519KeyPair,
    generateRSAKeyPair,

    
    exportPublicKeyPEM,
    importPublicKeyPEM,
    exportPrivateKeyJWK,
    importPrivateKeyJWK,

    
    wrapKeyWithRSA,
    unwrapKeyWithRSA,
    wrapKeyWithX25519,
    unwrapKeyWithX25519,

    
    KEY_VERSION,
    IDENTITY_KEY_CONFIG
};

export default cryptoIdentity;
