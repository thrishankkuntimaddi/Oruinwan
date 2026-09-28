const express = require('express');
const router = express.Router();
const Bot = require('./bot.model');
const requireAuth = require('../../shared/middleware/auth');
const logger = require('../../../utils/logger');
const {
  requireWorkspaceAccess, assertWorkspaceMember, sendAccessError, isValidId, HttpError,
} = require('../../shared/utils/workspaceAccess');

const SCOPES = Bot.schema.path('permissions').caster?.enumValues
  || ['messages:read', 'messages:write', 'tasks:read', 'tasks:write', '*'];
const MAX_TEXT = 4000;

router.use('/bots', requireAuth);

// Bots are workspace-admin tooling: every route requires owner/admin.
const adminOfQuery = requireWorkspaceAccess({ from: (req) => req.query?.workspaceId, adminOnly: true });
const adminOfBody = requireWorkspaceAccess({ from: (req) => req.body?.workspaceId, adminOnly: true });

/** Load an active bot and require the caller to be owner/admin of its workspace. */
async function loadBotAsAdmin(req) {
  if (!isValidId(req.params.id)) throw new HttpError(400, 'Invalid bot id');
  const bot = await Bot.findById(req.params.id);
  if (!bot || !bot.isActive) throw new HttpError(404, 'Bot not found');
  await assertWorkspaceMember(bot.workspaceId, req.user.sub, { adminOnly: true });
  return bot;
}

router.get('/bots', adminOfQuery, async (req, res) => {
  try {
    const bots = await Bot.find({ workspaceId: req.workspaceAccess.workspaceId, isActive: true })
      .select('name description tokenPrefix permissions createdAt lastActiveAt messageCount createdBy')
      .populate('createdBy', 'username firstName lastName')
      .lean();

    res.json({ bots });
  } catch (err) {
    logger.error('[Bots] GET error:', err.message);
    res.status(500).json({ message: 'Failed to fetch bots' });
  }
});

router.post('/bots', adminOfBody, async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'name is required' });
    }
    if (name.trim().length > 80) return res.status(400).json({ message: 'name must be at most 80 characters' });
    if (description !== undefined && description !== null && typeof description !== 'string') {
      return res.status(400).json({ message: 'description must be a string' });
    }
    if (description && description.trim().length > 300) {
      return res.status(400).json({ message: 'description must be at most 300 characters' });
    }
    let scopes = ['messages:read', 'messages:write'];
    if (permissions !== undefined) {
      if (!Array.isArray(permissions) || permissions.length === 0
        || !permissions.every(p => typeof p === 'string' && SCOPES.includes(p))) {
        return res.status(400).json({ message: `permissions must be a non-empty array of: ${SCOPES.join(', ')}` });
      }
      scopes = [...new Set(permissions)];
    }

    const { rawToken, tokenHash, tokenPrefix } = Bot.generateToken();

    const bot = await Bot.create({
      name: name.trim(),
      description: description?.trim() || '',
      workspaceId: req.workspaceAccess.workspaceId,
      tokenHash,
      tokenPrefix,
      permissions: scopes,
      createdBy: req.user.sub
    });

    const botDoc = await Bot.findById(bot._id)
      .select('name description tokenPrefix permissions createdAt')
      .lean();

    res.status(201).json({
      bot: botDoc,
      rawToken,
      message: 'Store this bot token securely — it will not be shown again.'
    });
  } catch (err) {
    logger.error('[Bots] POST error:', err.message);
    res.status(500).json({ message: 'Failed to create bot' });
  }
});

/**
 * POST /api/developer/bots/:id/message { channelId, text }
 * The portal's "Test" button. Posts a real (E2EE) channel message labelled with
 * the bot's name, sent on behalf of the admin who pressed it. Only channels of
 * the bot's own workspace; DMs are not supported.
 */
router.post('/bots/:id/message', async (req, res) => {
  try {
    const bot = await loadBotAsAdmin(req);

    const { channelId, text, dmUserId } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ message: 'text is required' });
    if (text.length > MAX_TEXT) return res.status(400).json({ message: `text must be at most ${MAX_TEXT} characters` });
    if (!channelId && dmUserId) return res.status(400).json({ message: 'Bots can only post to channels; dmUserId is not supported' });
    if (!channelId) return res.status(400).json({ message: 'channelId is required' });
    if (!isValidId(channelId)) return res.status(400).json({ message: 'Invalid channelId' });
    const scopes = bot.permissions || [];
    if (!scopes.includes('messages:write') && !scopes.includes('*')) {
      return res.status(403).json({ message: 'This bot does not have the messages:write permission' });
    }

    const Channel = require('../channels/channel.model');
    const channel = await Channel.findOne({ _id: channelId, workspace: bot.workspaceId })
      .select('_id workspace company isArchived').lean();
    if (!channel) return res.status(404).json({ message: 'Channel not found in this bot\'s workspace' });
    if (channel.isArchived) return res.status(400).json({ message: 'Cannot post to an archived channel' });

    const { encryptForConversation } = require('../../modules/conversations/cryptoUtils');
    let enc;
    try {
      enc = await encryptForConversation(String(channel._id), 'channel', `🤖 ${bot.name}: ${text.trim()}`);
    } catch {
      return res.status(400).json({ message: 'This channel has no server-held encryption key yet, so the bot cannot post to it. Send a message in the channel first, then try again.' });
    }

    let io = null;
    try { io = require('../../socket/getIO').getIO(); } catch { /* sockets optional */ }

    const messagesService = require('../../modules/messages/messages.service');
    const message = await messagesService.createMessage({
      type: 'message',
      company: channel.company || null,
      workspace: bot.workspaceId,
      channel: channel._id,
      sender: req.user.sub,
      ciphertext: enc.ciphertext,
      messageIv: enc.messageIv,
      isEncrypted: true,
    }, io);

    await Bot.updateOne({ _id: bot._id }, { lastActiveAt: new Date(), $inc: { messageCount: 1 } });

    res.status(201).json({ message: 'Message sent', messageId: message._id, channelId: String(channel._id) });
  } catch (err) {
    if (err.status) return sendAccessError(res, err);
    logger.error('[Bots] POST /message error:', err.message);
    res.status(500).json({ message: 'Failed to send bot message' });
  }
});

router.delete('/bots/:id', async (req, res) => {
  try {
    const bot = await loadBotAsAdmin(req);
    bot.isActive = false;
    await bot.save();
    res.json({ message: 'Bot deactivated' });
  } catch (err) {
    if (err.status) return sendAccessError(res, err);
    logger.error('[Bots] DELETE error:', err.message);
    res.status(500).json({ message: 'Failed to delete bot' });
  }
});

module.exports = router;
