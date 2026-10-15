'use strict';

/**
 * Server-side handling of the UMEK (the key that encrypts a user's identity private key).
 *
 * PASSWORD accounts: the UMEK is derived from the password on the device. The server never
 * needs it and stores only the PASSWORD_DERIVED marker.
 *
 * SERVER_KEK accounts (OAuth sign-in, no password): the device sends the UMEK once at setup and
 * the server stores it sealed under the active KEK as iv(12) | tag(16) | ciphertext. On a new
 * device the server opens it and hands it back wrapped for that device's ephemeral P-256 key.
 * A database dump alone no longer reveals any UMEK; the server (with the KEK) still can.
 */

const crypto = require('crypto');
const logger = require('../../../utils/logger');
const kekManager = require('../../services/kekManager.service');

const PASSWORD_DERIVED = 'password-derived';
const UMEK_BYTES = 32;
const SEALED_BYTES = 12 + 16 + UMEK_BYTES;

// Must match _unwrapUMEKFromServer in client/src/services/identityKeyService.js.
const CLIENT_WRAP_SALT = 'umek-wrap-v1';
const CLIENT_WRAP_ITERATIONS = 10000;

function decodeUmek(base64) {
    const bytes = Buffer.from(String(base64 || ''), 'base64');
    if (bytes.length !== UMEK_BYTES) throw new Error(`UMEK must be ${UMEK_BYTES} bytes`);
    return bytes;
}

/** Earlier web clients stored the UMEK itself (unsealed) as the envelope. */
function isUnsealedUmek(envelope) {
    return typeof envelope === 'string' && Buffer.from(envelope, 'base64').length === UMEK_BYTES;
}

function sealUmek(umekBytes) {
    const { version, key } = kekManager.getActiveKEK();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(umekBytes), cipher.final()]);
    const envelope = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
    return { envelope, kekVersion: version };
}

function openUmek(envelope, kekVersion) {
    const buf = Buffer.from(String(envelope || ''), 'base64');
    if (buf.length !== SEALED_BYTES) throw new Error('Not a sealed UMEK envelope');
    const decipher = crypto.createDecipheriv('aes-256-gcm', kekManager.getKEKForUnwrap(kekVersion || 1), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}

/** Wrap the UMEK for the device's ephemeral P-256 public key (raw, uncompressed, base64). */
function wrapForDevice(umekBytes, clientEphemeralPublicKey) {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    const sharedSecret = ecdh.computeSecret(Buffer.from(clientEphemeralPublicKey, 'base64'));
    const wrappingKey = crypto.pbkdf2Sync(sharedSecret, CLIENT_WRAP_SALT, CLIENT_WRAP_ITERATIONS, 32, 'sha256');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', wrappingKey, iv);
    const encrypted = Buffer.concat([cipher.update(umekBytes), cipher.final()]);
    return {
        serverEphemeralPublicKey: ecdh.getPublicKey().toString('base64'),
        rewrappedUmek: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64'),
    };
}

/**
 * Boot-time cleanup for rows written before envelopes were sealed: PASSWORD rows get the
 * marker, unsealed SERVER_KEK rows are sealed under the active KEK. Safe to run every boot.
 */
async function sealStoredUmeks({ query = require('../../shared/postgres').query } = {}) {
    const scrubbed = await query(
        `UPDATE user_crypto_state SET umek_envelope = $1, umek_envelope_iv = NULL, updated_at = now()
         WHERE umek_protection_type = 'PASSWORD' AND umek_envelope IS DISTINCT FROM $1 AND umek_envelope IS NOT NULL`,
        [PASSWORD_DERIVED]
    );
    const { rows } = await query(
        `SELECT user_id, umek_envelope FROM user_crypto_state
         WHERE umek_protection_type = 'SERVER_KEK' AND length(umek_envelope) = 44`
    );
    let sealed = 0;
    for (const row of rows) {
        if (!isUnsealedUmek(row.umek_envelope)) continue;
        const { envelope, kekVersion } = sealUmek(Buffer.from(row.umek_envelope, 'base64'));
        await query(
            `UPDATE user_crypto_state SET umek_envelope = $2, kek_version = $3, updated_at = now()
             WHERE user_id = $1 AND umek_envelope = $4`,
            [row.user_id, envelope, kekVersion, row.umek_envelope]
        );
        sealed += 1;
    }
    if (scrubbed.rowCount || sealed) {
        logger.info(`🔐 [CRYPTO] Removed ${scrubbed.rowCount || 0} stored password-derived UMEK(s), sealed ${sealed} SERVER_KEK UMEK(s)`);
    }
    return { scrubbed: scrubbed.rowCount || 0, sealed };
}

module.exports = { PASSWORD_DERIVED, decodeUmek, isUnsealedUmek, sealUmek, openUmek, wrapForDevice, sealStoredUmeks };
