// server/src/features/developer/bots.routes.js
const express = require('express');
const router = express.Router();
const Bot = require('./bot.model');
const requireAuth = require('../../shared/middleware/auth');
const logger = require('../../../utils/logger');

router.use(requireAuth);

// GET /api/developer/bots?workspaceId=xxx
router.get('/bots', async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const bots = await Bot.find({ workspaceId, isActive: true })
      .select('name description tokenPrefix permissions createdAt lastActiveAt messageCount')
      .populate('createdBy', 'username firstName lastName')
      .lean();

    res.json({ bots });
  } catch (err) {
    logger.error('[Bots] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch bots' });
  }
});

// POST /api/developer/bots — create a bot
router.post('/bots', async (req, res) => {
  try {
    const { workspaceId, name, description, permissions } = req.body;
    if (!workspaceId || !name) {
      return res.status(400).json({ error: 'workspaceId and name are required' });
    }

    const { rawToken, tokenHash, tokenPrefix } = Bot.generateToken();

    const bot = await Bot.create({
      name: name.trim(),
      description: description?.trim() || '',
      workspaceId,
      tokenHash,
      tokenPrefix,
      permissions: permissions || ['messages:read', 'messages:write'],
      createdBy: req.user.sub
    });

    const botDoc = await Bot.findById(bot._id)
      .select('name description tokenPrefix permissions createdAt')
      .lean();

    res.status(201).json({
      bot: botDoc,
      rawToken, // shown once
      message: 'Store this bot token securely — it will not be shown again.'
    });
  } catch (err) {
    logger.error('[Bots] POST error:', err.message);
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

// POST /api/developer/bots/:id/message — send message as bot
router.post('/bots/:id/message', async (req, res) => {
  try {
    const bot = await Bot.findById(req.params.id).lean();
    if (!bot || !bot.isActive) return res.status(404).json({ error: 'Bot not found' });

    const { channelId, text, dmUserId } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    if (!channelId && !dmUserId) return res.status(400).json({ error: 'channelId or dmUserId is required' });

    // Insert bot message into the InternalMessage collection
    const InternalMessage = require('../../models/InternalMessage');
    const message = await InternalMessage.create({
      workspaceId: bot.workspaceId,
      channelId: channelId || undefined,
      content: text,
      type: 'bot',
      botName: bot.name,
      sender: bot.createdBy, // bot acts on behalf of creator for DB compat
      metadata: { isBot: true, botId: bot._id, botName: bot.name }
    });

    // Emit socket event so connected clients receive it in real-time
    try {
      const { getIO } = require('../../socket/getIO');
      const io = getIO();
      if (io && channelId) {
        io.to(`channel:${channelId}`).emit('new-message', {
          ...message.toObject(),
          isBot: true,
          botName: bot.name
        });
      }
    } catch {
      // Socket not available — message still saved
    }

    // Update bot stats
    await Bot.findByIdAndUpdate(bot._id, {
      lastActiveAt: new Date(),
      $inc: { messageCount: 1 }
    });

    res.status(201).json({ message: 'Message sent', messageId: message._id });
  } catch (err) {
    logger.error('[Bots] POST /message error:', err.message);
    res.status(500).json({ error: 'Failed to send bot message' });
  }
});

// DELETE /api/developer/bots/:id — deactivate a bot
router.delete('/bots/:id', async (req, res) => {
  try {
    const bot = await Bot.findById(req.params.id);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    bot.isActive = false;
    await bot.save();
    res.json({ message: 'Bot deactivated' });
  } catch (err) {
    logger.error('[Bots] DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

module.exports = router;
