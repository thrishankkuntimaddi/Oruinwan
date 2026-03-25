// server/src/features/company-org/org-chart.routes.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const ctrl = require('./org-chart.controller');
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');

// GET /api/companies/:id/org-chart — any company member can view
router.get('/org-chart', requireAuth, requireCompanyMember, ctrl.getOrgChart);

module.exports = router;
