// server/src/features/security/gdpr.routes.js
// Compliance & GDPR routes

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

// All routes require authentication
router.use(requireAuth);

// GDPR — Personal data rights
router.get('/export-user', exportUser);         // Download personal data (Art. 20)
router.delete('/delete-user', deleteUser);       // Right to be forgotten (Art. 17)

// Workspace export (admin use)
router.get('/export', exportWorkspace);

// Audit logs (personal view)
router.get('/audit-logs', getAuditLogs);

// Legal hold management
router.get('/legal-hold/:userId', getLegalHold);
router.patch('/legal-hold/:userId', setLegalHold);

// Retention policy
router.get('/retention-policy', getRetentionPolicy);
router.patch('/retention-policy', setRetentionPolicy);

module.exports = router;
