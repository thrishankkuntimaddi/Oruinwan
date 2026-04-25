const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const service = require('./task-templates.service');

router.use(requireAuth);

function handleError(res, err) {
    return res.status(err.statusCode || 500).json({ message: err.message || 'Internal server error' });
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
