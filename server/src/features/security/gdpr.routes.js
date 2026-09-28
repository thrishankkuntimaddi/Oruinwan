'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const {
  exportUser,
  deleteUser,
  exportWorkspace,
  getLegalHold,
  getMyLegalHold,
  setLegalHold,
  getAuditLogs,
  getRetentionPolicy,
  setRetentionPolicy,
} = require('./gdpr.controller');

router.use(requireAuth);

router.get('/export-user', exportUser);         
router.delete('/delete-user', deleteUser);       

// Workspace export: workspace owners/admins only (checked in the controller).
router.get('/export', exportWorkspace);

router.get('/audit-logs', getAuditLogs);

// Own status for anyone; other users and PATCH only for an admin who manages them.
router.get('/legal-hold/me', getMyLegalHold);
router.get('/legal-hold/:userId', getLegalHold);
router.patch('/legal-hold/:userId', setLegalHold);

router.get('/retention-policy', getRetentionPolicy);
router.patch('/retention-policy', setRetentionPolicy);

module.exports = router;
