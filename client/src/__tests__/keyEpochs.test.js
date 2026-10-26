import { describe, it, expect, vi, beforeEach } from 'vitest';

// Real AES-GCM keys; the key service is replaced by a small fake holding them by version.
const fake = vi.hoisted(() => ({ current: null, version: 1, previous: new Map(), refreshTo: null, refreshed: 0 }));
vi.mock('../services/conversationKeyService', () => ({
    default: {
        getConversationKey: async () => fake.current,
        getCurrentVersion: () => fake.version,
        getDecryptionKeys: async (_id, _t, keyVersion) => {
            const earlier = [...fake.previous.entries()].sort((a, b) => b[0] - a[0]).map(([, k]) => k);
            const keys = [fake.current, ...earlier].filter(Boolean);
            const named = keyVersion != null && Number(keyVersion) !== fake.version ? fake.previous.get(Number(keyVersion)) : null;
            return named ? [named, ...keys.filter((k) => k !== named)] : keys;
        },
        refreshIfStale: async () => {
            fake.refreshed += 1;
            if (!fake.refreshTo) return false;
            Object.assign(fake, fake.refreshTo, { refreshTo: null });
            return true;
        },
    },
}));

const { encryptMessageForSending, decryptTextOrNull, decryptWithConversationKeys } = await import('../services/messageEncryptionService');
const { withKeyVersion, keyVersionOf, notifyKeyRotated, onKeyRotated } = await import('../services/keyVersions');

const newKey = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

describe('conversation key versions on the web', () => {
    let k1;
    let k2;
    beforeEach(async () => {
        k1 = await newKey();
        k2 = await newKey();
        Object.assign(fake, { current: k1, version: 1, previous: new Map(), refreshTo: null, refreshed: 0 });
    });

    it('encrypts with the current key and says which version', async () => {
        const enc = await encryptMessageForSending('hello', 'c1', 'dm');
        expect(enc.keyVersion).toBe(1);
        expect(keyVersionOf(enc.ciphertext)).toBe(1);
        expect(withKeyVersion({ ciphertext: enc.ciphertext, messageIv: enc.messageIv })).toMatchObject({ keyVersion: 1 });
        // Send later puts the encrypted text in `body`.
        expect(withKeyVersion({ workspaceId: 'w', body: { ciphertext: enc.ciphertext } }).body.keyVersion).toBe(1);
        // Unknown ciphertexts and other requests are left alone.
        expect(withKeyVersion({ ciphertext: 'other' })).toEqual({ ciphertext: 'other' });
        expect(withKeyVersion(null)).toBeNull();
    });

    it('after the key changed, old messages open with the earlier key and new ones with the new key', async () => {
        const old = await encryptMessageForSending('before', 'c1', 'dm');
        Object.assign(fake, { current: k2, version: 2, previous: new Map([[1, k1]]) });
        const fresh = await encryptMessageForSending('after', 'c1', 'dm');
        expect(fresh.keyVersion).toBe(2);
        expect(await decryptTextOrNull(old.ciphertext, old.messageIv, 'c1', 'dm', null, 1)).toBe('before');
        expect(await decryptTextOrNull(old.ciphertext, old.messageIv, 'c1', 'dm')).toBe('before'); // no version: tries them all
        expect(await decryptTextOrNull(fresh.ciphertext, fresh.messageIv, 'c1', 'dm')).toBe('after');
    });

    it('someone added "from now on" holds only the new key: earlier messages stay closed', async () => {
        const old = await encryptMessageForSending('before you joined', 'c1', 'dm');
        Object.assign(fake, { current: k2, version: 2, previous: new Map() });
        expect(await decryptTextOrNull(old.ciphertext, old.messageIv, 'c1', 'dm')).toBeNull();
    });

    it('a message under a newer key than mine: fetch the keys once, then open it', async () => {
        Object.assign(fake, { current: k2, version: 2 });
        const fresh = await encryptMessageForSending('new', 'c1', 'dm');
        Object.assign(fake, { current: k1, version: 1, refreshTo: { current: k2, version: 2, previous: new Map([[1, k1]]) } });
        expect(await decryptWithConversationKeys(fresh.ciphertext, fresh.messageIv, 'c1', 'dm')).toBe('new');
        expect(fake.refreshed).toBe(1);
    });

    it('threads: the thread key comes from whichever conversation key opens it', async () => {
        const reply = await encryptMessageForSending('in thread', 'c1', 'channel', 'p1');
        Object.assign(fake, { current: k2, version: 2, previous: new Map([[1, k1]]) });
        expect(await decryptTextOrNull(reply.ciphertext, reply.messageIv, 'c1', 'channel', 'p1')).toBe('in thread');
    });

    it('a key change reaches whoever listens', () => {
        const seen = [];
        const off = onKeyRotated((id, type) => seen.push([id, type]));
        notifyKeyRotated('c9', 'dm');
        off();
        notifyKeyRotated('c9', 'dm');
        expect(seen).toEqual([['c9', 'dm']]);
    });
});

describe('retryOnKeyRotated', () => {
    it('sends once more after KEY_ROTATED, telling the sender it is the second attempt', async () => {
        const { retryOnKeyRotated } = await import('../services/keyVersions');
        const attempts = [];
        const out = await retryOnKeyRotated(async (n) => {
            attempts.push(n);
            if (n === 0) throw Object.assign(new Error('409'), { response: { status: 409, data: { code: 'KEY_ROTATED' } } });
            return 'ok';
        });
        expect(out).toBe('ok');
        expect(attempts).toEqual([0, 1]);
    });

    it('does not retry other errors', async () => {
        const { retryOnKeyRotated } = await import('../services/keyVersions');
        let calls = 0;
        await expect(retryOnKeyRotated(async () => { calls += 1; throw Object.assign(new Error('403'), { response: { status: 403, data: {} } }); })).rejects.toThrow('403');
        expect(calls).toBe(1);
    });
});
