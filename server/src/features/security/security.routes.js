// server/src/features/security/security.routes.js

const express = require('express');
const router = express.Router();
const requireAuth = require('../../../middleware/auth');
const { getAuditLog } = require('./security.controller');

// Get security audit log for current user (read-only)
router.get('/audit', requireAuth, getAuditLog);

module.exports = router;
