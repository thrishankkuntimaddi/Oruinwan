const express = require('express');
const router = express.Router({ mergeParams: true });
const ctrl = require('./org-chart.controller');
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const requireCompanyAdmin = require('../../shared/middleware/requireCompanyAdmin');

router.get('/:id/org-chart', requireAuth, requireCompanyMember, ctrl.getOrgChart);

router.get('/:id/employees', requireAuth, requireCompanyMember, ctrl.getEmployeeDirectory);

router.put('/:id/employees/:userId/manager', requireAuth, requireCompanyAdmin, ctrl.setManager);

module.exports = router;
