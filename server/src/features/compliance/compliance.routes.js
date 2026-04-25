'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./compliance.controller');
const requireAuth = require('../../shared/middleware/auth');
const { requireAdmin } = require('../../shared/middleware/permissionMiddleware');

router.get('/', requireAuth, requireAdmin, ctrl.getComplianceLogs);

router.get('/:id', requireAuth, requireAdmin, ctrl.getComplianceLog);

module.exports = router;
