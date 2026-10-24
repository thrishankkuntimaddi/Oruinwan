'use strict';

/**
 * Oruinwan AI as a participant in conversations.
 *
 * When someone mentions the assistant (@ai / @Oruinwan) in a channel, DM or
 * thread, their client calls POST /api/ai/reply with the question and the
 * recent messages it has already decrypted. The answer is streamed live to
 * everyone in the conversation over the socket room, then stored like any
 * other message: end-to-end encrypted with the conversation key and sent by
 * the dedicated "Oruinwan AI" account.
 *
 * Socket event (room `channel:<id>` or `dm:<id>`), name `ai:reply`:
 *   { replyId, conversationId, conversationType, parentId, phase: 'start' }
 *   { replyId, phase: 'delta', text }        full text so far (throttled)
 *   { replyId, phase: 'tool', name, status }  while the assistant uses a tool
 *   { replyId, phase: 'end', messageId }      the stored message has been broadcast
 *   { replyId, phase: 'error', message }
 */

const crypto = require('crypto');
const gateway = require('./ai.gatewayResolver');
const { upsertSystemUser } = require('../../identity/queries/security');
const { hydrate, USER_MIN } = require('../../identity/hydrate');
const Message = require('../../modules/messages/message.model.js');
const messagesService = require('../../modules/messages/messages.service');
const { encryptForConversation } = require('../../modules/conversations/cryptoUtils');
const { checkConversationAccess } = require('../../modules/threads/threadAccess');
const Channel = require('../channels/channel.model.js');
const DMSession = require('../../../models/DMSession');
const logger = require('../../../utils/logger');
const knowledgeService = require('./ai.knowledge.service');
const { resolveMentions } = require('./ai.mentions');

const ASSISTANT_EMAIL = 'assistant@ai.oruinwan.internal';
const ASSISTANT_NAME = 'Oruinwan AI';
const ASSISTANT_ROLE = 'ai_assistant';
const DELTA_INTERVAL_MS = 90;
const MAX_ACTIVE_PER_CONVERSATION = 2;

const IN_CONVERSATION_PROMPT = [
  'You are replying inside a shared team conversation: everyone in it will read your answer.',
  'Answer the latest request addressed to you, using the conversation above as context.',
  'Be concise and well formatted (short paragraphs, bullet lists, fenced code blocks for code).',
  'Do not repeat the question. Do not address people as "the user".',
  'When the person who asked wants something done here (start a thread, reply in this thread, create a task or note, set a reminder, mention people),',
  'use your tools: threads and replies go to this conversation unless they name another channel or person, and are posted as the person who asked.',
  'Then confirm in one or two lines what you did, with the link the tool returned.',
].join(' ');

/** Matches a message addressed to an assistant: @ai, @oruinwan, @claude, @chatgpt, @gemini, @grok… */
const { MENTION_RE, describe } = require('./assistants');

const assistantPromises = new Map(); // assistant id -> Promise<user>

/** The system account that authors AI messages (created on first use; it has no password and cannot sign in). */
function getAssistantUser(assistant = 'default') {
  const id = describe(assistant) && assistant !== 'default' ? assistant : 'default';
  if (!assistantPromises.has(id)) {
    const fields = id === 'default'
      ? { email: ASSISTANT_EMAIL, username: ASSISTANT_NAME, profilePicture: '/icons/oruinwan-128.png' }
      // Claude, ChatGPT, Gemini, Grok…: their own account, so answers show who wrote them.
      : { email: `assistant-${id}@ai.oruinwan.internal`, username: describe(id).name, profilePicture: `/icons/ai/${id}.svg` };
    assistantPromises.set(id, upsertSystemUser({ ...fields, roles: [ASSISTANT_ROLE] }).catch((err) => { assistantPromises.delete(id); throw err; }));
  }
  return assistantPromises.get(id);
}

const active = new Map(); // conversationKey -> count

function stripMention(text) {
  return String(text || '').replace(new RegExp(MENTION_RE.source, 'gi'), '$1').replace(/\s+/g, ' ').trim();
}

/**
 * Validate and start an in-conversation reply. Resolves once the request is
 * accepted; generation continues in the background and is reported over the socket.
 *
 * @returns {Promise<{ replyId: string }>}
 */
async function startReply(input, ctx) {
  const { conversationType, conversationId, parentId = null, triggerMessageId = null } = input;
  const prompt = stripMention(input.prompt);
  const isDm = conversationType === 'dm';
  if (!conversationId || !['dm', 'channel'].includes(conversationType)) throw badRequest('conversationType and conversationId are required');
  if (!prompt) throw badRequest('Ask the assistant something after the mention.');

  const access = await checkConversationAccess(isDm ? { dm: conversationId } : { channel: conversationId }, ctx.userId, { forWrite: true });
  if (!access.ok) throw Object.assign(new Error(access.error), { status: access.status });

  const convo = isDm
    ? await DMSession.findById(conversationId).select('workspace company participants').lean()
    : await Channel.findById(conversationId).select('workspace company name').lean();
  if (!convo) throw Object.assign(new Error('Conversation not found'), { status: 404 });
  if (ctx.workspaceId && convo.workspace && String(convo.workspace) !== String(ctx.workspaceId)) {
    throw badRequest('That conversation belongs to a different workspace');
  }

  // People @mentioned in the request. Their messages with the requester (decrypted on the
  // requester's device) are only used in a private chat with an agent, never where others read the answer.
  const privateWithAssistant = isDm && await isPrivateAgentChat(convo, ctx);
  const mentions = Array.isArray(input.mentions) && input.mentions.length
    ? await resolveMentions(input.mentions, { userId: ctx.userId, workspaceId: ctx.workspaceId || (convo.workspace && String(convo.workspace)), allowTranscripts: privateWithAssistant })
    : [];

  let parent = null;
  if (parentId) {
    parent = await Message.findById(parentId).select('channel dm workspace company').lean();
    const sameConversation = parent && String(isDm ? parent.dm : parent.channel) === String(conversationId);
    if (!sameConversation) throw badRequest('Thread not found in this conversation');
  }

  const key = `${conversationType}:${conversationId}`;
  if ((active.get(key) || 0) >= MAX_ACTIVE_PER_CONVERSATION) {
    throw Object.assign(new Error('An assistant is already answering here. Try again in a moment.'), { status: 429, code: 'AI_BUSY' });
  }
  active.set(key, (active.get(key) || 0) + 1);

  const replyId = crypto.randomUUID();
  const room = `${isDm ? 'dm' : 'channel'}:${conversationId}`;
  const assistantName = (ctx.assistant && ctx.assistant !== 'default' && describe(ctx.assistant)?.name) || ASSISTANT_NAME;
  const emit = (data) => ctx.io?.to(room).emit('ai:reply', { replyId, conversationId: String(conversationId), conversationType, parentId: parentId ? String(parentId) : null, assistant: ctx.assistant || 'default', assistantName, ...data });

  emit({ phase: 'start', requestedBy: String(ctx.userId) });
  const runCtx = { ...ctx, workspaceId: ctx.workspaceId || (convo.workspace && String(convo.workspace)), company: convo.company };
  run({ ...input, prompt, parent, isDm, replyId, emit, mentions, conversationName: input.conversationName || convo.name }, runCtx)
    .catch((err) => {
      logger.error({ err }, '[AI] in-conversation reply failed');
      emit({ phase: 'error', message: friendlyError(err, ctx.assistant, ctx.aiContext?.keySource) });
    })
    .finally(() => {
      const n = (active.get(key) || 1) - 1;
      if (n > 0) active.set(key, n); else active.delete(key);
    });

  return { replyId };
}

/** A 1:1 DM between the requester and the assistant answering (their chat with an agent). */
async function isPrivateAgentChat(dm, ctx) {
  const people = (dm.participants || []).map(String);
  if (people.length !== 2 || !people.includes(String(ctx.userId))) return false;
  try {
    const bot = await getAssistantUser(ctx.assistant);
    return people.includes(String(bot._id));
  } catch {
    return false;
  }
}

async function run({ conversationType, conversationId, parent, triggerMessageId, prompt, messages, mentions = [], conversationName, isDm, emit }, ctx) {
  let text = '';
  let lastSent = 0;
  let pending = null;
  const flush = () => { pending = null; lastSent = Date.now(); emit({ phase: 'delta', text }); };

  // Only knowledge everyone in this conversation can see.
  const knowledge = ctx.workspaceId
    ? await knowledgeService.contextFor(ctx.workspaceId, ctx.userId, prompt, { shared: true, channelId: isDm ? null : conversationId })
    : [];

  const result = await gateway.chat({
    message: prompt,
    history: [{ role: 'system', text: IN_CONVERSATION_PROMPT }],
    workspaceId: ctx.workspaceId,
    context: {
      workspaceName: ctx.workspaceName,
      conversation: { id: String(conversationId), type: isDm ? 'dm' : 'channel', name: conversationName, messages },
      ...(mentions.length ? { mentions } : {}),
    },
  }, {
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    req: ctx.req,
    io: ctx.io,
    remember: false,
    // Shared conversation: no personal memories in, no memory changes out.
    shared: true,
    channelId: isDm ? null : String(conversationId),
    // Where the assistant was asked: the default target of its thread / reply / reminder tools.
    // Set here from the validated request, never by the model.
    conversation: {
      id: String(conversationId),
      type: isDm ? 'dm' : 'channel',
      parentId: parent ? String(parent._id) : null,
      triggerMessageId: triggerMessageId ? String(triggerMessageId) : null,
    },
    knowledge,
    ...(ctx.aiContext || {}),
    onToken: (t) => {
      text += t;
      const wait = DELTA_INTERVAL_MS - (Date.now() - lastSent);
      if (wait <= 0) flush();
      else if (!pending) pending = setTimeout(flush, wait);
    },
    onEvent: (e) => {
      if (e.type === 'tool') emit({ phase: 'tool', name: e.name, status: 'running' });
      else if (e.type === 'tool_result') emit({ phase: 'tool', name: e.name, status: e.ok ? 'done' : 'failed' });
    },
  });
  if (pending) clearTimeout(pending);

  const answer = String(result.text || text || '').trim() || "I couldn't come up with an answer to that.";
  const assistant = await getAssistantUser(ctx.assistant);
  const enc = await encryptForConversation(String(conversationId), isDm ? 'dm' : 'channel', answer);

  const saved = parent
    ? await postThreadReply({ parent, parentId: parent._id, senderId: assistant._id, enc, io: ctx.io })
    : await messagesService.createMessage({
      type: 'message',
      company: ctx.company,
      workspace: ctx.workspaceId,
      ...(isDm ? { dm: conversationId } : { channel: conversationId }),
      sender: assistant._id,
      quotedMessageId: triggerMessageId || null,
      ciphertext: enc.ciphertext,
      messageIv: enc.messageIv,
      isEncrypted: true,
    }, ctx.io);

  emit({ phase: 'end', messageId: String(saved._id), requestedBy: String(ctx.userId) });
  return saved;
}

/** Store an encrypted thread reply and broadcast it the same way the threads module does. */
async function postThreadReply({ parent, parentId, senderId, enc, io }) {
  const reply = await Message.create({
    type: 'message',
    sender: senderId,
    payload: { ciphertext: enc.ciphertext, messageIv: enc.messageIv, attachments: [], isEncrypted: true },
    parentId,
    readBy: [senderId],
    workspace: parent.workspace,
    company: parent.company,
    ...(parent.dm ? { dm: parent.dm } : { channel: parent.channel }),
  });
  // Senders live in PostgreSQL: attach them to the plain objects instead of populate().
  const replyObj = await hydrate(reply.toObject(), { sender: USER_MIN });
  const updatedParent = await Message.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 }, $set: { lastReplyAt: new Date() } }, { new: true })
    .lean().then((doc) => hydrate(doc, { sender: USER_MIN }));

  if (io) {
    const room = parent.channel ? `channel:${parent.channel}` : `dm:${parent.dm}`;
    if (updatedParent?.replyCount === 1) {
      io.to(room).emit('thread:created', {
        parentMessageId: String(parentId), channelId: parent.channel, dmId: parent.dm,
        replyCount: 1, lastReplyAt: new Date().toISOString(), parentMessage: updatedParent,
      });
    }
    io.to(room).emit('thread-reply', { parentId: String(parentId), reply: replyObj });
    io.to(room).emit('message-updated', { messageId: String(parentId), updates: { replyCount: updatedParent?.replyCount }, fullMessage: updatedParent });
  }
  return reply;
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function friendlyError(err, assistant, keySource) {
  const name = (assistant && assistant !== 'default' && describe(assistant)?.name) || ASSISTANT_NAME;
  const rejected = require('./assistants').keyRejectedMessage(err, assistant, keySource);
  if (rejected) return rejected;
  if (err?.code === 'AI_ENGINE_UNAVAILABLE') return 'The Oruinwan AI engine is offline right now.';
  if (err?.code === 'CONVERSATION_KEY_MISSING' || /conversation key|encrypt/i.test(err?.message || '')) return `${name} couldn't encrypt its reply for this conversation.`;
  return `${name} couldn't answer that. Please try again.`;
}

module.exports = { startReply, getAssistantUser, stripMention, MENTION_RE, ASSISTANT_ROLE, ASSISTANT_EMAIL };
