// server/src/modules/messages/messages.routes.js
/**
 * Messages Routes
 * All message-related API endpoints
 * 
 * @module messages/routes
 */

const express = require('express');
const router = express.Router();
const messagesController = require('./messages.controller');
const requireAuth = require('../../../middleware/auth');

// Apply authentication to all routes
router.use(requireAuth);

// ==================== DIRECT MESSAGES ====================

// Send direct message
router.post('/direct', messagesController.sendDirectMessage);

// Get DM conversation
router.get(
    '/workspace/:workspaceId/dm/:dmId',
    (req, res, next) => {
        console.log('🔍 [ROUTE MATCHED] DM conversation route hit!', {
            params: req.params,
            query: req.query,
            path: req.path,
            originalUrl: req.originalUrl
        });
        next();
    },
    messagesController.getDMs
);

// Get all DM sessions in workspace
router.get(
    '/workspace/:workspaceId/dms',
    messagesController.getWorkspaceDMList
);

// ==================== CHANNEL MESSAGES ====================

// Send channel message
router.post('/channel', messagesController.sendChannelMessage);

// Get channel messages
router.get('/channel/:channelId', messagesController.getChannelMessages);

module.exports = router;
