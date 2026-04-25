'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const {
  exportUser,
  deleteUser,
  exportWorkspace,
  getLegalHold,
  setLegalHold,
  getAuditLogs,
  getRetentionPolicy,
  setRetentionPolicy,
} = require('./gdpr.controller');

router.use(requireAuth);

router.get('/export-user', exportUser);         
router.delete('/delete-user', deleteUser);       

router.get('/export', exportWorkspace);

router.get('/audit-logs', getAuditLogs);

router.get('/legal-hold/:userId', getLegalHold);
router.patch('/legal-hold/:userId', setLegalHold);

router.get('/retention-policy', getRetentionPolicy);
router.patch('/retention-policy', setRetentionPolicy);

module.exports = router;
