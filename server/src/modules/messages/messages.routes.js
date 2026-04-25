const express = require('express');
const router = express.Router();
const messagesController = require('./messages.controller');
const threadsController = require('../threads/threads.controller');
const requireAuth = require('../../shared/middleware/auth');
const Message = require('../../features/messages/message.model');
const Channel = require('../../features/channels/channel.model');
const DMSession = require('../../../models/DMSession');
const mongoose = require('mongoose');

router.use(requireAuth);

router.post('/ai/suggestions',    messagesController.getSmartReplies);
router.post('/ai/translate',      messagesController.translateMessage);
router.post('/ai/thread-summary', messagesController.getThreadSummary);

router.get('/reminders',                messagesController.getUserReminders);
router.delete('/reminders/:reminderId', messagesController.cancelReminder);

router.post('/direct', messagesController.sendDirectMessage);

router.get(
    '/workspace/:workspaceId/dm/resolve/:userId',
    messagesController.resolveDMSession
);

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

router.get(
    '/workspace/:workspaceId/dms',
    messagesController.getWorkspaceDMList
);

router.post('/channel', messagesController.sendChannelMessage);

router.post('/poll', messagesController.createPollMessage);

router.get('/channel/:channelId', messagesController.getChannelMessages);

router.get('/thread/:messageId', threadsController.getThread);

router.post('/thread/:messageId', threadsController.postThreadReply);

router.get('/:messageId/thread-count', threadsController.getThreadCount);

router.get('/missed', async (req, res) => {
    try {
        const { conversationId, type, lastSeenMessageId } = req.query;
        const userId = req.user.sub || req.user._id;

        
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

        
        if (type === 'channel') {
            const channel = await Channel.findById(conversationId).select('members isPrivate isDefault').lean();
            if (!channel) return res.status(404).json({ message: 'Channel not found' });

            const isMember = !channel.isPrivate || channel.isDefault ||
                channel.members.some(m => {
                    const memberId = m.user ? m.user.toString() : m.toString();
                    return memberId === userId.toString();
                });

            if (!isMember) return res.status(403).json({ message: 'Not a member of this channel' });

        } else { 
            const dmSession = await DMSession.findById(conversationId).select('participants').lean();
            if (!dmSession) return res.status(404).json({ message: 'DM session not found' });

            const isParticipant = dmSession.participants.some(p => p.toString() === userId.toString());
            if (!isParticipant) return res.status(403).json({ message: 'Not a participant of this DM' });
        }

        
        const query = type === 'channel'
            ? { channel: conversationId }
            : { dm: conversationId };

        if (lastSeenMessageId) {
            query._id = { $gt: new mongoose.Types.ObjectId(lastSeenMessageId) };
        }

        
        query.hiddenFor = { $ne: userId };

        
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

router.get('/:messageId/info', messagesController.getMessageInfo);

router.post('/:messageId/vote', messagesController.voteOnPoll);

router.patch('/:messageId', messagesController.editMessage);

router.delete('/:messageId', messagesController.deleteMessage);

router.post('/:messageId/react', messagesController.addReaction);

router.delete('/:messageId/react', messagesController.removeReaction);

router.post('/:messageId/pin', messagesController.pinMessage);

router.post('/forward', messagesController.forwardMessage);

router.post('/:messageId/reminder', messagesController.scheduleReminder);

router.post('/:messageId/checklist/:itemIdx', messagesController.checklistToggle);

router.get('/:messageId/diff', messagesController.getMessageDiff);

router.post('/:messageId/convert-task', messagesController.convertToTask);

module.exports = router;
