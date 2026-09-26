'use strict';

const crypto = require('crypto');

/**
 * Short-lived signed URLs for stored files. <img>, <video> and <audio> cannot send an
 * Authorization header, so the client asks /sign (authenticated, access-checked) for a
 * URL that is valid for one file, one user and a few minutes.
 */

const DEFAULT_TTL_SECONDS = 10 * 60;

function secret() {
    const s = process.env.MEDIA_URL_SECRET || process.env.ACCESS_TOKEN_SECRET;
    if (!s) throw new Error('MEDIA_URL_SECRET or ACCESS_TOKEN_SECRET must be set');
    return s;
}

function mac(objectPath, userId, exp) {
    return crypto.createHmac('sha256', secret()).update(`${objectPath}|${userId}|${exp}`).digest('base64url');
}

function signMediaPath(objectPath, userId, { ttlSeconds = DEFAULT_TTL_SECONDS, now = Date.now() } = {}) {
    const exp = Math.floor(now / 1000) + ttlSeconds;
    const u = String(userId);
    const sig = mac(objectPath, u, exp);
    const url = `/api/v2/uploads/file?path=${encodeURIComponent(objectPath)}&u=${encodeURIComponent(u)}&exp=${exp}&sig=${sig}`;
    return { url, expiresAt: new Date(exp * 1000).toISOString() };
}

/** Returns the signing user's id when the signature is valid and unexpired, else null. */
function verifyMediaSignature({ path: objectPath, u, exp, sig }, now = Date.now()) {
    if (!objectPath || !u || !exp || !sig) return null;
    const expNum = Number(exp);
    if (!Number.isInteger(expNum) || expNum * 1000 < now) return null;
    const expected = Buffer.from(mac(String(objectPath), String(u), expNum));
    const given = Buffer.from(String(sig));
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
    return String(u);
}

module.exports = { signMediaPath, verifyMediaSignature, DEFAULT_TTL_SECONDS };
