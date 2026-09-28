'use strict';
const logger = require('../../../utils/logger');

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyAdmin = require('../../shared/middleware/requireCompanyAdmin');
const { scopedCompanyId } = requireCompanyAdmin;
const { createBackup } = require('./backup.service');

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
      },
      
      encryptedPayload: backup.encryptedPayload,
    });
  } catch (err) {
    logger.error('[Backup] create error:', err);
    return res.status(500).json({ message: 'Failed to create backup' });
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
