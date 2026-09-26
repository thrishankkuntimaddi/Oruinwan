const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const Message = require('../messages/message.model');
const logger = require('../../../utils/logger');

const Channel = require('../../features/channels/channel.model');
const DMSession = require('../../../models/DMSession');
const messagesService = require('../messages/messages.service');

// Same access rule as threads.controller.getThread: DM participant or channel member.
async function canAccessMessage(msg, userId) {
  if (msg.dm) {
    const dm = await DMSession.findById(msg.dm).select('participants').lean();
    return !!dm && dm.participants.map(String).includes(String(userId));
  }
  if (msg.channel) {
    const channel = await Channel.findById(msg.channel).select('members').lean();
    return !!channel && channel.members.map(m => String(m.user || m)).includes(String(userId));
  }
  return false;
}

router.post('/:messageId/resolve', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { messageId } = req.params;

    const msg = await Message.findById(messageId).select('channel dm').lean();
    if (!msg) return res.status(404).json({ message: 'Thread not found' });
    if (!(await canAccessMessage(msg, userId))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Canonical resolve state is resolvedThreadAt/resolvedBy (see messages.service.resolveThread).
    const io = req.app.get('io');
    const result = await messagesService.resolveThread(messageId, userId, io);
    if (io) {
      const room = msg.channel ? `channel:${msg.channel}` : `dm:${msg.dm}`;
      io.to(room).emit('thread-resolved', {
        messageId,
        isResolved: result.resolved,
        resolvedBy: result.resolved ? userId : null
      });
    }

    res.json({ isResolved: result.resolved, ...result });
  } catch (err) {
    logger.error('Thread resolve error:', err);
    res.status(err.status || 500).json({ message: 'Failed to resolve thread' });
  }
});


module.exports = router;
