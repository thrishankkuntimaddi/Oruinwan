// server/src/features/task-templates/task-templates.routes.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const service = require('./task-templates.service');

router.use(requireAuth);

function handleError(res, err) {
    return res.status(err.statusCode || 500).json({ message: err.message || 'Internal server error' });
}

// GET /api/task-templates?workspaceId=...
router.get('/', async (req, res) => {
    try {
        return res.json(await service.getTemplates(req.user.sub, req.query.workspaceId));
    } catch (err) { return handleError(res, err); }
});

// POST /api/task-templates
router.post('/', async (req, res) => {
    try {
        return res.status(201).json(await service.createTemplate(req.user.sub, req.body));
    } catch (err) { return handleError(res, err); }
});

// PUT /api/task-templates/:id
router.put('/:id', async (req, res) => {
    try {
        return res.json(await service.updateTemplate(req.user.sub, req.params.id, req.body));
    } catch (err) { return handleError(res, err); }
});

// DELETE /api/task-templates/:id
router.delete('/:id', async (req, res) => {
    try {
        return res.json(await service.deleteTemplate(req.user.sub, req.params.id));
    } catch (err) { return handleError(res, err); }
});

module.exports = router;
