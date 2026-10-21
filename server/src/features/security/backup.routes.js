'use strict';
const logger = require('../../../utils/logger');

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyAdmin = require('../../shared/middleware/requireCompanyAdmin');
const { scopedCompanyId } = requireCompanyAdmin;
const { createBackup, verifyBackup, restoreBackup, BackupError, COLLECTIONS } = require('./backup.service');

// Company admins back up their own company; only platform staff may choose
// another company or a whole-platform backup (no companyId).
router.post('/backup', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const companyId = scopedCompanyId(req, res, req.body && req.body.companyId);
    if (res.headersSent) return;
    if (!companyId && !req.isPlatformAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const backup = await createBackup({ requesterId: req.user.sub, companyId });
    return res.status(201).json({
      message: 'Encrypted backup created successfully',
      meta: {
        createdAt: backup.createdAt,
        createdBy: backup.createdBy,
        companyId: backup.companyId,
        recordCount: backup.recordCount,
        algorithm: backup.algorithm,
        format: backup.format,
        checksum: backup.checksum,
      },
      
      encryptedPayload: backup.encryptedPayload,
    });
  } catch (err) {
    if (err instanceof BackupError) return res.status(err.status).json({ message: err.message, code: err.code });
    logger.error('[Backup] create error:', err);
    return res.status(500).json({ message: 'Failed to create backup' });
  }
});

function backupScope(req) {
  return { companyId: req.companyId, isPlatformAdmin: !!req.isPlatformAdmin };
}

// Check a backup file without changing anything: decrypts it, checks the format and
// per-collection checksums, and reports counts.
router.post('/backup/verify', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const { encryptedPayload, checksum } = req.body || {};
    const payload = verifyBackup(encryptedPayload, { checksum });
    if (!req.isPlatformAdmin && String(payload.companyId || '') !== String(req.companyId || '')) {
      return res.status(403).json({ message: 'This backup belongs to another company', code: 'wrong_company' });
    }
    return res.json({
      valid: true,
      format: payload.format,
      backedUpAt: payload.backedUpAt,
      companyId: payload.companyId || null,
      recordCount: Object.fromEntries(COLLECTIONS.map((n) => [n, payload.workspaceData[n].length])),
    });
  } catch (err) {
    if (err instanceof BackupError) return res.status(err.status).json({ valid: false, message: err.message, code: err.code });
    logger.error('[Backup] verify error:', err);
    return res.status(500).json({ message: 'Failed to verify backup' });
  }
});

// Restore missing workspace metadata. Dry run unless { dryRun: false, confirm: "RESTORE" }.
router.post('/backup/restore', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const { encryptedPayload, checksum, collections } = req.body || {};
    const dryRun = req.body?.dryRun !== false;
    if (!dryRun && req.body?.confirm !== 'RESTORE') {
      return res.status(400).json({ message: 'A real restore needs confirm: "RESTORE"', code: 'confirmation_required' });
    }
    const result = await restoreBackup({
      requesterId: req.user.sub, encryptedPayload, checksum, collections, dryRun, scope: backupScope(req),
    });
    return res.json(result);
  } catch (err) {
    if (err instanceof BackupError) return res.status(err.status).json({ message: err.message, code: err.code });
    logger.error('[Backup] restore error:', err);
    return res.status(500).json({ message: 'Failed to restore backup' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  router.post('/trigger-retention', requireAuth, requireCompanyAdmin, async (req, res) => {
    try {
      if (!req.isPlatformAdmin) return res.status(403).json({ message: 'Platform admin only' });
      const { runRetentionCleanup } = require('./retention.cron');
      const result = await runRetentionCleanup();
      return res.json({ message: 'Retention cleanup completed', result });
    } catch (err) {
      return res.status(500).json({ message: 'Retention cleanup failed', error: err.message });
    }
  });
}

module.exports = router;
