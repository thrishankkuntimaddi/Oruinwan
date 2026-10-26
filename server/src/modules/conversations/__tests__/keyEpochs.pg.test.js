'use strict';

/**
 * Conversation key epochs against a real PostgreSQL (migration 0018). Runs only when
 * KEYS_TEST_DATABASE_URL points at a throwaway database whose name ends in "_test"; skipped
 * otherwise. Example:
 *   KEYS_TEST_DATABASE_URL=postgres://oruinwan:oruinwan-dev@127.0.0.1:5432/oruinwan_keys_test npx jest keyEpochs.pg
 *
 * The story: Nani and Mani talk in a group; Teja is added "from now on"; Nikil is added with the
 * earlier history; Mani is removed.
 */

const crypto = require('crypto');

const URL_ = process.env.KEYS_TEST_DATABASE_URL;
const safe = URL_ && /_test$/.test(new URL(URL_).pathname.slice(1));
const run = safe ? describe : describe.skip;

const id = (c) => String(c).repeat(24).slice(0, 24);
const NANI = id('1');
const MANI = id('2');
const TEJA = id('3');
const NIKIL = id('4');
const WS = id('9');
const GROUP = id('a');

const pairs = new Map([NANI, MANI, TEJA, NIKIL].map((u) => [u, crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })]));
const pairOf = (u) => {
    if (!pairs.has(u)) pairs.set(u, crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }));
    return pairs.get(u);
};
const pem = (u) => pairOf(u).publicKey.export({ type: 'spki', format: 'pem' });
const open = (u, copy) => crypto.privateDecrypt({ key: pairOf(u).privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(copy.encryptedKey, 'base64'));

jest.mock('../conversationKeys.service', () => ({
    publicKeys: {
        findByUserId: async (u) => ({ userId: u, publicKey: pem(u) }),
        batchFindByUserIds: async (ids) => ids.map((u) => ({ userId: u, publicKey: pem(u) })),
    },
}));

run('conversation key epochs (PostgreSQL)', () => {
    let pg;
    let repo;
    let epochs;
    let cryptoUtils;
    const key1 = crypto.randomBytes(32);

    beforeAll(async () => {
        process.env.DATABASE_URL = URL_;
        process.env.SERVER_KEK = 'ab'.repeat(32);
        pg = require('../../../shared/postgres');
        await pg.connectPostgres();
        await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        await require('../../../shared/migrations').runMigrations({ pool: pg.getPool() });
        repo = require('../../../identity/keys.repo');
        epochs = require('../keyEpochs');
        cryptoUtils = require('../cryptoUtils');
        const server = cryptoUtils.encryptWithWorkspaceKey(key1);
        await repo.conversationKeys.upsert({
            conversationId: GROUP, conversationType: 'dm', workspaceId: WS, version: 1,
            workspaceEncryptedKey: { key: server.ciphertext, iv: server.iv, authTag: server.authTag, createdBy: NANI },
            encryptedKeys: [NANI, MANI].map((u) => ({ userId: u, ...cryptoUtils.wrapForUser(key1, pem(u)) })),
        });
    }, 60_000);

    afterAll(async () => { await pg?.closePostgres?.(); });

    const current = async (u) => {
        const k = await repo.conversationKeys.findByConversation(GROUP, 'dm');
        return { version: k.version, copy: k.getEncryptedKeyForUser(u) };
    };

    it('starts on key 1 for the two of them; messages without a version are fine', async () => {
        expect((await current(NANI)).version).toBe(1);
        expect(open(NANI, (await current(NANI)).copy).equals(key1)).toBe(true);
        await expect(epochs.checkSendVersion(GROUP, 'dm', null)).resolves.toBe(1);
    });

    it('adding Teja "from now on": a new key; Teja holds only that, Nani and Mani keep key 1', async () => {
        const r = await epochs.rotate(GROUP, 'dm', { memberIds: [NANI, MANI, TEJA], keepOld: [NANI, MANI] });
        expect(r).toEqual({ status: 'ROTATED', version: 2 });
        const teja = await current(TEJA);
        const key2 = open(TEJA, teja.copy);
        expect(key2.equals(key1)).toBe(false);
        expect(await epochs.earlierKeysFor(GROUP, 'dm', TEJA)).toEqual([]);
        const nanisOld = await epochs.earlierKeysFor(GROUP, 'dm', NANI);
        expect(nanisOld.map((e) => e.version)).toEqual([1]);
        expect(open(NANI, nanisOld[0]).equals(key1)).toBe(true);
        expect(open(MANI, (await current(MANI)).copy).equals(key2)).toBe(true);
    });

    it('sends must now use key 2', async () => {
        await expect(epochs.checkSendVersion(GROUP, 'dm', null)).rejects.toMatchObject({ code: 'KEY_ROTATED', status: 409, currentVersion: 2 });
        await expect(epochs.checkSendVersion(GROUP, 'dm', 1)).rejects.toMatchObject({ code: 'KEY_ROTATED' });
        await expect(epochs.checkSendVersion(GROUP, 'dm', 2)).resolves.toBe(2);
    });

    it('adding Nikil with the history Nani can see: key 1 from the server copy', async () => {
        const nanis = new Set((await epochs.list(GROUP, 'dm')).filter((e) => e.holders.has(NANI)).map((e) => e.version));
        const g = await epochs.grant(GROUP, 'dm', NIKIL, { versions: nanis });
        expect(g).toEqual({ granted: 1, unavailable: [] });
        const nikils = await epochs.earlierKeysFor(GROUP, 'dm', NIKIL);
        expect(open(NIKIL, nikils[0]).equals(key1)).toBe(true);
        // Granting again changes nothing.
        expect(await epochs.grant(GROUP, 'dm', NIKIL, { versions: nanis })).toEqual({ granted: 0, unavailable: [] });
    });

    it('removing Mani: a new key without Mani, and Mani loses every key copy', async () => {
        await epochs.rotate(GROUP, 'dm', { memberIds: [NANI, TEJA, NIKIL] });
        await epochs.removeUser(GROUP, 'dm', MANI);
        expect((await current(MANI)).copy).toBeNull();
        expect(await epochs.earlierKeysFor(GROUP, 'dm', MANI)).toEqual([]);
        // Teja keeps key 2 (from when they joined) but never got key 1.
        expect((await epochs.earlierKeysFor(GROUP, 'dm', TEJA)).map((e) => e.version)).toEqual([2]);
        expect((await epochs.earlierKeysFor(GROUP, 'dm', NANI)).map((e) => e.version)).toEqual([2, 1]);
        expect((await current(NANI)).version).toBe(3);
    });

    it('a rotation that lost a race changes nothing', async () => {
        await expect(repo.conversationKeyEpochs.rotate(GROUP, 'dm', { expectedVersion: 1, workspaceEncryptedKey: null, encryptedKeys: [] }))
            .rejects.toMatchObject({ code: 'KEY_CHANGED' });
        expect((await current(NANI)).version).toBe(3);
    });

    it('an earlier key without a server copy cannot be granted, and says so', async () => {
        await pg.query("UPDATE conversation_key_epochs SET workspace_encrypted_key = NULL WHERE version = 1");
        const g = await epochs.grant(GROUP, 'dm', id('5'), { versions: new Set([1]) });
        expect(g).toEqual({ granted: 0, unavailable: [1] });
    });
});
