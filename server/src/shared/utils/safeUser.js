'use strict';

/**
 * Strip credentials, secrets and security-sensitive fields from a User document
 * before returning it to a client. Accepts a mongoose doc or a plain object.
 */
const SENSITIVE_FIELDS = [
  'passwordHash',
  'refreshTokens',
  'inviteToken',
  'inviteTokenExpiry',
  'verificationTokenHash',
  'verificationTokenExpires',
  'resetPasswordTokenHash',
  'resetPasswordExpires',
  'twoFactorSecret',
  'otpCodes',
  'deviceTokens',
  'devices',
  'failedLoginAttempts',
  'unverifiedLoginAttempts',
  'lastUnverifiedLoginAttempt',
  'lockUntil',
  '__v',
];

function toSafeUser(user) {
  if (!user) return user;
  const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  for (const f of SENSITIVE_FIELDS) delete obj[f];
  if (obj.encryption && typeof obj.encryption === 'object') {
    // Only the public key is safe to expose.
    obj.encryption = {
      publicKey: obj.encryption.publicKey,
      keyVersion: obj.encryption.keyVersion,
    };
  }
  return obj;
}

module.exports = { toSafeUser, SENSITIVE_FIELDS };
