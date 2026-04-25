import {
    generateWorkspaceKey,
    generateIV,
    generateSalt,
    deriveKeyFromPassword,
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
    isCryptoSupported,
    validateCryptoSetup
} from '../utils/crypto';

describe('Crypto Utilities', () => {

    

    beforeAll(() => {
        
        expect(isCryptoSupported()).toBe(true);
    });

    

    describe('Key Generation', () => {
        test('generateWorkspaceKey creates valid AES-256-GCM key', async () => {
            const key = await generateWorkspaceKey();

            expect(key).toBeDefined();
            expect(key.type).toBe('secret');
            expect(key.algorithm.name).toBe('AES-GCM');
            expect(key.algorithm.length).toBe(256);
        });

        test('generateIV creates 12-byte random IV', () => {
            const iv = generateIV();

            expect(iv).toBeInstanceOf(Uint8Array);
            expect(iv.length).toBe(12);
        });

        test('generateIV creates unique IVs', () => {
            const iv1 = generateIV();
            const iv2 = generateIV();

            expect(iv1).not.toEqual(iv2);
        });

        test('generateSalt creates 16-byte random salt', () => {
            const salt = generateSalt();

            expect(salt).toBeInstanceOf(Uint8Array);
            expect(salt.length).toBe(16);
        });
    });

    

    describe('Key Derivation (PBKDF2)', () => {
        test('deriveKeyFromPassword creates valid key', async () => {
            const password = 'test-password-123';
            const salt = generateSalt();

            const key = await deriveKeyFromPassword(password, salt);

            expect(key).toBeDefined();
            expect(key.type).toBe('secret');
            expect(key.algorithm.name).toBe('AES-GCM');
        });

        test('same password and salt produce same key', async () => {
            const password = 'test-password-123';
            const salt = generateSalt();

            const key1 = await deriveKeyFromPassword(password, salt);
            const key2 = await deriveKeyFromPassword(password, salt);

            const raw1 = await exportKey(key1);
            const raw2 = await exportKey(key2);

            expect(new Uint8Array(raw1)).toEqual(new Uint8Array(raw2));
        });

        test('different passwords produce different keys', async () => {
            const salt = generateSalt();

            const key1 = await deriveKeyFromPassword('password1', salt);
            const key2 = await deriveKeyFromPassword('password2', salt);

            const raw1 = await exportKey(key1);
            const raw2 = await exportKey(key2);

            expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
        });

        test('different salts produce different keys', async () => {
            const password = 'same-password';

            const key1 = await deriveKeyFromPassword(password, generateSalt());
            const key2 = await deriveKeyFromPassword(password, generateSalt());

            const raw1 = await exportKey(key1);
            const raw2 = await exportKey(key2);

            expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
        });
    });

    

    describe('AES-GCM Encryption/Decryption', () => {
        test('encrypt and decrypt text message', async () => {
            const plaintext = 'Hello, this is a secret message!';
            const key = await generateWorkspaceKey();

            
            const { ciphertext, iv } = await encryptAESGCM(plaintext, key);

            expect(ciphertext).toBeDefined();
            expect(iv).toBeDefined();

            
            const decrypted = await decryptAESGCM(ciphertext, key, iv);
            const decryptedText = new TextDecoder().decode(decrypted);

            expect(decryptedText).toBe(plaintext);
        });

        test('encrypted data is different from plaintext', async () => {
            const plaintext = 'Secret message';
            const key = await generateWorkspaceKey();

            const { ciphertext } = await encryptAESGCM(plaintext, key);

            const ciphertextStr = new TextDecoder().decode(ciphertext);
            expect(ciphertextStr).not.toBe(plaintext);
        });

        test('same plaintext with different IVs produces different ciphertext', async () => {
            const plaintext = 'Same message';
            const key = await generateWorkspaceKey();

            const result1 = await encryptAESGCM(plaintext, key);
            const result2 = await encryptAESGCM(plaintext, key);

            expect(result1.ciphertext).not.toEqual(result2.ciphertext);
            expect(result1.iv).not.toEqual(result2.iv);
        });

        test('decryption fails with wrong key', async () => {
            const plaintext = 'Secret';
            const correctKey = await generateWorkspaceKey();
            const wrongKey = await generateWorkspaceKey();

            const { ciphertext, iv } = await encryptAESGCM(plaintext, correctKey);

            await expect(
                decryptAESGCM(ciphertext, wrongKey, iv)
            ).rejects.toThrow();
        });

        test('decryption fails with wrong IV', async () => {
            const plaintext = 'Secret';
            const key = await generateWorkspaceKey();

            const { ciphertext } = await encryptAESGCM(plaintext, key);
            const wrongIV = generateIV();

            await expect(
                decryptAESGCM(ciphertext, key, wrongIV)
            ).rejects.toThrow();
        });
    });

    

    describe('Message Encryption Helpers', () => {
        test('encryptMessage and decryptMessage work end-to-end', async () => {
            const message = 'Hello team! This is a test message.';
            const workspaceKey = await generateWorkspaceKey();

            
            const { ciphertext, iv } = await encryptMessage(message, workspaceKey);

            expect(typeof ciphertext).toBe('string'); 
            expect(typeof iv).toBe('string'); 

            
            const decrypted = await decryptMessage(ciphertext, iv, workspaceKey);

            expect(decrypted).toBe(message);
        });

        test('encryptMessage handles special characters', async () => {
            const message = '你好 🎉 Special chars: @#$%^&*()';
            const workspaceKey = await generateWorkspaceKey();

            const { ciphertext, iv } = await encryptMessage(message, workspaceKey);
            const decrypted = await decryptMessage(ciphertext, iv, workspaceKey);

            expect(decrypted).toBe(message);
        });

        test('encryptMessage handles empty string', async () => {
            const message = '';
            const workspaceKey = await generateWorkspaceKey();

            const { ciphertext, iv } = await encryptMessage(message, workspaceKey);
            const decrypted = await decryptMessage(ciphertext, iv, workspaceKey);

            expect(decrypted).toBe(message);
        });
    });

    

    describe('Key Import/Export', () => {
        test('export and import workspace key', async () => {
            const originalKey = await generateWorkspaceKey();

            
            const exported = await exportKey(originalKey);
            expect(exported).toBeInstanceOf(ArrayBuffer);
            expect(exported.byteLength).toBe(32); 

            
            const importedKey = await importKey(exported);

            
            const plaintext = 'Test message';
            const { ciphertext, iv } = await encryptAESGCM(plaintext, originalKey);
            const decrypted = await decryptAESGCM(ciphertext, importedKey, iv);

            const decryptedText = new TextDecoder().decode(decrypted);
            expect(decryptedText).toBe(plaintext);
        });
    });

    

    describe('Workspace Key Encryption', () => {
        test('encrypt and decrypt workspace key with KEK', async () => {
            const workspaceKey = await generateWorkspaceKey();
            const password = 'user-password-123';
            const salt = generateSalt();
            const kek = await deriveKeyFromPassword(password, salt);

            
            const { encryptedKey, iv } = await encryptWorkspaceKey(workspaceKey, kek);

            expect(typeof encryptedKey).toBe('string');
            expect(typeof iv).toBe('string');

            
            const decryptedKey = await decryptWorkspaceKey(encryptedKey, iv, kek);

            
            const testMessage = 'Test';
            const encrypted = await encryptMessage(testMessage, workspaceKey);
            const decrypted = await decryptMessage(encrypted.ciphertext, encrypted.iv, decryptedKey);

            expect(decrypted).toBe(testMessage);
        });

        test('cannot decrypt workspace key with wrong password', async () => {
            const workspaceKey = await generateWorkspaceKey();
            const correctPassword = 'correct-password';
            const wrongPassword = 'wrong-password';
            const salt = generateSalt();

            const correctKEK = await deriveKeyFromPassword(correctPassword, salt);
            const wrongKEK = await deriveKeyFromPassword(wrongPassword, salt);

            const { encryptedKey, iv } = await encryptWorkspaceKey(workspaceKey, correctKEK);

            await expect(
                decryptWorkspaceKey(encryptedKey, iv, wrongKEK)
            ).rejects.toThrow();
        });
    });

    

    describe('Base64 Encoding', () => {
        test('arrayBufferToBase64 and base64ToArrayBuffer roundtrip', () => {
            const original = new Uint8Array([1, 2, 3, 4, 5, 255]);
            const base64 = arrayBufferToBase64(original.buffer);
            const decoded = new Uint8Array(base64ToArrayBuffer(base64));

            expect(decoded).toEqual(original);
        });

        test('Base64 encoding is deterministic', () => {
            const data = new Uint8Array([10, 20, 30, 40, 50]);
            const encoded1 = arrayBufferToBase64(data.buffer);
            const encoded2 = arrayBufferToBase64(data.buffer);

            expect(encoded1).toBe(encoded2);
        });
    });

    

    describe('Validation', () => {
        test('isCryptoSupported returns true in test environment', () => {
            expect(isCryptoSupported()).toBe(true);
        });

        test('validateCryptoSetup does not throw in secure context', () => {
            expect(() => validateCryptoSetup()).not.toThrow();
        });
    });

    

    describe('Performance', () => {
        test('encryption is fast enough (<100ms for 1KB message)', async () => {
            const message = 'A'.repeat(1024); 
            const key = await generateWorkspaceKey();

            const start = performance.now();
            await encryptMessage(message, key);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(100); 
        });

        test('decryption is fast enough (<50ms for 1KB message)', async () => {
            const message = 'A'.repeat(1024);
            const key = await generateWorkspaceKey();

            const { ciphertext, iv } = await encryptMessage(message, key);

            const start = performance.now();
            await decryptMessage(ciphertext, iv, key);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(50); 
        });
    });
});
