'use strict';

/** Shape checks for what clients send. The server can't read envelopes, only bound them. */

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const HEX_ID = /^[0-9a-f]{16,64}$/;

const MAX_KEYS = 40;             // devices a message is wrapped for (2 people × up to 20)
const MAX_CT_B64 = 64 * 1024;    // ~48 KB of text: private chats carry text only
const MAX_DEVICES_PER_USER = 10;

const isB64 = (v, min, max) => typeof v === 'string' && v.length >= min && v.length <= max && B64.test(v);
const isSpki = (v) => isB64(v, 80, 200); // P-256 SPKI is 91 bytes → 124 chars

function validDeviceKeys(body) {
    if (!body || !isSpki(body.ecdhKey) || !isSpki(body.signKey)) return 'ecdhKey and signKey must be base64 P-256 public keys';
    return null;
}

/** Returns an error string, or null when the envelope looks like a v1 private message. */
function validEnvelope(e, { userId, deviceIds }) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return 'envelope is required';
    if (e.v !== 1) return 'unknown envelope version';
    if (!e.sender || String(e.sender.userId) !== String(userId)) return 'envelope sender must be you';
    if (!deviceIds.includes(String(e.sender.deviceId))) return 'send from a registered device';
    if (!isSpki(e.eph)) return 'bad ephemeral key';
    if (!isB64(e.salt, 20, 32) || !isB64(e.iv, 12, 24) || !isB64(e.sig, 40, 200)) return 'bad envelope fields';
    if (!isB64(e.ct, 16, MAX_CT_B64)) return 'message is empty or too long';
    if (!Array.isArray(e.keys) || !e.keys.length || e.keys.length > MAX_KEYS) return 'bad recipient list';
    for (const k of e.keys) {
        if (!k || !HEX_ID.test(String(k.d)) || !isB64(k.iv, 12, 24) || !isB64(k.k, 40, 80)) return 'bad recipient entry';
    }
    const allowed = new Set(['v', 'sender', 'eph', 'salt', 'iv', 'ct', 'keys', 'sig']);
    if (Object.keys(e).some((k) => !allowed.has(k))) return 'unexpected envelope field';
    return null;
}

/** A copy holding only the known fields (nothing else gets stored). */
const cleanEnvelope = (e) => ({
    v: 1,
    sender: { userId: String(e.sender.userId), deviceId: String(e.sender.deviceId) },
    eph: e.eph, salt: e.salt, iv: e.iv, ct: e.ct, sig: e.sig,
    keys: e.keys.map((k) => ({ d: String(k.d), iv: k.iv, k: k.k })),
});

module.exports = { validDeviceKeys, validEnvelope, cleanEnvelope, HEX_ID, MAX_DEVICES_PER_USER };
