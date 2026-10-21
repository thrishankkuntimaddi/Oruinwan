const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const service = require('./milestones.service');
const logger = require('../../../utils/logger');

router.use(requireAuth);

function handleError(res, err) {
    const status = err.statusCode || 500;
    if (status >= 500) logger.error('[milestones]', err);
    const body = { message: status >= 500 ? 'Internal server error' : err.message };
    if (err.errors) body.errors = err.errors;
    return res.status(status).json(body);
}

/** Tell workspace members a milestone changed (list views refresh). */
function emit(req, workspaceId, payload) {
    if (req.io && workspaceId) req.io.to(`workspace:${workspaceId}`).emit('milestone:updated', payload);
}

const wsOf = (m) => String(m?.workspace?._id || m?.workspace || '');

router.get('/', async (req, res) => {
    try {
        return res.json(await service.getMilestones(req.user.sub, req.query.workspaceId));
    } catch (err) { return handleError(res, err); }
});

router.post('/', async (req, res) => {
    try {
        const out = await service.createMilestone(req.user.sub, req.body || {});
        emit(req, wsOf(out.milestone), { action: 'created', milestoneId: String(out.milestone._id) });
        return res.status(201).json(out);
    } catch (err) { return handleError(res, err); }
});

router.get('/:id', async (req, res) => {
    try {
        return res.json(await service.getMilestone(req.user.sub, req.params.id));
    } catch (err) { return handleError(res, err); }
});

router.get('/:id/progress', async (req, res) => {
    try {
        return res.json(await service.getProgress(req.user.sub, req.params.id));
    } catch (err) { return handleError(res, err); }
});

router.put('/:id', async (req, res) => {
    try {
        const out = await service.updateMilestone(req.user.sub, req.params.id, req.body || {});
        emit(req, wsOf(out.milestone), { action: 'updated', milestoneId: req.params.id });
        return res.json(out);
    } catch (err) { return handleError(res, err); }
});

router.patch('/:id', async (req, res) => {
    try {
        const out = await service.updateMilestone(req.user.sub, req.params.id, req.body || {});
        emit(req, wsOf(out.milestone), { action: 'updated', milestoneId: req.params.id });
        return res.json(out);
    } catch (err) { return handleError(res, err); }
});

router.delete('/:id', async (req, res) => {
    try {
        return res.json(await service.deleteMilestone(req.user.sub, req.params.id));
    } catch (err) { return handleError(res, err); }
});

// Body: { taskIds: string[] }
router.post('/:id/tasks', async (req, res) => {
    try {
        return res.json(await service.linkTasks(req.user.sub, req.params.id, req.body?.taskIds));
    } catch (err) { return handleError(res, err); }
});

router.delete('/:id/tasks/:taskId', async (req, res) => {
    try {
        return res.json(await service.unlinkTask(req.user.sub, req.params.id, req.params.taskId));
    } catch (err) { return handleError(res, err); }
});

module.exports = router;
