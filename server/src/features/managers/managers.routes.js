const express = require('express');
const router = express.Router();
const managerController = require('./managers.controller');
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

// Managers and above in the caller's own company (co-owners count as owners).
router.use(requireAuth, requireCompanyMember, requireCompanyRole('manager'));

router.get('/scope', managerController.getManagerScope);
router.get('/metrics', managerController.getManagerMetrics);
router.get('/tasks', managerController.getManagerTasks);
router.post('/tasks', managerController.createTask);
router.get('/activity', managerController.getActivitySummary);

router.get('/allocations', managerController.getAllocations);
router.post('/allocations/update', managerController.updateWorkspaceAllocation);
router.post('/allocations/department/add', managerController.addMemberToDepartment);

module.exports = router;
