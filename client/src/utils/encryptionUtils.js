export async function generateKeyPair() {
    try {
        
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: 'ECDH',
                namedCurve: 'P-256' 
            },
            true, 
            ['deriveKey', 'deriveBits']
        );

        
        const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
        const publicKey = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));

        
        const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        const privateKey = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)));

        return { publicKey, privateKey };
    } catch (err) {
        console.error('Failed to generate keypair:', err);
        throw new Error('Key generation failed');
    }
}

export async function encryptPrivateKey(privateKey, password) {
    try {
        
        const salt = window.crypto.getRandomValues(new Uint8Array(16));

        
        const passwordKey = await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const derivedKey = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );

        
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        
        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv
            },
            derivedKey,
            new TextEncoder().encode(privateKey)
        );

        
        const encryptedArray = new Uint8Array(encrypted);
        const ciphertext = encryptedArray.slice(0, -16);
        const authTag = encryptedArray.slice(-16);

        return {
            ciphertext: btoa(String.fromCharCode(...ciphertext)),
            iv: btoa(String.fromCharCode(...iv)),
            salt: btoa(String.fromCharCode(...salt)),
            authTag: btoa(String.fromCharCode(...authTag))
        };
    } catch (err) {
        console.error('Failed to encrypt private key:', err);
        throw new Error('Private key encryption failed');
    }
}

export async function decryptPrivateKey(encryptedData, password) {
    try {
        const { ciphertext, iv, salt, authTag } = encryptedData;

        
        const saltBuffer = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
        const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
        const ciphertextBuffer = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
        const authTagBuffer = Uint8Array.from(atob(authTag), c => c.charCodeAt(0));

        
        const passwordKey = await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const derivedKey = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: saltBuffer,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );

        
        const combined = new Uint8Array([...ciphertextBuffer, ...authTagBuffer]);

        
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: ivBuffer
            },
            derivedKey,
            combined
        );

        return new TextDecoder().decode(decrypted);
    } catch (err) {
        console.error('Failed to decrypt private key:', err);
        throw new Error('Private key decryption failed');
    }
}

export async function deriveSharedSecret(myPrivateKey, theirPublicKey) {
    try {
        
        const privateKeyBuffer = Uint8Array.from(atob(myPrivateKey), c => c.charCodeAt(0));
        const privateKey = await window.crypto.subtle.importKey(
            'pkcs8',
            privateKeyBuffer,
            {
                name: 'ECDH',
                namedCurve: 'P-256'
            },
            false,
            ['deriveKey', 'deriveBits']
        );

        
        const publicKeyBuffer = Uint8Array.from(atob(theirPublicKey), c => c.charCodeAt(0));
        const publicKey = await window.crypto.subtle.importKey(
            'spki',
            publicKeyBuffer,
            {
                name: 'ECDH',
                namedCurve: 'P-256'
            },
            false,
            []
        );

        
        const sharedSecret = await window.crypto.subtle.deriveKey(
            {
                name: 'ECDH',
                public: publicKey
            },
            privateKey,
            {
                name: 'AES-GCM',
                length: 256
            },
            false,
            ['encrypt', 'decrypt']
        );

        return sharedSecret;
    } catch (err) {
        console.error('Failed to derive shared secret:', err);
        throw new Error('Shared secret derivation failed');
    }
}

export async function encryptMessage(plaintext, sharedSecret) {
    try {
        
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        
        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv
            },
            sharedSecret,
            new TextEncoder().encode(plaintext)
        );

        return {
            ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
            iv: btoa(String.fromCharCode(...iv))
        };
    } catch (err) {
        console.error('Failed to encrypt message:', err);
        throw new Error('Message encryption failed');
    }
}

export async function decryptMessage(ciphertext, messageIv, sharedSecret) {
    try {
        
        const ciphertextBuffer = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
        const ivBuffer = Uint8Array.from(atob(messageIv), c => c.charCodeAt(0));

        
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: ivBuffer
            },
            sharedSecret,
            ciphertextBuffer
        );

        return new TextDecoder().decode(decrypted);
    } catch (err) {
        console.error('Failed to decrypt message:', err);
        return '[Encrypted message - decryption failed]';
    }
}

export async function storeKeys(userId, privateKey) {
    const dbName = 'ChttrixEncryption';
    const storeName = 'keys';

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onerror = () => reject(new Error('Failed to open IndexedDB'));

        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            const data = {
                userId,
                privateKey,
                timestamp: Date.now()
            };

            store.put(data);

            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
            transaction.onerror = () => reject(new Error('Transaction failed'));
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'userId' });
            }
        };
    });
}

export async function getStoredKeys(userId) {
    const dbName = 'ChttrixEncryption';
    const storeName = 'keys';

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onerror = () => reject(new Error('Failed to open IndexedDB'));

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'userId' });
            }
        };

        request.onsuccess = () => {
            const db = request.result;

            
            if (!db.objectStoreNames.contains(storeName)) {
                db.close();
                resolve(null);
                return;
            }

            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const getRequest = store.get(userId);

            getRequest.onsuccess = () => {
                db.close();
                resolve(getRequest.result || null);
            };
            getRequest.onerror = () => {
                db.close();
                reject(new Error('Failed to retrieve keys'));
            };
        };
    });
}

export async function clearKeys(userId) {
    const dbName = 'ChttrixEncryption';
    const storeName = 'keys';

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onerror = () => reject(new Error('Failed to open IndexedDB'));

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'userId' });
            }
        };

        request.onsuccess = () => {
            const db = request.result;

            
            if (!db.objectStoreNames.contains(storeName)) {
                db.close();
                resolve(); 
                return;
            }

            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            store.delete(userId);

            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
            transaction.onerror = () => {
                db.close();
                reject(new Error('Failed to clear keys'));
            };
        };
    });
}
