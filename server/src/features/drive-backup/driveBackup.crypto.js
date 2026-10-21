'use strict';

/**
 * Encryption for Google Drive backups.
 *
 * 1. The Google refresh token is stored sealed under the server KEK (AES-256-GCM), like
 *    the UMEK envelope: v1:<kekVersion>:<base64 iv|tag|ciphertext>.
 *
 * 2. The backup file (`oruinwan-backup.bin`) is
 *
 *      "ORWNBK01" | uint32 BE header length | header JSON | iv(12) | tag(16) | ciphertext
 *
 *    The ciphertext is AES-256-GCM over gzip(JSON bundle) with a fresh random 32-byte
 *    backup key. The backup key is sealed in the header with an account key:
 *    HKDF-SHA256(KEK, salt = account id, info = "oruinwan-drive-backup-v1"). The header
 *    (minus nothing secret) is the additional authenticated data for the bundle, so the
 *    account id, dates and counts in it can't be swapped. Only this server, for this
 *    account, can open the file; Google only ever holds ciphertext.
 *
 *    Why not the UMEK: password accounts derive their UMEK on the device and the server
 *    never sees it, so a server-run (automatic) backup could not seal for it. Message
 *    bodies inside the bundle stay end-to-end encrypted regardless, and the identity
 *    private key inside is still wrapped by the UMEK.
 */

const crypto = require('crypto');
const zlib = require('zlib');
const kekManager = require('../../services/kekManager.service');

const MAGIC = Buffer.from('ORWNBK01', 'ascii');
const FORMAT = 'oruinwan-drive-backup';
const FORMAT_VERSION = 1;
const HKDF_INFO = 'oruinwan-drive-backup-v1';

// ── Refresh token sealing ────────────────────────────────────────────────────

function sealSecret(plaintext) {
    if (typeof plaintext !== 'string' || !plaintext) throw new Error('Nothing to seal');
    const { version, key } = kekManager.getActiveKEK();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from('drive-refresh-token'));
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return `v1:${version}:${Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64')}`;
}

function openSecret(sealed) {
    const m = /^v1:(\d+):([A-Za-z0-9+/=]+)$/.exec(String(sealed || ''));
    if (!m) throw new Error('Not a sealed secret');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length < 29) throw new Error('Sealed secret is truncated');
    const decipher = crypto.createDecipheriv('aes-256-gcm', kekManager.getKEKForUnwrap(Number(m[1])), buf.subarray(0, 12));
    decipher.setAAD(Buffer.from('drive-refresh-token'));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}

// ── Backup file ──────────────────────────────────────────────────────────────

function accountKey(userId, kekVersion) {
    const kek = kekManager.getKEKForUnwrap(kekVersion);
    return Buffer.from(crypto.hkdfSync('sha256', kek, Buffer.from(String(userId)), Buffer.from(HKDF_INFO), 32));
}

function gcm(key, iv, aad) {
    const c = crypto.createCipheriv('aes-256-gcm', key, iv);
    if (aad) c.setAAD(aad);
    return c;
}

/**
 * Encrypt a bundle for `userId`. `meta` goes into the (authenticated, readable) header:
 * keep it to dates and counts.
 * @returns {Buffer}
 */
function packBackup(bundle, { userId, meta = {} } = {}) {
    if (!userId) throw new Error('packBackup needs userId');
    const { version: kekVersion } = kekManager.getActiveKEK();
    const backupKey = crypto.randomBytes(32);

    const wrapIv = crypto.randomBytes(12);
    const wrapper = gcm(accountKey(userId, kekVersion), wrapIv, Buffer.from(`wrap:${userId}`));
    const wrapped = Buffer.concat([wrapper.update(backupKey), wrapper.final()]);

    const header = {
        format: FORMAT,
        v: FORMAT_VERSION,
        userId: String(userId),
        createdAt: new Date().toISOString(),
        cipher: 'AES-256-GCM',
        compression: 'gzip',
        kekVersion,
        wrappedKey: { iv: wrapIv.toString('base64'), tag: wrapper.getAuthTag().toString('base64'), key: wrapped.toString('base64') },
        ...meta,
    };
    const headerBuf = Buffer.from(JSON.stringify(header), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(headerBuf.length);

    const iv = crypto.randomBytes(12);
    const cipher = gcm(backupKey, iv, headerBuf);
    const body = Buffer.concat([cipher.update(zlib.gzipSync(Buffer.from(JSON.stringify(bundle), 'utf8'))), cipher.final()]);
    return Buffer.concat([MAGIC, len, headerBuf, iv, cipher.getAuthTag(), body]);
}

/** Read the header without decrypting (dates, counts, owner). Throws on a foreign file. */
function readHeader(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < MAGIC.length + 4 || !buf.subarray(0, MAGIC.length).equals(MAGIC)) {
        throw Object.assign(new Error('This is not an Oruinwan backup file'), { code: 'BACKUP_FORMAT' });
    }
    const len = buf.readUInt32BE(MAGIC.length);
    const start = MAGIC.length + 4;
    if (len <= 0 || start + len + 28 > buf.length) throw Object.assign(new Error('The backup file is damaged'), { code: 'BACKUP_FORMAT' });
    const headerBuf = buf.subarray(start, start + len);
    let header;
    try { header = JSON.parse(headerBuf.toString('utf8')); } catch { throw Object.assign(new Error('The backup file is damaged'), { code: 'BACKUP_FORMAT' }); }
    if (header.format !== FORMAT || header.v !== FORMAT_VERSION) {
        throw Object.assign(new Error('This backup was made by a newer version of Oruinwan'), { code: 'BACKUP_VERSION' });
    }
    return { header, headerBuf, bodyStart: start + len };
}

/** Decrypt a backup for `userId`. Throws BACKUP_OWNER when the file belongs to another account. */
function unpackBackup(buf, { userId } = {}) {
    const { header, headerBuf, bodyStart } = readHeader(buf);
    if (String(header.userId) !== String(userId)) {
        throw Object.assign(new Error('This backup belongs to a different Oruinwan account'), { code: 'BACKUP_OWNER' });
    }
    try {
        const w = header.wrappedKey || {};
        const unwrap = crypto.createDecipheriv('aes-256-gcm', accountKey(userId, header.kekVersion), Buffer.from(w.iv, 'base64'));
        unwrap.setAAD(Buffer.from(`wrap:${userId}`));
        unwrap.setAuthTag(Buffer.from(w.tag, 'base64'));
        const backupKey = Buffer.concat([unwrap.update(Buffer.from(w.key, 'base64')), unwrap.final()]);

        const iv = buf.subarray(bodyStart, bodyStart + 12);
        const tag = buf.subarray(bodyStart + 12, bodyStart + 28);
        const decipher = crypto.createDecipheriv('aes-256-gcm', backupKey, iv);
        decipher.setAAD(headerBuf);
        decipher.setAuthTag(tag);
        const gz = Buffer.concat([decipher.update(buf.subarray(bodyStart + 28)), decipher.final()]);
        return { header, bundle: JSON.parse(zlib.gunzipSync(gz).toString('utf8')) };
    } catch (err) {
        if (err.code === 'BACKUP_OWNER') throw err;
        throw Object.assign(new Error('The backup could not be decrypted (damaged, or made by another server)'), { code: 'BACKUP_DECRYPT' });
    }
}

module.exports = { sealSecret, openSecret, packBackup, unpackBackup, readHeader, MAGIC, FORMAT, FORMAT_VERSION };
