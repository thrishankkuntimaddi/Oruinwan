'use strict';

const { webcrypto, randomBytes } = require('crypto');

process.env.CRYPTO_KEK_V1 = 'a'.repeat(64);
process.env.CRYPTO_KEK_ACTIVE_VERSION = '1';

const mockRows = new Map();
jest.mock('../../../identity', () => ({
    cryptoState: {
        findByUserId: jest.fn(async (userId) => (mockRows.has(userId) ? { ...mockRows.get(userId) } : null)),
        upsert: jest.fn(async (userId, state) => {
            const next = { ...(mockRows.get(userId) || {}), ...state, userId };
            mockRows.set(userId, next);
            return { ...next };
        }),
    },
}));

const controller = require('../identity.controller');
const envelope = require('../umekEnvelope');

const { subtle } = webcrypto;
const b64 = (bytes) => Buffer.from(bytes).toString('base64');

function call(handler, body, userId = 'u1') {
    return new Promise((resolve, reject) => {
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(payload) { resolve({ status: this.statusCode, body: payload }); return this; },
        };
        Promise.resolve(handler({ user: { sub: userId }, body, headers: {} }, res)).catch(reject);
    });
}

// The steps of _unwrapUMEKFromServer in client/src/services/identityKeyService.js.
async function unwrapLikeTheBrowser(userId, body = {}) {
    const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
    const clientEphemeralPublicKey = b64(await subtle.exportKey('raw', pair.publicKey));
    const res = await call(controller.unwrapUmekWithServerKEK, { ...body, clientEphemeralPublicKey }, userId);
    if (res.status !== 200) return { res };

    const serverPublicKey = await subtle.importKey('raw', Buffer.from(res.body.serverEphemeralPublicKey, 'base64'), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const bits = await subtle.deriveBits({ name: 'ECDH', public: serverPublicKey }, pair.privateKey, 256);
    const material = await subtle.importKey('raw', new Uint8Array(bits), 'PBKDF2', false, ['deriveKey']);
    const wrappingKey = await subtle.deriveKey(
        { name: 'PBKDF2', salt: new TextEncoder().encode('umek-wrap-v1'), iterations: 10000, hash: 'SHA-256' },
        material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
    const wrapped = Buffer.from(res.body.rewrappedUmek, 'base64');
    const combined = Buffer.concat([wrapped.subarray(28), wrapped.subarray(12, 28)]);
    const umek = await subtle.decrypt({ name: 'AES-GCM', iv: wrapped.subarray(0, 12), tagLength: 128 }, wrappingKey, combined);
    return { res, umek: Buffer.from(umek) };
}

const identity = {
    identityPublicKey: 'PEM',
    encryptedIdentityPrivateKey: 'ct',
    identityPrivateKeyIv: 'iv',
    algorithm: 'RSA-OAEP-2048',
};

describe('UMEK envelopes', () => {
    beforeEach(() => mockRows.clear());

    test('a password account stores only the marker, whatever the client sends', async () => {
        const rawUmek = b64(randomBytes(32));
        const res = await call(controller.initIdentityCryptoState, { ...identity, umekProtectionType: 'PASSWORD', umekSalt: 'salt', umekEnvelope: rawUmek });
        expect(res.status).toBe(200);
        expect(mockRows.get('u1').umekEnvelope).toBe(envelope.PASSWORD_DERIVED);
        expect(mockRows.get('u1').kekVersion).toBeNull();
    });

    test('a SERVER_KEK account stores the UMEK sealed, and a new device can unwrap it', async () => {
        const umek = randomBytes(32);
        const res = await call(controller.initIdentityCryptoState, { ...identity, umekProtectionType: 'SERVER_KEK', umekEnvelope: b64(umek) });
        expect(res.status).toBe(200);

        const stored = mockRows.get('u1');
        expect(stored.kekVersion).toBe(1);
        expect(stored.umekEnvelope).not.toContain(b64(umek));
        expect(Buffer.from(stored.umekEnvelope, 'base64')).toHaveLength(60);
        expect(envelope.openUmek(stored.umekEnvelope, stored.kekVersion).equals(umek)).toBe(true);

        const { res: unwrapRes, umek: recovered } = await unwrapLikeTheBrowser('u1', { umekEnvelope: stored.umekEnvelope });
        expect(unwrapRes.status).toBe(200);
        expect(recovered.equals(umek)).toBe(true);
    });

    test('unwrap uses the stored envelope, not one from the request', async () => {
        const umek = randomBytes(32);
        await call(controller.initIdentityCryptoState, { ...identity, umekProtectionType: 'SERVER_KEK', umekEnvelope: b64(umek) });
        const other = envelope.sealUmek(randomBytes(32)).envelope;
        const { umek: recovered } = await unwrapLikeTheBrowser('u1', { umekEnvelope: other });
        expect(recovered.equals(umek)).toBe(true);
    });

    test('rows written before sealing still unwrap', async () => {
        const umek = randomBytes(32);
        mockRows.set('u1', { userId: 'u1', umekProtectionType: 'SERVER_KEK', umekEnvelope: b64(umek), kekVersion: null });
        const { umek: recovered } = await unwrapLikeTheBrowser('u1');
        expect(recovered.equals(umek)).toBe(true);
    });

    test('SERVER_KEK setup rejects an envelope that is not a 32-byte key', async () => {
        const res = await call(controller.initIdentityCryptoState, { ...identity, umekProtectionType: 'SERVER_KEK', umekEnvelope: 'password-derived' });
        expect(res.status).toBe(400);
        expect(mockRows.has('u1')).toBe(false);
    });

    test('password accounts cannot use the server unwrap', async () => {
        mockRows.set('u1', { userId: 'u1', umekProtectionType: 'PASSWORD', umekEnvelope: envelope.PASSWORD_DERIVED });
        const { res } = await unwrapLikeTheBrowser('u1');
        expect(res.status).toBe(403);
    });

    test('sealStoredUmeks scrubs password rows and seals unsealed SERVER_KEK rows', async () => {
        const legacy = b64(randomBytes(32));
        const query = jest.fn(async (sql) => {
            if (/umek_protection_type = 'PASSWORD'/.test(sql)) return { rowCount: 2, rows: [] };
            if (/^\s*SELECT/.test(sql)) return { rowCount: 2, rows: [{ user_id: 'u9', umek_envelope: legacy }, { user_id: 'u8', umek_envelope: 'x'.repeat(44) }] };
            return { rowCount: 1, rows: [] };
        });

        expect(await envelope.sealStoredUmeks({ query })).toEqual({ scrubbed: 2, sealed: 1 });
        expect(query.mock.calls[0][1]).toEqual([envelope.PASSWORD_DERIVED]);
        const [, [userId, sealed, kekVersion, previous]] = query.mock.calls[2];
        expect(userId).toBe('u9');
        expect(kekVersion).toBe(1);
        expect(previous).toBe(legacy);
        expect(envelope.openUmek(sealed, 1).toString('base64')).toBe(legacy);
    });
});
