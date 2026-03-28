const express = require('express');
const router = express.Router();
const managerController = require('./managers.controller');
const requireAuth = require('../../shared/middleware/auth');

// Middleware to ensure user is essentially a manager
// (We could add stricter middleware here if needed, but the controller filters by user ID anyway)

router.get('/scope', requireAuth, managerController.getManagerScope);
router.get('/metrics', requireAuth, managerController.getManagerMetrics);
router.get('/tasks', requireAuth, managerController.getManagerTasks);
router.post('/tasks', requireAuth, managerController.createTask);
router.get('/activity', requireAuth, managerController.getActivitySummary);

// Team Allocation Routes
router.get('/allocations', requireAuth, managerController.getAllocations);
router.post('/allocations/update', requireAuth, managerController.updateWorkspaceAllocation);
router.post('/allocations/department/add', requireAuth, managerController.addMemberToDepartment);

module.exports = router;
