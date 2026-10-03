'use strict';

/**
 * Integration bot identities and E2EE posting.
 *
 * Each provider posts as its own system account (username "GitHub" / "Jira",
 * role 'integration_bot', no password, cannot sign in). Messages are stored
 * end-to-end encrypted with the channel key the server holds wrapped under
 * SERVER_KEK, exactly like Oruinwan AI's messages; the card metadata lives in
 * the plaintext `integration` subdocument (type 'integration').
 *
 * The bot is a system identity: it may post to any channel of the workspace
 * that owns the integration, member or not, but never to another workspace.
 */

const Message = require('../../modules/messages/message.model.js');
const Channel = require('../channels/channel.model.js');
const { upsertSystemUser } = require('../../identity/queries/security');
const { hydrate, USER_MIN, userSelect } = require('../../identity/hydrate');
const messagesService = require('../../modules/messages/messages.service');
const { encryptForConversation } = require('../../modules/conversations/cryptoUtils');
const logger = require('../../../utils/logger');

const BOT_ROLE = 'integration_bot';

const BOTS = {
  github: { username: 'GitHub', email: 'github@integrations.oruinwan.internal', avatar: '/integrations/github.svg' },
  gitlab: { username: 'GitLab', email: 'gitlab@integrations.oruinwan.internal', avatar: '/integrations/gitlab.svg' },
  jira: { username: 'Jira', email: 'jira@integrations.oruinwan.internal', avatar: '/integrations/jira.svg' },
};

const botPromises = new Map();

/** The system account for a provider (created on first use). */
function getBotUser(provider) {
  const def = BOTS[provider];
  if (!def) return Promise.reject(new Error(`No bot for provider ${provider}`));
  if (!botPromises.has(provider)) {
    const p = upsertSystemUser({ email: def.email, username: def.username, roles: [BOT_ROLE], profilePicture: def.avatar })
      .catch((err) => { botPromises.delete(provider); throw err; });
    botPromises.set(provider, p);
  }
  return botPromises.get(provider);
}

function getIo(io) {
  if (io) return io;
  try { return require('../../socket/getIO').getIO(); } catch { return null; }
}

/** A channel of this workspace that can take posts, or null. */
async function loadPostableChannel(workspaceId, channelId) {
  if (!channelId || !workspaceId) return null;
  const channel = await Channel.findOne({ _id: channelId, workspace: workspaceId }).select('_id workspace company isArchived name').lean();
  if (!channel || channel.isArchived) return null;
  return channel;
}

async function encryptFor(channelId, text) {
  try {
    return await encryptForConversation(String(channelId), 'channel', text);
  } catch (err) {
    logger.warn({ channelId: String(channelId), err: err.message }, '[integrations] cannot encrypt for channel (no server-held key yet); skipping post');
    return null;
  }
}

function plain(doc) {
  if (!doc) return doc;
  return typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
}

function unionIds(a = [], b = []) {
  const seen = new Map();
  [...a, ...b].forEach((id) => { if (id) seen.set(String(id), id); });
  return [...seen.values()];
}

/**
 * Create the card for `card.url` in the channel, or update the existing one
 * (dedupe: one card per external object per channel).
 *
 * @returns {Promise<{ message: object, created: boolean, previous: object|null } | null>}
 */
async function upsertCard({ workspaceId, channelId, provider, card, summary, dedupe = true, io }) {
  const channel = await loadPostableChannel(workspaceId, channelId);
  if (!channel) return null;
  const enc = await encryptFor(channel._id, summary);
  if (!enc) return null;
  io = getIo(io);

  const existing = dedupe && card.url
    ? await Message.findOne({ channel: channel._id, type: 'integration', 'integration.url': card.url, isDeleted: { $ne: true }, parentId: null })
    : null;

  if (existing) {
    const previous = plain(existing.integration) || {};
    const next = { ...previous, ...stripUndefined(card), updatedAt: new Date() };
    next.taskIds = unionIds(previous.taskIds, card.taskIds);
    next.taskKeys = [...new Set([...(previous.taskKeys || []), ...(card.taskKeys || [])])];
    existing.integration = next;
    existing.payload = { ...(plain(existing.payload) || {}), ciphertext: enc.ciphertext, messageIv: enc.messageIv, isEncrypted: true };
    existing.markModified('payload');
    existing.markModified('integration');
    existing.version = (existing.version || 1) + 1;
    await existing.save();
    if (io) io.to(`channel:${channel._id}`).emit('message:edited', await hydrate(existing.toObject(), { sender: userSelect('username email profilePicture') }));
    return { message: existing, created: false, previous };
  }

  const bot = await getBotUser(provider);
  const message = await messagesService.createMessage({
    type: 'integration',
    company: channel.company || null,
    workspace: channel.workspace,
    channel: channel._id,
    sender: bot._id,
    ciphertext: enc.ciphertext,
    messageIv: enc.messageIv,
    integration: { ...stripUndefined(card), provider, updatedAt: new Date() },
  }, io);
  return { message, created: true, previous: null };
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== undefined));
}

/** Store an encrypted thread reply under `parent` and broadcast it like the threads module does. */
async function postThreadReply({ parent, senderId, text, io }) {
  const channelId = parent.channel;
  if (!channelId) return null;
  const enc = await encryptFor(channelId, text);
  if (!enc) return null;
  io = getIo(io);

  const reply = await Message.create({
    type: 'message',
    sender: senderId,
    payload: { ciphertext: enc.ciphertext, messageIv: enc.messageIv, attachments: [], isEncrypted: true },
    parentId: parent._id,
    readBy: [senderId],
    workspace: parent.workspace,
    company: parent.company,
    channel: channelId,
  });
  // Senders live in PostgreSQL: attach them to the plain objects instead of populate().
  const replyObj = await hydrate(reply.toObject(), { sender: USER_MIN });
  const updatedParent = await Message.findByIdAndUpdate(parent._id, { $inc: { replyCount: 1 }, $set: { lastReplyAt: new Date() } }, { new: true })
    .lean().then((doc) => hydrate(doc, { sender: USER_MIN }));

  if (io) {
    const room = `channel:${channelId}`;
    if (updatedParent?.replyCount === 1) {
      io.to(room).emit('thread:created', {
        parentMessageId: String(parent._id), channelId, dmId: null,
        replyCount: 1, lastReplyAt: new Date().toISOString(), parentMessage: updatedParent,
      });
    }
    io.to(room).emit('thread-reply', { parentId: String(parent._id), reply: replyObj });
    io.to(room).emit('message-updated', { messageId: String(parent._id), updates: { replyCount: updatedParent?.replyCount }, fullMessage: updatedParent });
  }
  return reply;
}

module.exports = { getBotUser, upsertCard, postThreadReply, loadPostableChannel, BOT_ROLE, BOTS };
