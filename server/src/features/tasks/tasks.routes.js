const express = require('express');
const { requireCompanyPermission } = require('../../shared/companyPermissions');
const { requireWorkspaceFeature, resolvers } = require('../../shared/workspaceFeatures');
const router = express.Router();
const tasksController = require('./tasks.controller');
const requireAuth = require('../../shared/middleware/auth');

router.use(requireAuth);

router.get('/workload', tasksController.getWorkload);

// Tracked time per user across the caller's visible tasks (?workspaceId&from&to).
router.get('/time/report', tasksController.getTimeReport);

router.get('/', tasksController.getTasks);

router.get('/my', tasksController.getMyTasks);

// Malformed task ids are "not found", never a 500.
router.param('id', (req, res, next, id) => {
    if (!/^[a-f\d]{24}$/i.test(id)) return res.status(404).json({ message: 'Task not found' });
    return next();
});

router.get('/:id', tasksController.getTask);

router.post('/', requireWorkspaceFeature('tasks'), requireCompanyPermission('createTasks'), require('../../shared/plans/planGuards').taskCreate, tasksController.createTask);

router.get('/:id/activity', tasksController.getTaskActivity);

router.put('/:id', tasksController.updateTask);

router.delete('/:id', tasksController.deleteTask);

router.post('/:id/restore', tasksController.restoreTask);

router.delete('/:id/permanent', tasksController.permanentDeleteTask);

router.post('/:id/revoke', tasksController.revokeTask);

router.post('/:id/transfer/request', tasksController.requestTransfer);

router.post('/:id/transfer-request', tasksController.requestTransfer);

router.post('/:id/transfer/:action', tasksController.handleTransferRequest);

router.post('/:id/transfer-request/:action', tasksController.handleTransferRequest);

router.post('/:id/subtasks', require('../../shared/plans/planGuards').subtaskCreate, tasksController.createSubtask);

router.post('/:id/links', tasksController.addLink);

router.delete('/:id/links/:linkId', tasksController.removeLink);

router.post('/:id/watchers', tasksController.addWatcher);

router.delete('/:id/watchers', tasksController.removeWatcher);

router.post('/:id/dependency', tasksController.addDependency);

router.delete('/:id/dependency/:dependencyId', tasksController.removeDependency);

router.get('/:id/blockers', tasksController.getBlockers);

router.post('/:id/time/start', tasksController.startTimer);

router.post('/:id/time/stop', tasksController.stopTimer);

router.post('/:id/time/log', tasksController.logTime);

router.get('/:id/time', tasksController.getTaskTime);

module.exports = router;
