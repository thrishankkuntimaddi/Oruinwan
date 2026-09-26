'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./compliance.controller');
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyAdmin = require('../../shared/middleware/requireCompanyAdmin');

router.get('/', requireAuth, requireCompanyAdmin, ctrl.getComplianceLogs);

router.get('/:id', requireAuth, requireCompanyAdmin, ctrl.getComplianceLog);

module.exports = router;
