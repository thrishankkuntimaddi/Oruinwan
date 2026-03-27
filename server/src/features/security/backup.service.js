// server/src/features/security/backup.service.js
// Encrypted backup service using AES-256-GCM.
// Creates an encrypted JSON snapshot of critical data for disaster recovery.

'use strict';

const crypto = require('crypto');
const User = require('../../../models/User');
const AuditLog = require('../../../models/AuditLog');

// Use SERVER_KEK as the backup encryption key (same as E2EE workspace key encryption)
const BACKUP_KEY = Buffer.from(process.env.SERVER_KEK || '', 'hex');

/**
 * Encrypt a JSON-serializable payload using AES-256-GCM.
 * Returns a base64-encoded string: iv:tag:ciphertext
 */
function encryptPayload(payload) {
  const plaintext = JSON.stringify(payload);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', BACKUP_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(
    `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('base64')}`
  ).toString('base64');
}

/**
 * Decrypt an encrypted backup string.
 */
function decryptPayload(encryptedBase64) {
  const raw = Buffer.from(encryptedBase64, 'base64').toString('utf8');
  const [ivHex, tagHex, encBase64] = raw.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', BACKUP_KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encBase64, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

/**
 * Create an encrypted data backup for a workspace or company.
 * @param {object} options
 * @param {string} options.requesterId - Admin user ID requesting the backup
 * @param {string} [options.companyId] - Limit backup to a specific company
 * @returns {object} backup metadata + encrypted payload
 */
async function createBackup({ requesterId, companyId }) {
  const filter = companyId ? { companyId } : {};

  const [users, auditLogs] = await Promise.all([
    User.find(filter)
      .select('-passwordHash -twoFactorSecret -refreshTokens -verificationTokenHash -resetPasswordTokenHash')
      .lean(),
    AuditLog.find(companyId ? { companyId } : {})
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean(),
  ]);

  const backupPayload = {
    backedUpAt: new Date().toISOString(),
    companyId: companyId || null,
    users,
    auditLogs,
  };

  const encrypted = encryptPayload(backupPayload);

  const meta = {
    createdAt: new Date().toISOString(),
    createdBy: requesterId,
    companyId: companyId || null,
    recordCount: { users: users.length, auditLogs: auditLogs.length },
    algorithm: 'AES-256-GCM',
    encryptedPayload: encrypted,
  };

  // Audit the backup creation
  await AuditLog.create({
    userId: requesterId,
    action: 'security.backup_created',
    resource: 'Backup',
    description: `Encrypted backup created — ${users.length} users, ${auditLogs.length} audit logs`,
    ipAddress: 'system',
    category: 'security',
    severity: 'info',
  });

  return meta;
}

module.exports = { createBackup, encryptPayload, decryptPayload };
