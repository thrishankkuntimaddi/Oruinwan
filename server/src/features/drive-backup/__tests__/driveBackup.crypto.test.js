'use strict';

/** Refresh-token sealing and the backup file format (AES-256-GCM over gzip JSON). */

process.env.CRYPTO_KEK_V1 = 'a'.repeat(64);
process.env.CRYPTO_KEK_ACTIVE_VERSION = '1';

const box = require('../driveBackup.crypto');

const USER = '64b000000000000000000001';
const OTHER = '64b000000000000000000002';

test('the refresh token is sealed under the KEK and opens again', () => {
    const sealed = box.sealSecret('1//refresh-token-secret');
    expect(sealed).toMatch(/^v1:1:/);
    expect(sealed).not.toContain('refresh-token-secret');
    expect(box.openSecret(sealed)).toBe('1//refresh-token-secret');
    // Two seals of the same token differ (random IV).
    expect(box.sealSecret('1//refresh-token-secret')).not.toBe(sealed);
});

test('a tampered sealed token is refused', () => {
    const sealed = box.sealSecret('tok');
    const buf = Buffer.from(sealed.split(':')[2], 'base64');
    buf[buf.length - 1] ^= 1;
    expect(() => box.openSecret(`v1:1:${buf.toString('base64')}`)).toThrow();
});

test('round trip: what goes in comes out, and no plaintext is in the file', () => {
    const bundle = { notes: [{ _id: 'n1', title: 'Quarterly plan — secret words' }], profile: { username: 'ada' } };
    const bytes = box.packBackup(bundle, { userId: USER, meta: { counts: { notes: 1 } } });
    expect(bytes.subarray(0, 8).toString('ascii')).toBe('ORWNBK01');
    expect(bytes.toString('latin1')).not.toContain('secret words');
    expect(bytes.toString('latin1')).not.toContain('Quarterly');

    const { header, bundle: out } = box.unpackBackup(bytes, { userId: USER });
    expect(out).toEqual(bundle);
    expect(header).toMatchObject({ userId: USER, cipher: 'AES-256-GCM', counts: { notes: 1 } });
    expect(header.wrappedKey.key).toBeTruthy();
});

test('only the owning account can open a backup', () => {
    const bytes = box.packBackup({ a: 1 }, { userId: USER });
    expect(() => box.unpackBackup(bytes, { userId: OTHER })).toThrow(expect.objectContaining({ code: 'BACKUP_OWNER' }));
});

test('a backup whose header was edited (e.g. the owner swapped) does not decrypt', () => {
    const bytes = box.packBackup({ a: 1 }, { userId: USER, meta: { counts: { notes: 1 } } });
    const text = bytes.toString('latin1').replace('"notes":1', '"notes":9');
    expect(() => box.unpackBackup(Buffer.from(text, 'latin1'), { userId: USER })).toThrow(expect.objectContaining({ code: 'BACKUP_DECRYPT' }));
});

test('a backup made under another KEK cannot be opened here', () => {
    const bytes = box.packBackup({ a: 1 }, { userId: USER });
    process.env.CRYPTO_KEK_V1 = 'b'.repeat(64);
    try {
        expect(() => box.unpackBackup(bytes, { userId: USER })).toThrow(expect.objectContaining({ code: 'BACKUP_DECRYPT' }));
    } finally {
        process.env.CRYPTO_KEK_V1 = 'a'.repeat(64);
    }
});

test('foreign files are recognised', () => {
    expect(() => box.readHeader(Buffer.from('hello world, not a backup'))).toThrow(expect.objectContaining({ code: 'BACKUP_FORMAT' }));
});
