const express = require('express');
const router = express.Router();
const tasksController = require('./tasks.controller');
const requireAuth = require('../../shared/middleware/auth');

router.use(requireAuth);

router.get('/workload', tasksController.getWorkload);

router.get('/', tasksController.getTasks);

router.get('/my', tasksController.getMyTasks);

router.post('/', tasksController.createTask);

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

router.post('/:id/subtasks', tasksController.createSubtask);

router.post('/:id/links', tasksController.addLink);

router.delete('/:id/links/:linkId', tasksController.removeLink);

router.post('/:id/watchers', tasksController.addWatcher);

router.delete('/:id/watchers', tasksController.removeWatcher);

router.post('/:id/dependency', tasksController.addDependency);

router.post('/:id/time/start', tasksController.startTimer);

router.post('/:id/time/stop', tasksController.stopTimer);

module.exports = router;
