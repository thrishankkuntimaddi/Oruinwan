const express = require('express');
const router = express.Router({ mergeParams: true });
const ctrl = require('./org-chart.controller');
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');

router.get('/:id/org-chart', requireAuth, requireCompanyMember, ctrl.getOrgChart);

router.get('/:id/employees', requireAuth, requireCompanyMember, ctrl.getEmployeeDirectory);

module.exports = router;
