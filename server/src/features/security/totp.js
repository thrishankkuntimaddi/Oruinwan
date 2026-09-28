'use strict';

/**
 * TOTP (authenticator app) helpers shared by the 2FA routes and login:
 * secrets are stored AES-256-GCM encrypted with the server key.
 */
const crypto = require('crypto');
// otplib v13 has a functional API (the v12 `authenticator` export no longer exists).
const otplib = require('otplib');

// AES-256 needs 32 bytes. A 64-hex-char key is used as is; anything else is hashed to 32 bytes
// (previously a non-hex secret produced a short key and every 2FA call failed).
function deriveKey() {
  const raw = process.env.SERVER_KEK || (process.env.ACCESS_TOKEN_SECRET || '').slice(0, 64);
  const hex = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : null;
  return hex || crypto.createHash('sha256').update(String(process.env.SERVER_KEK || process.env.ACCESS_TOKEN_SECRET || '')).digest();
}
const ENCRYPT_KEY = deriveKey();

function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPT_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSecret(ciphertext) {
  const [ivHex, tagHex, encHex] = ciphertext.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPT_KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}

const OTP_TOLERANCE_SECONDS = 30; // accept the previous/next 30s step for clock drift

/** true when `otp` is a valid current TOTP code for `secret`. Never throws. */
async function verifyTotp(otp, secret) {
  const token = String(otp || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(token) || !secret) return false;
  try {
    const result = await otplib.verify({ secret, token, epochTolerance: OTP_TOLERANCE_SECONDS });
    return !!(result && result.valid);
  } catch {
    return false;
  }
}

/** true when `otp` is a valid code for this user's stored (encrypted) secret. Never throws. */
async function verifyUserTotp(encryptedSecret, otp) {
  if (!encryptedSecret) return false;
  let secret;
  try { secret = decryptSecret(encryptedSecret); } catch { return false; }
  return verifyTotp(otp, secret);
}

module.exports = { otplib, encryptSecret, decryptSecret, verifyTotp, verifyUserTotp };
