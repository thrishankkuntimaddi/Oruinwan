// server/src/features/milestones/milestones.routes.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../../../middleware/auth');
const service = require('./milestones.service');

router.use(requireAuth);

function handleError(res, err) {
    return res.status(err.statusCode || 500).json({ message: err.message || 'Internal server error' });
}

// GET /api/milestones?workspaceId=...
router.get('/', async (req, res) => {
    try {
        return res.json(await service.getMilestones(req.user.sub, req.query.workspaceId));
    } catch (err) { return handleError(res, err); }
});

// POST /api/milestones
router.post('/', async (req, res) => {
    try {
        return res.status(201).json(await service.createMilestone(req.user.sub, req.body));
    } catch (err) { return handleError(res, err); }
});

// PUT /api/milestones/:id
router.put('/:id', async (req, res) => {
    try {
        return res.json(await service.updateMilestone(req.user.sub, req.params.id, req.body));
    } catch (err) { return handleError(res, err); }
});

// DELETE /api/milestones/:id
router.delete('/:id', async (req, res) => {
    try {
        return res.json(await service.deleteMilestone(req.user.sub, req.params.id));
    } catch (err) { return handleError(res, err); }
});

module.exports = router;
