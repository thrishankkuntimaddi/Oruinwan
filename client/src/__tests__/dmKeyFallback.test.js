// A DM the server has no key for (a server older than the app, or making it failed there):
// the app makes the key for every participant, gives the server its copy (escrow), and uses
// someone else's key when they made it first.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const ME = '64a000000000000000000001';
const THEM = '64a000000000000000000002';
const DM = '64b000000000000000000009';
const WS = '64c000000000000000000003';

const rsa = () => crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['encrypt', 'decrypt'],
);
const pem = async (key) => `-----BEGIN PUBLIC KEY-----\n${btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('spki', key))))}\n-----END PUBLIC KEY-----`;
const httpError = (status, data = {}) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
const unwrap = async (b64, privateKey) => new Uint8Array(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));

const mockState = { me: null, them: null, server: null, calls: [] };

vi.mock('../services/api', () => {
    const record = (method) => vi.fn(async (url, body) => {
        mockState.calls.push({ method, url, body });
        return mockState.server(method, url, body);
    });
    return { default: { get: record('GET'), post: record('POST') } };
});
vi.mock('../services/identityKeyService', () => ({
    default: {
        get myUserId() { return ME; },
        publicKeysCache: new Map(),
        getMyPrivateKey: () => mockState.me.privateKey,
        batchGetUserPublicKeys: async (ids) => {
            const { default: svc } = await import('../services/identityKeyService');
            return new Map(ids.filter((id) => svc.publicKeysCache.has(id)).map((id) => [id, svc.publicKeysCache.get(id)]));
        },
    },
}));

beforeAll(async () => {
    vi.stubGlobal('window', { addEventListener() {} });
    mockState.me = await rsa();
    mockState.them = await rsa();
});

async function freshService() {
    vi.resetModules();
    const { default: ids } = await import('../services/identityKeyService');
    ids.publicKeysCache.clear();
    ids.publicKeysCache.set(ME, { publicKey: mockState.me.publicKey, algorithm: 'RSA-2048' });
    return (await import('../services/conversationKeyService')).default;
}

// An older server: no DM details endpoint and no DM key until someone stores one.
function olderServer({ storeConflict = false } = {}) {
    const stored = { keys: null, escrow: null };
    mockState.server = async (method, url, body) => {
        if (method === 'GET' && url === `/api/v2/conversations/${DM}/keys`) {
            if (!stored.keys) throw httpError(404, { error: 'KEY_NOT_INITIALIZED' });
            const mine = stored.keys.find((k) => k.userId === ME);
            return { data: { ...mine, serverCopy: true } };
        }
        if (method === 'GET' && url === `/api/v2/dm/${DM}`) throw httpError(404);
        if (method === 'GET' && url === `/api/v2/messages/workspace/${WS}/dms`) {
            return { data: { sessions: [{ id: DM, otherUserId: THEM, otherUser: { _id: THEM } }] } };
        }
        if (method === 'POST' && url === '/api/v2/identity/public-keys') {
            return { data: { publicKeys: [{ userId: THEM, publicKey: await pem(mockState.them.publicKey), algorithm: 'RSA-2048' }] } };
        }
        if (method === 'POST' && url === `/api/v2/conversations/${DM}/keys`) {
            if (storeConflict) throw httpError(409, { error: 'KEY_EXISTS' });
            stored.keys = body.encryptedKeys;
            return { data: {} };
        }
        if (method === 'POST' && url === `/api/v2/conversations/${DM}/keys/escrow`) {
            stored.escrow = body;
            return { data: {} };
        }
        throw httpError(404);
    };
    return stored;
}

describe('DM key fallback', () => {
    beforeEach(() => { mockState.calls.length = 0; });

    it('reports the missing key first', async () => {
        olderServer();
        const svc = await freshService();
        const result = await svc.getConversationKey(DM, 'dm');
        expect(result).toMatchObject({ status: 'MISSING_FOR_USER', reason: 'KEY_NOT_INITIALIZED' });
    });

    it('makes the key for both people and gives the server its copy', async () => {
        const stored = olderServer();
        const svc = await freshService();

        const key = await svc.createDMKey(DM, WS);
        expect(key).toBeInstanceOf(CryptoKey);
        expect(stored.keys.map((k) => k.userId).sort()).toEqual([ME, THEM].sort());

        const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
        const theirs = await unwrap(stored.keys.find((k) => k.userId === THEM).encryptedKey, mockState.them.privateKey);
        expect(theirs).toEqual(raw);

        await vi.waitFor(() => expect(stored.escrow).not.toBeNull());
        expect(stored.escrow.type).toBe('dm');
        expect(Uint8Array.from(atob(stored.escrow.key), (c) => c.charCodeAt(0))).toEqual(raw);

        // Later sends use the same key without asking again.
        expect(await svc.getConversationKey(DM, 'dm')).toBe(key);
    });

    it("uses the other person's key when they made it first", async () => {
        const stored = olderServer({ storeConflict: true });
        const svc = await freshService();
        // Someone else stored a key for both of us a moment ago.
        const theirKey = crypto.getRandomValues(new Uint8Array(32));
        const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, mockState.me.publicKey, theirKey));
        stored.keys = [{ userId: ME, encryptedKey: btoa(String.fromCharCode(...wrapped)), algorithm: 'RSA-2048' }];

        const key = await svc.createDMKey(DM, WS);
        expect(new Uint8Array(await crypto.subtle.exportKey('raw', key))).toEqual(theirKey);
    });

    it('gives up quietly when the DM is not in my list', async () => {
        olderServer();
        mockState.server = ((inner) => async (method, url, body) => (
            url.endsWith('/dms') ? { data: { sessions: [] } } : inner(method, url, body)
        ))(mockState.server);
        const svc = await freshService();
        expect(await svc.createDMKey(DM, WS)).toBeNull();
        expect(mockState.calls.some((c) => c.method === 'POST' && c.url.endsWith('/keys'))).toBe(false);
    });
});
