'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const service = require('./roadmap.service');
const logger = require('../../../utils/logger');

router.use(requireAuth);

function handleError(res, err) {
    const status = err.statusCode || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);
    if (status >= 500) logger.error('[roadmap]', err);
    const body = { message: status >= 500 ? 'Internal server error' : err.message };
    if (err.errors && Array.isArray(err.errors)) body.errors = err.errors;
    return res.status(status).json(body);
}

/** Workspace members' roadmap views refresh on this event. */
function emit(req, workspaceId, payload) {
    if (req.io && workspaceId) req.io.to(`workspace:${workspaceId}`).emit('roadmap:updated', { workspaceId: String(workspaceId), ...payload });
}

router.get('/meta', (req, res) => res.json({ statuses: service.ROADMAP_STATUSES, colors: service.ROADMAP_COLORS }));

router.get('/', async (req, res) => {
    try {
        const { workspaceId, quarter, status } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        return res.json(await service.listItems(req.user.sub, workspaceId, { quarter, status }));
    } catch (err) { return handleError(res, err); }
});

router.post('/', async (req, res) => {
    try {
        if (!req.body?.workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const out = await service.createItem(req.user.sub, req.body);
        emit(req, out.item.workspaceId, { action: 'created', itemId: String(out.item._id) });
        return res.status(201).json(out);
    } catch (err) { return handleError(res, err); }
});

router.post('/reorder', async (req, res) => {
    try {
        const out = await service.reorder(req.user.sub, req.body || {});
        emit(req, req.body.workspaceId, { action: 'reordered', order: out.order });
        return res.json(out);
    } catch (err) { return handleError(res, err); }
});

router.get('/:id', async (req, res) => {
    try {
        return res.json(await service.getItem(req.user.sub, req.params.id));
    } catch (err) { return handleError(res, err); }
});

router.patch('/:id', async (req, res) => {
    try {
        const out = await service.updateItem(req.user.sub, req.params.id, req.body || {});
        emit(req, out.item.workspaceId, { action: 'updated', itemId: req.params.id });
        return res.json(out);
    } catch (err) { return handleError(res, err); }
});

router.delete('/:id', async (req, res) => {
    try {
        const out = await service.deleteItem(req.user.sub, req.params.id);
        emit(req, out.workspaceId, { action: 'deleted', itemId: req.params.id });
        return res.json({ message: out.message });
    } catch (err) { return handleError(res, err); }
});

module.exports = router;
