import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
    generateIdentityKeyPair,
    generateX25519KeyPair,
    wrapKeyWithX25519,
    unwrapKeyWithX25519,
    exportPublicKeyPEM,
    importPublicKeyPEM,
    wrapKeyWithRSA,
    unwrapKeyWithRSA,
} from '../utils/cryptoIdentity';

describe('identity keys', () => {
    const hadIndexedDB = 'indexedDB' in globalThis;
    beforeAll(() => { if (!hadIndexedDB) globalThis.indexedDB = {}; });
    afterAll(() => { if (!hadIndexedDB) delete globalThis.indexedDB; });

    it('are RSA-2048, the only algorithm the server can wrap conversation keys for', async () => {
        const identity = await generateIdentityKeyPair();
        expect(identity.algorithm).toBe('RSA-2048');

        // Round trip through the PEM the server stores, as a conversation key would travel.
        const pem = await exportPublicKeyPEM(identity.publicKey, identity.algorithm);
        expect(pem).toMatch(/^-----BEGIN PUBLIC KEY-----/);
        const publicKey = await importPublicKeyPEM(pem, identity.algorithm);
        const conversationKey = crypto.getRandomValues(new Uint8Array(32));
        const wrapped = await wrapKeyWithRSA(conversationKey, publicKey);
        const unwrapped = await unwrapKeyWithRSA(wrapped, identity.privateKey);
        expect(new Uint8Array(unwrapped)).toEqual(conversationKey);
    });
});

describe('X25519 helpers (standard Web Crypto parameters)', () => {
    it('generate a key pair and round-trip a wrapped key', async () => {
        const recipient = await generateX25519KeyPair();
        expect(recipient.publicKey.algorithm.name).toBe('X25519');

        const conversationKey = crypto.getRandomValues(new Uint8Array(32));
        const { encryptedKey, ephemeralPublicKey } = await wrapKeyWithX25519(conversationKey, recipient.publicKey);
        const unwrapped = await unwrapKeyWithX25519(encryptedKey, ephemeralPublicKey, recipient.privateKey);
        expect(new Uint8Array(unwrapped)).toEqual(conversationKey);
    });
});
