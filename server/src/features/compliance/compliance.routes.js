// server/src/features/compliance/compliance.routes.js
'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./compliance.controller');
const requireAuth = require('../../shared/middleware/auth');
const { requireAdmin } = require('../../shared/middleware/permissionMiddleware');

// GET /api/compliance-logs — paginated list (admin only)
router.get('/', requireAuth, requireAdmin, ctrl.getComplianceLogs);

// GET /api/compliance-logs/:id — single log with hash verification
router.get('/:id', requireAuth, requireAdmin, ctrl.getComplianceLog);

module.exports = router;
