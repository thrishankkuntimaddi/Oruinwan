// server/src/modules/messages/messages.routes.js
/**
 * Messages Routes — CANONICAL V2
 * All message-related API endpoints
 *
 * @module messages/routes
 */

const express = require('express');
const router = express.Router();
const messagesController = require('./messages.controller');
const threadsController = require('../threads/threads.controller');
const requireAuth = require('../../../middleware/auth');
const Message = require('../../features/messages/message.model');
const Channel = require('../../features/channels/channel.model');
const DMSession = require('../../../models/DMSession');
const mongoose = require('mongoose');

// Apply authentication to all routes
router.use(requireAuth);

// ==================== DIRECT MESSAGES ====================

// Send direct message
router.post('/direct', messagesController.sendDirectMessage);

// Resolve user ID → DM session ID (find or create, with E2EE key bootstrap)
// IMPORTANT: must be registered BEFORE the /workspace/:workspaceId/dm/:dmId route
// to prevent ":dmId" from greedily matching "resolve"
router.get(
    '/workspace/:workspaceId/dm/resolve/:userId',
    messagesController.resolveDMSession
);

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

// ==================== THREADS ====================

// Get all replies for a thread (parent message)
router.get('/thread/:messageId', threadsController.getThread);

// Post a reply into a thread
router.post('/thread/:messageId', threadsController.postThreadReply);

// Get reply count for a message
// IMPORTANT: must come before /:messageId catch-all if one exists
router.get('/:messageId/thread-count', threadsController.getThreadCount);

// ==================== MISSED MESSAGES ====================

// Offline recovery: returns messages created after lastSeenMessageId
// GET /api/v2/messages/missed?conversationId=<id>&type=channel|dm&lastSeenMessageId=<id>
router.get('/missed', async (req, res) => {
    try {
        const { conversationId, type, lastSeenMessageId } = req.query;
        const userId = req.user.sub || req.user._id;

        // ── 1. Input validation ──────────────────────────────────────────
        if (!conversationId || !type) {
            return res.status(400).json({ message: 'conversationId and type are required' });
        }
        if (!['channel', 'dm'].includes(type)) {
            return res.status(400).json({ message: 'type must be "channel" or "dm"' });
        }
        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            return res.status(400).json({ message: 'Invalid conversationId' });
        }
        if (lastSeenMessageId && !mongoose.Types.ObjectId.isValid(lastSeenMessageId)) {
            return res.status(400).json({ message: 'Invalid lastSeenMessageId' });
        }

        // ── 2. Membership check ──────────────────────────────────────────
        if (type === 'channel') {
            const channel = await Channel.findById(conversationId).select('members isPrivate isDefault').lean();
            if (!channel) return res.status(404).json({ message: 'Channel not found' });

            const isMember = !channel.isPrivate || channel.isDefault ||
                channel.members.some(m => {
                    const memberId = m.user ? m.user.toString() : m.toString();
                    return memberId === userId.toString();
                });

            if (!isMember) return res.status(403).json({ message: 'Not a member of this channel' });

        } else { // dm
            const dmSession = await DMSession.findById(conversationId).select('participants').lean();
            if (!dmSession) return res.status(404).json({ message: 'DM session not found' });

            const isParticipant = dmSession.participants.some(p => p.toString() === userId.toString());
            if (!isParticipant) return res.status(403).json({ message: 'Not a participant of this DM' });
        }

        // ── 3. Build query ───────────────────────────────────────────────
        const query = type === 'channel'
            ? { channel: conversationId }
            : { dm: conversationId };

        if (lastSeenMessageId) {
            query._id = { $gt: new mongoose.Types.ObjectId(lastSeenMessageId) };
        }

        // Exclude messages hidden from this user
        query.hiddenFor = { $ne: userId };

        // ── 4. Fetch — hard cap at 50, ascending order ───────────────────
        const messages = await Message.find(query)
            .sort({ _id: 1 })
            .limit(50)
            .select('-hiddenFor -readBy')
            .populate('sender', 'username profilePicture')
            .lean();

        return res.json({
            messages,
            count: messages.length,
            hasMore: messages.length === 50
        });

    } catch (err) {
        console.error('[GET /v2/messages/missed] Error:', err);
        return res.status(500).json({ message: 'Failed to fetch missed messages' });
    }
});

// ==================== MESSAGE ACTIONS ====================

// Get message info (readBy, members, reactions)
router.get('/:messageId/info', messagesController.getMessageInfo);

// Edit a message (sender only)
router.patch('/:messageId', messagesController.editMessage);

// Soft-delete a message (sender only)
router.delete('/:messageId', messagesController.deleteMessage);

// Add a reaction
router.post('/:messageId/react', messagesController.addReaction);

// Remove a reaction
router.delete('/:messageId/react', messagesController.removeReaction);

// Pin / unpin a message
router.post('/:messageId/pin', messagesController.pinMessage);

// Forward message to multiple targets
router.post('/forward', messagesController.forwardMessage);

module.exports = router;

