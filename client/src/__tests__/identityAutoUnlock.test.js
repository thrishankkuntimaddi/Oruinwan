// Automatic unlock: password-protected keys are sealed on the server the first time the password
// is at hand, new identities are always server-sealed, and a QR sign-in's pre-wrapped key opens
// without asking the server.
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import nodeCrypto from 'node:crypto';

// Minimal IndexedDB (one object store keyed by userId) for the key cache.
function fakeIndexedDB() {
    const data = new Map();
    const req = (fn) => {
        const r = {};
        setTimeout(() => { r.result = fn(); r.onsuccess?.({ target: r }); }, 0);
        return r;
    };
    const db = {
        objectStoreNames: { contains: () => true },
        close() {},
        transaction: () => ({
            objectStore: () => ({
                put: (v) => req(() => { data.set(v.userId, v); }),
                get: (k) => req(() => data.get(k)),
                delete: (k) => req(() => { data.delete(k); }),
            }),
        }),
    };
    return { open: () => { const r = {}; setTimeout(() => { r.result = db; r.onsuccess?.(); }, 0); return r; }, data };
}

const calls = [];
let serverState = null;

function respond(status, body) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeAll(() => {
    vi.stubGlobal('window', { addEventListener() {} });
});

beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal('indexedDB', fakeIndexedDB());
    vi.stubGlobal('localStorage', { getItem: () => 'tok', setItem() {}, removeItem() {} });
    vi.stubGlobal('fetch', vi.fn(async (url, opts = {}) => {
        const path = String(url).replace(/^.*?\/api/, '/api');
        const body = opts.body ? JSON.parse(opts.body) : null;
        calls.push({ path, method: opts.method || 'GET', body });
        if (path === '/api/v2/crypto/identity' && (opts.method || 'GET') === 'GET') return serverState ? respond(200, serverState) : respond(404, {});
        if (path === '/api/v2/crypto/identity/seal-umek') return respond(200, { success: true });
        if (path === '/api/v2/crypto/identity/init') return respond(200, { version: 1 });
        if (path === '/api/v2/identity/public-key') return respond(200, {});
        if (path === '/api/v2/crypto/identity/unwrap-umek') return respond(500, {});
        return respond(404, {});
    }));
});

async function freshService() {
    vi.resetModules();
    return (await import('../services/identityKeyService')).default;
}

async function rsaIdentity() {
    const { exportPublicKeyPEM } = await import('../utils/cryptoIdentity');
    const pair = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    return { jwk, pem: await exportPublicKeyPEM(pair.publicKey, 'RSA-2048') };
}

describe('automatic unlock', () => {
    it('a password sign-in opens a password-protected key and seals it on the server', async () => {
        const c = await import('../utils/crypto.js');
        const { jwk, pem } = await rsaIdentity();
        const salt = c.generateSalt();
        const umek = await c.deriveUMEKFromPassword('Passw0rd!', salt);
        const { encryptedPrivateKey, iv } = await c.encryptIdentityPrivateKey(JSON.stringify(jwk), umek);
        serverState = {
            identityPublicKey: pem, encryptedIdentityPrivateKey: encryptedPrivateKey, identityPrivateKeyIv: iv,
            umekProtectionType: 'PASSWORD', umekSalt: c.arrayBufferToBase64(salt), umekEnvelope: 'password-derived', algorithm: 'RSA-2048', version: 2,
        };
        const svc = await freshService();
        const result = await svc.initializeIdentityKeys('u1', 'Passw0rd!');
        expect(result.status).toBe('READY');
        await vi.waitFor(() => expect(calls.some((x) => x.path === '/api/v2/crypto/identity/seal-umek')).toBe(true));
        const sealed = calls.find((x) => x.path === '/api/v2/crypto/identity/seal-umek').body.umek;
        expect(sealed).toBe(c.arrayBufferToBase64(await c.exportKey(umek)));
    });

    it('without the password a password-protected key reports PASSWORD_REQUIRED (non-blocking banner)', async () => {
        serverState = { umekProtectionType: 'PASSWORD', umekSalt: 'AAAA', identityPublicKey: 'x', algorithm: 'RSA-2048' };
        const svc = await freshService();
        expect((await svc.initializeIdentityKeys('u1', null)).status).toBe('PASSWORD_REQUIRED');
        expect(calls.some((x) => x.path.endsWith('seal-umek'))).toBe(false);
    });

    it('new identities are always sealed on the server, even when a password is given', async () => {
        serverState = null;
        const svc = await freshService();
        const result = await svc.initializeIdentityKeys('u1', 'Passw0rd!');
        expect(result).toEqual(expect.objectContaining({ status: 'READY', existed: false }));
        const init = calls.find((x) => x.path === '/api/v2/crypto/identity/init').body;
        expect(init.umekProtectionType).toBe('SERVER_KEK');
        expect(init.umekSalt).toBeNull();
        expect(atob(init.umekEnvelope)).toHaveLength(32);
    });

    it('a QR sign-in opens the key with the one-time key, without asking the server to unwrap', async () => {
        const c = await import('../utils/crypto.js');
        const { jwk, pem } = await rsaIdentity();
        const rawUmek = nodeCrypto.randomBytes(32);
        const umek = await crypto.subtle.importKey('raw', rawUmek, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
        const { encryptedPrivateKey, iv } = await c.encryptIdentityPrivateKey(JSON.stringify(jwk), umek);
        serverState = { identityPublicKey: pem, encryptedIdentityPrivateKey: encryptedPrivateKey, identityPrivateKeyIv: iv, umekProtectionType: 'SERVER_KEK', umekEnvelope: 'sealed', algorithm: 'RSA-2048', version: 1 };

        // The browser's one-time key, and the server's wrap (umekEnvelope.wrapForDevice).
        const mine = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
        const myPublic = Buffer.from(await crypto.subtle.exportKey('raw', mine.publicKey));
        const ecdh = nodeCrypto.createECDH('prime256v1');
        ecdh.generateKeys();
        const wrapKey = nodeCrypto.pbkdf2Sync(ecdh.computeSecret(myPublic), 'umek-wrap-v1', 10000, 32, 'sha256');
        const wiv = nodeCrypto.randomBytes(12);
        const cipher = nodeCrypto.createCipheriv('aes-256-gcm', wrapKey, wiv);
        const enc = Buffer.concat([cipher.update(rawUmek), cipher.final()]);
        const wrappedUmek = {
            serverEphemeralPublicKey: ecdh.getPublicKey().toString('base64'),
            rewrappedUmek: Buffer.concat([wiv, cipher.getAuthTag(), enc]).toString('base64'),
        };

        const svc = await freshService();
        const result = await svc.initializeIdentityKeys('u1', null, { wrappedUmek, ephemeralPrivateKey: mine.privateKey });
        expect(result.status).toBe('READY');
        expect(calls.some((x) => x.path.endsWith('unwrap-umek'))).toBe(false);
    });

    it('sealWithPassword refuses a wrong password and does nothing for sealed keys', async () => {
        const c = await import('../utils/crypto.js');
        const { jwk } = await rsaIdentity();
        const salt = c.generateSalt();
        const umek = await c.deriveUMEKFromPassword('right', salt);
        const { encryptedPrivateKey, iv } = await c.encryptIdentityPrivateKey(JSON.stringify(jwk), umek);
        serverState = { encryptedIdentityPrivateKey: encryptedPrivateKey, identityPrivateKeyIv: iv, umekProtectionType: 'PASSWORD', umekSalt: c.arrayBufferToBase64(salt) };
        const svc = await freshService();
        await expect(svc.sealWithPassword('wrong')).rejects.toThrow('Incorrect password');
        expect(await svc.sealWithPassword('right')).toBe('SERVER_KEK');
        serverState = { umekProtectionType: 'SERVER_KEK' };
        calls.length = 0;
        expect(await svc.sealWithPassword('anything')).toBe('SERVER_KEK');
        expect(calls.some((x) => x.path.endsWith('seal-umek'))).toBe(false);
    });
});
