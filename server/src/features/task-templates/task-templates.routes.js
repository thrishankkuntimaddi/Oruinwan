const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const service = require('./task-templates.service');

router.use(requireAuth);

function handleError(res, err) {
    const status = err.statusCode || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);
    const body = { message: status >= 500 ? 'Internal server error' : err.message };
    if (err.errors && Array.isArray(err.errors)) body.errors = err.errors;
    return res.status(status).json(body);
}

router.get('/', async (req, res) => {
    try {
        return res.json(await service.getTemplates(req.user.sub, req.query.workspaceId));
    } catch (err) { return handleError(res, err); }
});

router.post('/', async (req, res) => {
    try {
        return res.status(201).json(await service.createTemplate(req.user.sub, req.body));
    } catch (err) { return handleError(res, err); }
});

// Create a task (plus its checklist subtasks) from the template.
router.post('/:id/apply', async (req, res) => {
    try {
        return res.status(201).json(await service.applyTemplate(req.user.sub, req.params.id, req.body || {}, req.io, req));
    } catch (err) { return handleError(res, err); }
});

router.put('/:id', async (req, res) => {
    try {
        return res.json(await service.updateTemplate(req.user.sub, req.params.id, req.body));
    } catch (err) { return handleError(res, err); }
});

router.delete('/:id', async (req, res) => {
    try {
        return res.json(await service.deleteTemplate(req.user.sub, req.params.id));
    } catch (err) { return handleError(res, err); }
});

module.exports = router;
