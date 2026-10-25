'use strict';

// GET /api/v2/conversation-prefs/:workspaceId → { prefs: [{ kind, id, pinnedAt, archivedAt }], maxPins }
// PUT /api/v2/conversation-prefs { workspaceId, kind, id, pinned?, archived? } → { pref }

const express = require('express');
const requireAuth = require('../../shared/middleware/auth');
const logger = require('../../../utils/logger');
const service = require('./conversationPrefs.service');

const router = express.Router();
router.use(requireAuth);

const sendError = (res, err, label) => {
    if (!err.statusCode) logger.error(`[conversation-prefs] ${label}:`, err);
    res.status(err.statusCode || 500).json({ message: err.statusCode ? err.message : 'Server error', ...(err.code ? { code: err.code } : {}) });
};

router.get('/:workspaceId', async (req, res) => {
    try {
        res.json({ prefs: await service.listPrefs(req.user.sub, req.params.workspaceId), maxPins: service.MAX_PINS });
    } catch (err) {
        sendError(res, err, 'list');
    }
});

router.put('/', async (req, res) => {
    try {
        res.json({ pref: await service.setPref(req.user.sub, req.body) });
    } catch (err) {
        sendError(res, err, 'set');
    }
});

module.exports = router;
