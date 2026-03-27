// server/src/features/security/backup.routes.js
// Admin-only route for creating encrypted data backups.

'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const { requireCompanyRole } = require('../../shared/utils/companyRole');
const { createBackup } = require('./backup.service');

// POST /api/security/backup — admin only
router.post('/backup', requireAuth, async (req, res) => {
  try {
    const { companyId } = req.body;
    const backup = await createBackup({ requesterId: req.user.sub, companyId });
    return res.status(201).json({
      message: 'Encrypted backup created successfully',
      meta: {
        createdAt: backup.createdAt,
        createdBy: backup.createdBy,
        companyId: backup.companyId,
        recordCount: backup.recordCount,
        algorithm: backup.algorithm,
      },
      // Return encrypted payload so admin can store it externally
      encryptedPayload: backup.encryptedPayload,
    });
  } catch (err) {
    console.error('[Backup] create error:', err);
    return res.status(500).json({ message: 'Failed to create backup' });
  }
});

// Dev-only: trigger retention cleanup manually (for testing)
if (process.env.NODE_ENV !== 'production') {
  router.post('/trigger-retention', requireAuth, async (req, res) => {
    try {
      const { runRetentionCleanup } = require('./retention.cron');
      const result = await runRetentionCleanup();
      return res.json({ message: 'Retention cleanup completed', result });
    } catch (err) {
      return res.status(500).json({ message: 'Retention cleanup failed', error: err.message });
    }
  });
}

module.exports = router;
