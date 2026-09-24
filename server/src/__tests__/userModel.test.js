'use strict';

const User = require('../../models/User');

describe('User model serialization', () => {
  const build = () => new User({
    username: 'alice',
    email: 'alice@example.com',
    passwordHash: 'bcrypt-hash',
    inviteToken: 'invite-hash',
    resetPasswordTokenHash: 'reset-hash',
    verificationTokenHash: 'verify-hash',
    twoFactorSecret: 'totp-secret',
    refreshTokens: [{ tokenHash: 'rt-hash', expiresAt: new Date(Date.now() + 1000) }],
    otpCodes: [{ code: '123456', type: 'reactivation', expiresAt: new Date(Date.now() + 1000) }],
    deviceTokens: [{ token: 'fcm-token', platform: 'ios' }],
    encryption: { publicKey: 'pub', encryptedPrivateKey: 'enc-priv' },
    emails: [{ email: 'alice@example.com', verificationTokenHash: 'email-verify-hash' }],
  });

  test('toJSON strips every sensitive field', () => {
    const json = build().toJSON();
    for (const field of ['passwordHash', 'refreshTokens', 'twoFactorSecret', 'otpCodes', 'inviteToken',
      'resetPasswordTokenHash', 'verificationTokenHash', 'deviceTokens']) {
      expect(json).not.toHaveProperty(field);
    }
    expect(json.encryption).not.toHaveProperty('encryptedPrivateKey');
    expect(json.encryption.publicKey).toBe('pub');
    expect(json.emails[0]).not.toHaveProperty('verificationTokenHash');
    expect(json.emails[0].email).toBe('alice@example.com');
    expect(json.username).toBe('alice');
  });

  test('JSON.stringify (what res.json uses) never contains secrets', () => {
    const str = JSON.stringify(build());
    for (const secret of ['bcrypt-hash', 'invite-hash', 'reset-hash', 'verify-hash', 'totp-secret',
      'rt-hash', '123456', 'fcm-token', 'enc-priv', 'email-verify-hash']) {
      expect(str).not.toContain(secret);
    }
  });

  test('documents keep secrets in memory for server-side code paths', () => {
    const doc = build();
    expect(doc.passwordHash).toBe('bcrypt-hash');
    expect(doc.refreshTokens).toHaveLength(1);
  });

  test('rarely-needed secrets are select:false by default', () => {
    for (const field of ['twoFactorSecret', 'otpCodes', 'inviteToken', 'resetPasswordTokenHash',
      'verificationTokenHash', 'deviceTokens']) {
      expect(User.schema.path(field).options.select).toBe(false);
    }
  });

  test('schema declares profilePictureGcsPath', () => {
    expect(User.schema.path('profilePictureGcsPath')).toBeDefined();
  });
});
