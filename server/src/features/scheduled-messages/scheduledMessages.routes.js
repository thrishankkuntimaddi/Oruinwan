'use strict';

// Routes for scheduled messages and the Sent list (see scheduledMessages.service.js).

const express = require('express');
const requireAuth = require('../../shared/middleware/auth');
const logger = require('../../../utils/logger');
const service = require('./scheduledMessages.service');

const router = express.Router();
router.use(requireAuth);

const handle = (label, fn) => async (req, res) => {
    try {
        res.json(await fn(req));
    } catch (err) {
        if (!err.statusCode) logger.error(`[scheduled-messages] ${label}:`, err);
        res.status(err.statusCode || 500).json({ message: err.statusCode ? err.message : 'Server error', ...(err.code ? { code: err.code } : {}) });
    }
};

router.get('/sent', handle('sent', async (req) => ({ messages: await service.sent(req.user.sub, req.query.workspaceId, req.query.limit) })));
router.get('/', handle('list', async (req) => ({ scheduled: await service.list(req.user.sub, req.query.workspaceId), max: service.MAX_PENDING })));
router.post('/', handle('create', async (req) => ({ scheduled: await service.create(req.user.sub, req.body) })));
router.patch('/:id', handle('reschedule', async (req) => ({ scheduled: await service.reschedule(req.user.sub, req.params.id, req.body) })));
router.delete('/:id', handle('cancel', async (req) => service.cancel(req.user.sub, req.params.id)));
router.post('/:id/send-now', handle('send-now', async (req) => service.sendNow(req.user.sub, req.params.id, req.app.get('io'))));

module.exports = router;
