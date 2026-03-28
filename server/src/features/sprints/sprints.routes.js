// server/src/features/sprints/sprints.routes.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const service = require('./sprints.service');

router.use(requireAuth);

function handleError(res, err) {
    return res.status(err.statusCode || 500).json({ message: err.message || 'Internal server error' });
}

// GET /api/sprints?workspaceId=...
router.get('/', async (req, res) => {
    try {
        return res.json(await service.getSprints(req.user.sub, req.query.workspaceId));
    } catch (err) { return handleError(res, err); }
});

// POST /api/sprints
router.post('/', async (req, res) => {
    try {
        return res.status(201).json(await service.createSprint(req.user.sub, req.body));
    } catch (err) { return handleError(res, err); }
});

// PUT /api/sprints/:id
router.put('/:id', async (req, res) => {
    try {
        return res.json(await service.updateSprint(req.user.sub, req.params.id, req.body));
    } catch (err) { return handleError(res, err); }
});

// DELETE /api/sprints/:id
router.delete('/:id', async (req, res) => {
    try {
        return res.json(await service.deleteSprint(req.user.sub, req.params.id));
    } catch (err) { return handleError(res, err); }
});

module.exports = router;
