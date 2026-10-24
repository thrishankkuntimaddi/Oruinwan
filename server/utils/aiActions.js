'use strict';

/**
 * Side effects the assistant can perform through tools (ai/tools/registry.js).
 *
 * Every action receives `(args, ctx)` where ctx = { userId, workspaceId, req, io,
 * shared?, channelId?, conversation? }. `conversation` = { id, type, parentId,
 * triggerMessageId } is set by the server when the assistant was @mentioned in a
 * channel / DM / thread, and is the default place threads and replies go.
 * The user id and workspace always come from the authenticated request, never
 * from the model, and every action checks membership before touching data.
 * Messages are encrypted with the conversation key so they stay E2EE, and they
 * are created through the same services (events, notifications, audit) as when
 * the person does the same thing in the app.
 */

const mongoose = require('mongoose');
const logger = require('./logger');
const Channel = require('../src/features/channels/channel.model');
const identity = require('../src/identity');
const { hydrate, USER_MIN } = require('../src/identity/hydrate');
const Note = require('../models/Note');
const Tasks = require('../src/features/tasks/tasks.query');

const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];
const TASK_PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'];
const PRIORITY_ALIASES = { urgent: 'highest', critical: 'highest', normal: 'medium', minor: 'low' };
const MAX_TEXT = 4000;

const oid = (v) => mongoose.Types.ObjectId.isValid(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null;
const fail = (error) => ({ success: false, error });
const ioFrom = (ctx) => ctx.io || ctx.req?.app?.get?.('io') || null;
const cleanText = (v, max = MAX_TEXT) => String(v ?? '').trim().slice(0, max);
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sameId = (a, b) => String(a?._id || a?.user?._id || a?.user || a) === String(b);

async function membership(ctx) {
    if (!ctx.workspaceId) return { error: fail('No current workspace. Ask the user to open a workspace first.') };
    const ws = await identity.workspaces.findById(ctx.workspaceId);
    if (!ws) return { error: fail('Workspace not found') };
    const me = (ws.members || []).find(m => String(m.user?._id || m.user) === String(ctx.userId) && m.status !== 'removed');
    if (!me) return { error: fail('You are not a member of this workspace') };
    return { ws, me };
}

/** A workspace feature an admin turned off (threads, tasks, notes, reminders) stops the assistant too. */
async function featureOff(workspaceId, feature) {
    try {
        const { isFeatureEnabled } = require('../src/shared/workspaceFeatures');
        return !(await isFeatureEnabled(workspaceId, feature));
    } catch {
        return false;
    }
}

async function getCurrentWorkspace(_args, ctx) {
    const { ws, me, error } = await membership(ctx);
    if (error) return error;
    return { success: true, workspace: { id: String(ws._id), name: ws.name, role: me.role, memberCount: (ws.members || []).length } };
}

async function getUserChannels(_args, ctx) {
    const { error } = await membership(ctx);
    if (error) return error;
    const channels = await Channel.find({ workspace: ctx.workspaceId, 'members.user': ctx.userId })
        .select('name description isPrivate members').lean();
    return {
        success: true,
        count: channels.length,
        channels: channels.map(c => ({ id: String(c._id), name: c.name, description: c.description || '', isPrivate: !!c.isPrivate, memberCount: c.members?.length || 0 })),
    };
}

async function getWorkspaceMembers(_args, ctx) {
    const { ws, error } = await membership(ctx);
    if (error) return error;
    const ids = (ws.members || []).filter(m => m.status !== 'removed').map(m => m.user?._id || m.user);
    const users = [...(await identity.users.findManyByIds(ids)).values()];
    const roleOf = new Map((ws.members || []).map(m => [String(m.user?._id || m.user), m.role]));
    return {
        success: true,
        members: users.map(u => ({ id: String(u._id), username: u.username, email: u.email, role: roleOf.get(String(u._id)) || 'member', isMe: String(u._id) === String(ctx.userId) })),
    };
}

const activeMemberIds = (ws) => new Set((ws.members || []).filter(m => m.status !== 'removed').map(m => String(m.user?._id || m.user)));
const nameOf = (u) => (u && (u.name || u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username)) || null;

/**
 * The workspace member a tool call names: a user id, or (models often pass the
 * handle they saw) a username / "@username". Only active members of this workspace.
 */
async function findMember(ws, who) {
    const active = activeMemberIds(ws);
    const raw = String(who || '').trim();
    if (oid(raw)) return active.has(raw) ? (await identity.users.findById(raw)) || { _id: raw } : null;
    const handle = raw.replace(/^@/, '').toLowerCase();
    if (!handle) return null;
    const users = [...(await identity.users.findManyByIds([...active])).values()];
    const byUsername = users.find(u => String(u.username || '').toLowerCase() === handle);
    if (byUsername) return byUsername;
    // A plain name ("Manideep", "Manideep Kuntimaddi"): full name first, then first name.
    // More than one match is ambiguous: say who, so the assistant can ask.
    const lower = (v) => String(v || '').trim().toLowerCase();
    const full = users.filter(u => lower(nameOf(u)) === handle);
    const first = full.length ? full : users.filter(u => lower(nameOf(u)).split(/\s+/)[0] === handle);
    if (first.length === 1) return first[0];
    if (first.length > 1) return { ambiguous: first.map(u => `${nameOf(u)} (@${u.username})`) };
    return null;
}

/**
 * Several people named by the model -> { users } or { error } (an unknown or ambiguous name
 * stops the action, so nothing is assigned to the wrong person).
 */
async function findMembers(ws, list) {
    const users = [];
    for (const who of (Array.isArray(list) ? list : [list]).filter(Boolean).slice(0, 20)) {
        const u = await findMember(ws, who);
        if (u?.ambiguous) return { error: fail(`More than one person matches "${who}": ${u.ambiguous.join(', ')}. Ask which one.`) };
        if (!u) return { error: fail(`"${who}" is not a member of this workspace.`) };
        if (!users.some(x => String(x._id) === String(u._id))) users.push(u);
    }
    return { users };
}

/* ── Conversations: where the assistant posts, and how ─────────────────── */

/** The plain @handles in a message, for mention notifications (never the message itself: it is E2EE). */
function mentionHandles(text) {
    const out = new Set();
    for (const m of String(text || '').matchAll(/(^|[^\w@])@([a-zA-Z0-9_.-]+)/g)) {
        const handle = m[2].replace(/[.-]+$/, '').toLowerCase();
        if (handle) out.add(`@${handle}`);
    }
    return [...out].join(' ');
}

/**
 * Add the people (or here / channel / everyone) the model asked to mention to the text as
 * @handles, so they get the same mention notification as when typed in the composer.
 * -> { text } or { error }
 */
async function withMentions(ws, text, mention) {
    const list = (Array.isArray(mention) ? mention : [mention]).filter(Boolean);
    if (!list.length) return { text };
    const handles = [];
    for (const raw of list.slice(0, 20)) {
        const word = String(raw).trim().replace(/^@/, '').toLowerCase();
        if (word === 'here') { handles.push('@here'); continue; }
        if (['channel', 'everyone', 'all'].includes(word)) { handles.push('@channel'); continue; }
        const found = await findMembers(ws, [raw]);
        if (found.error) return found;
        const u = found.users[0];
        if (!u.username) return { error: fail(`"${raw}" has no username to mention.`) };
        handles.push(`@${u.username}`);
    }
    const already = new Set(mentionHandles(text).split(' ').filter(Boolean));
    const missing = [...new Set(handles)].filter(h => !already.has(h.toLowerCase()));
    return { text: missing.length ? `${text} ${missing.join(' ')}` : text };
}

/**
 * Load a conversation the requester may post in. Channels: an actual member, and on
 * admins-only channels a channel admin (top-level posts only; anyone in the channel may
 * reply in threads). DMs: a participant, and nobody posts while either side blocked the other.
 * -> { conv: { type, id, name, company, workspace, hiddenFor } } or { error }
 */
async function loadConversation(type, id, ctx, { topLevel = true } = {}) {
    if (!oid(id)) return { error: fail('Conversation not found') };
    if (type === 'channel') {
        const ch = await Channel.findById(id).select('name members admins company workspace postingPolicy').lean();
        if (!ch || String(ch.workspace) !== String(ctx.workspaceId)) return { error: fail('Channel not found in this workspace') };
        if (!(ch.members || []).some(m => sameId(m, ctx.userId))) return { error: fail(`You are not a member of #${ch.name}`) };
        if (topLevel && ch.postingPolicy === 'admins') {
            const { canManageChannel } = require('../src/features/channels/channelMute.controller');
            if (!(await canManageChannel(ch, String(ctx.userId)))) return { error: fail(`Only channel admins can post in #${ch.name}.`) };
        }
        return { conv: { type: 'channel', id: String(ch._id), name: `#${ch.name}`, company: ch.company || null, workspace: ch.workspace } };
    }
    const DMSession = require('../models/DMSession');
    const dm = await DMSession.findById(id).select('participants blockedBy company workspace hiddenFor').lean();
    if (!dm || !(dm.participants || []).some(p => sameId(p, ctx.userId))) return { error: fail('Conversation not found') };
    if (dm.workspace && String(dm.workspace) !== String(ctx.workspaceId)) return { error: fail('That conversation belongs to a different workspace') };
    if ((dm.blockedBy || []).length) return { error: fail("You can't send messages in this conversation.") };
    return { conv: { type: 'dm', id: String(dm._id), name: 'the direct message', company: dm.company || null, workspace: dm.workspace || ctx.workspaceId, hiddenFor: dm.hiddenFor || [] } };
}

/**
 * Where to post: a channel (id or name), a person (their DM), an explicit conversation, or —
 * when the assistant was mentioned in a conversation — that conversation.
 */
async function resolveTarget({ channel, person, conversationId, conversationType }, ctx, ws, opts) {
    const channelArg = cleanText(channel, 120);
    if (channelArg) {
        if (oid(channelArg)) return loadConversation('channel', channelArg, ctx, opts);
        const name = channelArg.replace(/^#/, '').trim();
        const matches = await Channel.find({ workspace: ctx.workspaceId, name: new RegExp(`^${escapeRe(name)}$`, 'i') })
            .select('_id members').lean();
        const mine = matches.find(c => (c.members || []).some(m => sameId(m, ctx.userId))) || matches[0];
        if (!mine) return { error: fail(`There is no channel called #${name} in this workspace.`) };
        return loadConversation('channel', String(mine._id), ctx, opts);
    }
    if (person) {
        const found = await dmWith(ws, person, ctx);
        if (found.error) return found;
        return loadConversation('dm', String(found.dm._id), ctx, opts);
    }
    if (conversationId) return loadConversation(conversationType === 'dm' ? 'dm' : 'channel', String(conversationId), ctx, opts);
    const here = ctx.conversation;
    if (here?.id) return loadConversation(here.type === 'dm' ? 'dm' : 'channel', String(here.id), ctx, opts);
    return { error: fail('Which channel or person? Name a channel (for example #general) or a person.') };
}

/** Encrypt with the conversation key (server copy), as for every message the assistant sends. */
async function encryptFor(conv, text) {
    const { encryptForConversation } = require('../src/modules/conversations/cryptoUtils');
    try {
        return { enc: await encryptForConversation(String(conv.id), conv.type, text) };
    } catch (err) {
        logger.warn({ err: err.message, conversationId: String(conv.id) }, '[aiActions] conversation has no server key copy');
        const where = conv.name?.startsWith('#') ? conv.name : 'This conversation';
        return { error: fail(`${where} was set up before the assistant could post in it. Open it once in Oruinwan, then ask again (or post it yourself).`) };
    }
}

/** A new top-level message from the requester (same path as the composer: new-message, notifications, mentions). */
async function postTopLevel(conv, text, ctx) {
    const { enc, error } = await encryptFor(conv, text);
    if (error) return { error };
    const messagesService = require('../src/modules/messages/messages.service');
    if (conv.type === 'dm' && (conv.hiddenFor || []).length) {
        // A new message brings a deleted (hidden) conversation back for both people.
        await require('../models/DMSession').updateOne({ _id: conv.id }, { $set: { hiddenFor: [] } });
    }
    const message = await messagesService.createMessage({
        type: 'message',
        company: conv.company,
        workspace: conv.workspace,
        ...(conv.type === 'dm' ? { dm: conv.id } : { channel: conv.id }),
        sender: ctx.userId,
        ciphertext: enc.ciphertext,
        messageIv: enc.messageIv,
        isEncrypted: true,
        mentionText: mentionHandles(text),
    }, ioFrom(ctx));
    return { message };
}

/** A thread reply from the requester (same events and follow/mention notifications as the thread composer). */
async function postReply(parent, conv, text, ctx) {
    const { enc, error } = await encryptFor(conv, text);
    if (error) return { error };
    const { postEncryptedReply } = require('../src/modules/threads/threads.service');
    const reply = await postEncryptedReply(ioFrom(ctx), {
        parent, senderId: ctx.userId, ciphertext: enc.ciphertext, messageIv: enc.messageIv, mentionText: mentionHandles(text),
    });
    return { reply };
}

/** A full link into the web app (the phone app opens these too), for the assistant to share. */
const appLink = (path) => `${require('../src/shared/utils/webAppUrl').webAppUrl()}${path}`;
const conversationLink = (ctx, conv) => appLink(`/workspace/${ctx.workspaceId}/${conv.type === 'dm' ? 'dm' : 'channel'}/${conv.id}`);
const threadLink = (ctx, conv, parentId) => appLink(`/workspace/${ctx.workspaceId}/thread/${conv.type === 'dm' ? 'dm' : 'channel'}/${conv.id}/${parentId}`);
const messageLink = (ctx, conv) => conversationLink(ctx, conv);

async function sendMessageToChannel({ channelId, channel, message, mention }, ctx) {
    const text = cleanText(message);
    if (!(channelId || channel) || !text) return fail('channelId and message are required');
    const { ws, error } = await membership(ctx);
    if (error) return error;
    const target = await resolveTarget({ channel: channelId || channel }, ctx, ws);
    if (target.error) return target.error;
    const withHandles = await withMentions(ws, text, mention);
    if (withHandles.error) return withHandles.error;
    const posted = await postTopLevel(target.conv, withHandles.text, ctx);
    if (posted.error) return posted.error;
    return { success: true, channelName: target.conv.name, messageId: String(posted.message._id), sent: withHandles.text, link: messageLink(ctx, target.conv) };
}

/**
 * The requester's DM with a workspace member, created when missing (findOrCreateDMSession
 * gives it a conversation key with a server copy). Never when either side blocked the other.
 * -> { dm, recipient, to } or { error }
 */
async function dmWith(ws, who, ctx) {
    const recipient = await findMember(ws, who);
    if (recipient?.ambiguous) return { error: fail(`More than one person matches "${who}": ${recipient.ambiguous.join(', ')}. Ask which one.`) };
    if (!recipient) return { error: fail('That person is not a member of this workspace. Only people in this workspace can be messaged.') };
    const recipientId = String(recipient._id);
    if (recipientId === String(ctx.userId)) return { error: fail('Cannot message yourself') };
    const to = nameOf(recipient) || 'them';

    const DMSession = require('../models/DMSession');
    const messagesService = require('../src/modules/messages/messages.service');
    // A block stops the assistant exactly like it stops the composer (checked before creating anything).
    const pair = [String(ctx.userId), recipientId].sort().map(id => new mongoose.Types.ObjectId(id));
    const existing = await DMSession.findOne({ workspace: ctx.workspaceId, participants: { $all: pair, $size: 2 }, isGroup: { $ne: true } })
        .select('blockedBy').lean();
    const blocks = existing?.blockedBy || [];
    if (blocks.some(b => String(b.user) === String(ctx.userId))) return { error: fail(`You blocked ${to}. Unblock them to send messages.`) };
    if (blocks.length) return { error: fail(`You can't send messages to ${to}.`) };

    const dm = await messagesService.findOrCreateDMSession(ctx.userId, recipientId, ctx.workspaceId);
    return { dm, recipient, to };
}

/**
 * Send a DM on the requester's behalf: only to an active member of the current
 * workspace, never when either side blocked the other. The DM is created when
 * missing and the text is encrypted with its key, so it stays E2EE and both
 * people can read it. The result carries exactly what was sent, for the chat to show.
 */
async function sendDirectMessage({ userId: who, message }, ctx) {
    const text = cleanText(message);
    if (!who || !text) return fail('userId and message are required');
    const { ws, error } = await membership(ctx);
    if (error) return error;
    const found = await dmWith(ws, who, ctx);
    if (found.error) return found.error;
    const { dm, recipient, to } = found;
    const recipientId = String(recipient._id);

    const DMSession = require('../models/DMSession');
    const messagesService = require('../src/modules/messages/messages.service');
    const { encryptForConversation } = require('../src/modules/conversations/cryptoUtils');
    let enc;
    try {
        enc = await encryptForConversation(String(dm._id), 'dm', text);
    } catch (err) {
        logger.warn({ err: err.message, dmSessionId: String(dm._id) }, '[aiActions] dm has no server key copy');
        // An older conversation keyed in the browser: opening it once in the app adds the
        // server copy (POST /keys/escrow), after which the assistant can send in it.
        return fail(`Your conversation with ${to} was set up before the assistant could send in it. Open it once in Oruinwan, then ask again (or send the message yourself).`);
    }
    // A new message brings a deleted (hidden) conversation back for both people.
    if ((dm.hiddenFor || []).length) await DMSession.updateOne({ _id: dm._id }, { $set: { hiddenFor: [] } });
    const saved = await messagesService.createMessage({
        type: 'message',
        company: dm.company,
        workspace: dm.workspace,
        dm: dm._id,
        sender: ctx.userId,
        ciphertext: enc.ciphertext,
        messageIv: enc.messageIv,
        isEncrypted: true,
    }, ioFrom(ctx));
    return { success: true, to, toUserId: recipientId, username: recipient.username || null, sent: text, dmSessionId: String(dm._id), messageId: String(saved._id) };
}

/* ── Threads ───────────────────────────────────────────────────────────── */

/** "[Thread] review: review is pending" (the team's convention); a title that already has the tag is kept. */
function threadTitle(title, topic) {
    const t = cleanText(title, 300).replace(/^\[thread\]\s*/i, '');
    if (!t) return '';
    const label = cleanText(topic, 60).replace(/:+$/, '');
    return `[Thread] ${label && !t.toLowerCase().startsWith(`${label.toLowerCase()}:`) ? `${label}: ` : ''}${t}`;
}

/**
 * Start a thread: a new top-level message (the thread's parent) in a channel or DM, and when
 * there are details, its first reply. Posted as the requester, encrypted, with the same live
 * events and notifications as when they do it themselves.
 */
async function createThread({ title, topic, details, channel, person, conversationId, conversationType, mention }, ctx) {
    const heading = threadTitle(title, topic);
    if (!heading) return fail('title is required');
    const { ws, error } = await membership(ctx);
    if (error) return error;
    if (await featureOff(ctx.workspaceId, 'threads')) return fail('Threads are turned off in this workspace.');
    const target = await resolveTarget({ channel, person, conversationId, conversationType }, ctx, ws);
    if (target.error) return target.error;
    const { conv } = target;

    const withHandles = await withMentions(ws, heading, mention);
    if (withHandles.error) return withHandles.error;
    const posted = await postTopLevel(conv, withHandles.text, ctx);
    if (posted.error) return posted.error;
    const parentId = String(posted.message._id);

    const out = { success: true, threadId: parentId, title: withHandles.text, conversation: conv.name, link: threadLink(ctx, conv, parentId) };
    const body = cleanText(details);
    if (body) {
        const parent = { _id: posted.message._id, channel: conv.type === 'channel' ? conv.id : undefined, dm: conv.type === 'dm' ? conv.id : undefined, workspace: conv.workspace, company: conv.company, sender: ctx.userId, replyCount: 0 };
        const replied = await postReply(parent, conv, body, ctx);
        if (replied.error) return { ...out, detailsPosted: false, error: replied.error.error };
        out.firstReplyId = String(replied.reply._id);
        out.detailsPosted = true;
    }
    return out;
}

/**
 * Reply in a thread as the requester. Without threadId: the thread the assistant was asked in.
 * A reply id is taken as its thread (threads are one level deep).
 */
async function replyInThread({ threadId, message, mention }, ctx) {
    const text = cleanText(message);
    if (!text) return fail('message is required');
    const id = threadId || ctx.conversation?.parentId;
    if (!oid(id)) return fail('Which thread? Ask in the thread, or create one first with create_thread.');
    const { ws, error } = await membership(ctx);
    if (error) return error;
    if (await featureOff(ctx.workspaceId, 'threads')) return fail('Threads are turned off in this workspace.');

    const Message = require('../src/modules/messages/message.model');
    const FIELDS = 'channel dm workspace company sender replyCount parentId isDeletedUniversally';
    let parent = await Message.findById(id).select(FIELDS).lean();
    if (parent?.parentId) parent = await Message.findById(parent.parentId).select(FIELDS).lean();
    if (!parent || parent.isDeletedUniversally || String(parent.workspace) !== String(ctx.workspaceId)) return fail('Thread not found in this workspace');

    const { checkThreadAccess } = require('../src/modules/threads/threadAccess');
    const access = await checkThreadAccess(parent, ctx.userId, { forWrite: true });
    if (!access.ok) return fail(access.status === 404 ? 'Thread not found' : access.error);
    const conv = parent.dm
        ? { type: 'dm', id: String(parent.dm), name: 'the direct message' }
        : { type: 'channel', id: String(parent.channel), name: 'this channel' };

    const withHandles = await withMentions(ws, text, mention);
    if (withHandles.error) return withHandles.error;
    const replied = await postReply(parent, conv, withHandles.text, ctx);
    if (replied.error) return replied.error;
    return { success: true, threadId: String(parent._id), replyId: String(replied.reply._id), sent: withHandles.text, link: threadLink(ctx, conv, parent._id) };
}

/* ── Tasks ─────────────────────────────────────────────────────────────── */

/** The message a new task should point back to, when the requester can read it. */
async function linkableMessage(messageId, ctx) {
    if (!oid(messageId)) return null;
    const Message = require('../src/modules/messages/message.model');
    const { canAccessMessage } = require('../src/modules/messages/messageAccess');
    const msg = await Message.findById(messageId).select('_id channel dm workspace').lean();
    if (!msg || String(msg.workspace) !== String(ctx.workspaceId)) return null;
    return (await canAccessMessage(msg, ctx.userId)) ? msg : null;
}

async function createTaskForUser({ title, description, dueDate, priority, assigneeIds, assignees, linkToConversation, linkedMessageId }, ctx) {
    if (!title?.trim()) return fail('Task title is required');
    const { ws, error } = await membership(ctx);
    if (error) return error;
    if (await featureOff(ctx.workspaceId, 'tasks')) return fail('Tasks are turned off in this workspace.');

    let due;
    if (dueDate) {
        due = new Date(dueDate);
        if (Number.isNaN(due.getTime())) return fail('dueDate must be a date like 2026-11-02');
    }
    const named = [...(Array.isArray(assigneeIds) ? assigneeIds : []), ...(Array.isArray(assignees) ? assignees : [assignees])].filter(Boolean);
    const found = await findMembers(ws, named);
    if (found.error) return found.error;
    const ids = found.users.map(u => String(u._id));
    const onlyMe = ids.length === 0 || (ids.length === 1 && ids[0] === String(ctx.userId));

    // Optionally point the task back at the message / thread it came from.
    const sourceId = linkedMessageId || (linkToConversation ? (ctx.conversation?.parentId || ctx.conversation?.triggerMessageId) : null);
    const source = sourceId ? await linkableMessage(sourceId, ctx) : null;
    if (linkedMessageId && !source) return fail('That message was not found, or you cannot see it.');

    const p = String(priority || '').toLowerCase();
    const taskData = {
        workspaceId: String(ctx.workspaceId),
        title: title.trim().slice(0, 200),
        description: description ? String(description).slice(0, 4000) : '',
        priority: TASK_PRIORITIES.includes(p) ? p : PRIORITY_ALIASES[p] || 'medium',
        dueDate: due,
        assignmentType: onlyMe ? 'self' : 'individual',
        assignedToIds: onlyMe ? [] : ids,
        ...(source ? { linkedMessage: String(source._id) } : {}),
        source: 'ai',
    };
    const tasksService = require('../src/features/tasks/tasks.service');
    const plans = require('../src/shared/plans/planService');
    try {
        // Same plan limits as POST /api/tasks (the route guard does not run for the assistant).
        await plans.enforce(plans.assertCanCreateTasks(String(ctx.workspaceId), ctx.userId, plans.taskAddsForBody(taskData, ctx.userId)));
        const created = await tasksService.createTask(ctx.userId, taskData, ioFrom(ctx), ctx.req || undefined);
        const tasks = Array.isArray(created?.tasks) ? created.tasks : [created?.task || created].filter(Boolean);
        const task = tasks[0];
        return {
            success: true,
            taskId: String(task?._id || ''),
            ...(tasks.length > 1 ? { taskIds: tasks.map(t => String(t._id)) } : {}),
            title: task?.title || taskData.title,
            priority: task?.priority || taskData.priority,
            dueDate: task?.dueDate || null,
            assignees: onlyMe ? ['you'] : found.users.map(u => nameOf(u) || u.username),
            linkedToMessage: !!source,
            link: appLink(`/workspace/${ctx.workspaceId}/tasks/${task?._id || ''}`),
        };
    } catch (err) {
        return fail(err.message || 'Failed to create task');
    }
}

async function listMyTasks({ status, limit = 20 }, ctx) {
    const { error } = await membership(ctx);
    if (error) return error;
    const q = { workspace: ctx.workspaceId, deleted: { $ne: true }, $or: [{ assignedTo: ctx.userId }, { createdBy: ctx.userId }] };
    if (status && TASK_STATUSES.includes(status)) q.status = status;
    const tasks = await Tasks.find(q, { sort: { dueDate: 1, updatedAt: -1 }, limit: Math.min(Number(limit) || 20, 50), select: 'title status priority dueDate assignedTo' })
        .then((rows) => hydrate(rows, { assignedTo: USER_MIN }));
    return {
        success: true,
        count: tasks.length,
        tasks: tasks.map(t => ({ id: String(t._id), title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate || null, assignees: (t.assignedTo || []).map(u => u.username) })),
    };
}

async function updateTaskStatus({ taskId, status }, ctx) {
    if (!oid(taskId) || !TASK_STATUSES.includes(status)) return fail('taskId and a valid status are required');
    const { error } = await membership(ctx);
    if (error) return error;
    const task = await Tasks.findOne({ _id: taskId, workspace: ctx.workspaceId }, { select: '_id' });
    if (!task) return fail('Task not found in this workspace');
    const tasksService = require('../src/features/tasks/tasks.service');
    try {
        const updated = await tasksService.updateTask(ctx.userId, String(taskId), { status }, ioFrom(ctx), ctx.req || undefined);
        const t = updated?.task || updated;
        return { success: true, taskId: String(taskId), status: t?.status || status };
    } catch (err) {
        return fail(err.message || 'Failed to update task');
    }
}

/* ── Notes ─────────────────────────────────────────────────────────────── */

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const inlineHtml = (line) => escapeHtml(line)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>');

/**
 * Markdown from the model -> the Notes block format ([{ id, type, content, meta }], see
 * features/notes/notes.sanitize.js), so headings, checklists and code show as blocks in the
 * editor instead of one paragraph of raw Markdown.
 */
function markdownToBlocks(markdown, stamp = Date.now().toString(36)) {
    const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    let para = [];
    let n = 0;
    const id = () => `ai-${stamp}-${n++}`;
    const flush = () => {
        if (para.length) blocks.push({ id: id(), type: 'text', content: para.map(inlineHtml).join('<br>'), meta: {} });
        para = [];
    };
    const TODO = /^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/;
    for (let i = 0; i < lines.length;) {
        const line = lines[i];
        const fence = /^\s*```\s*([\w+#-]*)\s*$/.exec(line);
        if (fence) {
            flush();
            const code = [];
            for (i += 1; i < lines.length && !/^\s*```\s*$/.test(lines[i]); i += 1) code.push(lines[i]);
            i += 1;
            blocks.push({ id: id(), type: 'code', content: code.join('\n'), meta: fence[1] ? { lang: fence[1].toLowerCase() } : {} });
            continue;
        }
        const heading = /^(#{1,3})\s+(.+)$/.exec(line);
        if (heading) {
            flush();
            blocks.push({ id: id(), type: 'heading', content: heading[2].replace(/\*\*/g, '').trim(), meta: { level: heading[1].length } });
            i += 1;
            continue;
        }
        if (TODO.test(line)) {
            flush();
            const items = [];
            for (; i < lines.length && TODO.test(lines[i]); i += 1) {
                const m = TODO.exec(lines[i]);
                items.push({ id: `${stamp}-${n}-${items.length}`, text: m[2].trim(), done: m[1].toLowerCase() === 'x' });
            }
            blocks.push({ id: id(), type: 'checklist', content: JSON.stringify(items), meta: {} });
            continue;
        }
        if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) {
            flush();
            blocks.push({ id: id(), type: 'divider', content: '', meta: {} });
            i += 1;
            continue;
        }
        if (!line.trim()) { flush(); i += 1; continue; }
        const bullet = /^\s*[-*•]\s+(.+)$/.exec(line);
        para.push(bullet ? `• ${bullet[1]}` : line);
        i += 1;
    }
    flush();
    return blocks;
}

/** Notes keep their blocks as JSON; older notes hold plain HTML (one text block). */
function noteBlocks(content) {
    if (!content) return [];
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed.filter(b => b && typeof b === 'object');
    } catch { /* legacy HTML */ }
    return [{ id: 'legacy', type: 'text', content: String(content), meta: {} }];
}

/** Create a note through the notes service (audit log, live note:created event), owned by the requester. */
async function createNote({ title, content, shareWith }, ctx) {
    if (!title?.trim()) return fail('Note title is required');
    const { ws, error } = await membership(ctx);
    if (error) return error;
    if (await featureOff(ctx.workspaceId, 'notes')) return fail('Notes are turned off in this workspace.');
    const people = await findMembers(ws, shareWith);
    if (people.error) return people.error;
    const notesService = require('../src/features/notes/notes.service');
    try {
        const { note } = await notesService.createNote(ctx.userId, {
            workspaceId: String(ctx.workspaceId),
            title: title.trim().slice(0, 200),
            content: JSON.stringify(markdownToBlocks(String(content || '').slice(0, 50_000))),
            type: 'note',
            sharedWith: people.users.map(u => String(u._id)).filter(id => id !== String(ctx.userId)),
        }, ioFrom(ctx), ctx.req || undefined);
        return {
            success: true,
            noteId: String(note._id),
            title: note.title,
            ...(people.users.length ? { sharedWith: people.users.map(u => nameOf(u) || u.username) } : {}),
            link: appLink(`/workspace/${ctx.workspaceId}/notes/${note._id}`),
        };
    } catch (err) {
        return fail(err.message || 'Failed to create note');
    }
}

/**
 * Add content to the end of an existing note the requester may edit (their own, or one shared
 * with them with editing on), found by id or by title. Goes through the notes service, so an
 * open editor updates live and the change is versioned like any other edit.
 */
async function appendToNote({ noteId, title, content }, ctx) {
    const text = String(content || '').trim().slice(0, 50_000);
    if (!text) return fail('content is required');
    if (!noteId && !title?.trim()) return fail('noteId or the note title is required');
    const { error } = await membership(ctx);
    if (error) return error;
    if (await featureOff(ctx.workspaceId, 'notes')) return fail('Notes are turned off in this workspace.');

    const editable = { workspace: ctx.workspaceId, isArchived: { $ne: true }, $or: [{ owner: ctx.userId }, { sharedWith: ctx.userId, allowEditing: true }] };
    let note = null;
    if (oid(noteId)) note = await Note.findOne({ _id: noteId, ...editable }).select('_id title content').lean();
    else if (title?.trim()) {
        const matches = await Note.find({ ...editable, title: new RegExp(`^\\s*${escapeRe(title.trim())}\\s*$`, 'i') })
            .sort({ updatedAt: -1 }).limit(2).select('_id title content').lean();
        if (matches.length > 1) return fail(`More than one note is called "${title.trim()}". Use list_recent_notes and pass the noteId.`);
        note = matches[0] || null;
    }
    if (!note) return fail('Note not found, or you cannot edit it.');

    const blocks = [...noteBlocks(note.content), ...markdownToBlocks(text)];
    const notesService = require('../src/features/notes/notes.service');
    try {
        await notesService.updateNote(ctx.userId, String(note._id), { content: JSON.stringify(blocks) }, ioFrom(ctx), ctx.req || undefined);
        return { success: true, noteId: String(note._id), title: note.title, link: appLink(`/workspace/${ctx.workspaceId}/notes/${note._id}`) };
    } catch (err) {
        return fail(err.message || 'Failed to update the note');
    }
}

async function listRecentNotes({ limit = 10 }, ctx) {
    const { error } = await membership(ctx);
    if (error) return error;
    const notes = await Note.find({ workspace: ctx.workspaceId, isArchived: { $ne: true }, $or: [{ owner: ctx.userId }, { sharedWith: ctx.userId }, { isPublic: true }] })
        .sort({ updatedAt: -1 }).limit(Math.min(Number(limit) || 10, 30)).select('title updatedAt owner').lean();
    return { success: true, notes: notes.map(n => ({ id: String(n._id), title: n.title, updatedAt: n.updatedAt, mine: String(n.owner) === String(ctx.userId) })) };
}

async function searchWorkspace({ query }, ctx) {
    if (!query?.trim()) return fail('query is required');
    const { error } = await membership(ctx);
    if (error) return error;

    // Meaning-based search over notes, tasks and knowledge pages the user can see.
    try {
        const knowledge = require('../src/features/ai/ai.knowledge.service');
        const results = await knowledge.search(ctx.workspaceId, ctx.userId, query, { k: 8, minScore: 0.45, shared: !!ctx.shared, channelId: ctx.channelId || null });
        return { success: true, results: results.map(r => ({ type: r.type, id: r.id, title: r.title, snippet: r.snippet.slice(0, 200), relevance: r.score })) };
    } catch (err) {
        logger.warn({ err: err.message }, '[aiActions] semantic search unavailable, using keyword search');
    }

    // Keyword fallback (engine unreachable). Same visibility rules as above.
    const terms = query.trim().split(/\s+/).slice(0, 6).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(terms.join('|'), 'i');
    const { visibleRefs } = require('../src/features/ai/ai.knowledge.service');
    const refs = await visibleRefs(ctx.workspaceId, ctx.userId, { shared: !!ctx.shared, channelId: ctx.channelId || null });
    let KnowledgePage = null;
    try { KnowledgePage = require('../src/features/knowledge/KnowledgePage'); } catch { /* optional */ }
    const [pages, notes, tasks] = await Promise.all([
        KnowledgePage ? KnowledgePage.find({ _id: { $in: refs }, $or: [{ title: regex }, { content: regex }] }).limit(5).select('title content').lean() : [],
        Note.find({ _id: { $in: refs }, $or: [{ title: regex }, { content: regex }] }).limit(5).select('title content').lean(),
        Tasks.find({ _id: { $in: refs }, $or: [{ title: regex }, { description: regex }] }, { limit: 5, select: 'title status priority dueDate' }),
    ]);
    const snippet = (s) => String(s || '').replace(/\s+/g, ' ').slice(0, 240);
    return {
        success: true,
        results: [
            ...pages.map(p => ({ type: 'knowledge', id: String(p._id), title: p.title, snippet: snippet(p.content) })),
            ...notes.map(n => ({ type: 'note', id: String(n._id), title: n.title, snippet: snippet(n.content) })),
            ...tasks.map(t => ({ type: 'task', id: String(t._id), title: t.title, snippet: `${t.status} · ${t.priority}${t.dueDate ? ` · due ${new Date(t.dueDate).toISOString().slice(0, 10)}` : ''}` })),
        ],
    };
}

/**
 * Without startsAt, the real availability finder (meetings.service suggestTime: busy meetings +
 * each attendee's working hours and timezone) picks the earliest slot everyone can make. When no
 * slot suits everyone nothing is booked; the candidates go back to the model to ask the user.
 */
async function scheduleMeeting({ title, startsAt, durationMinutes = 30, participantIds = [], earliest, latest, priority }, ctx) {
    if (!title?.trim()) return fail('title is required');
    let start = null;
    if (startsAt) {
        start = new Date(startsAt);
        if (Number.isNaN(start.getTime())) return fail('startsAt must be an ISO date-time');
    }
    const { ws, error } = await membership(ctx);
    if (error) return error;
    let ScheduledMeeting;
    try { ScheduledMeeting = require('../src/models/ScheduledMeeting'); } catch { return fail('Scheduling is not available'); }
    const activeMembers = (ws.members || []).filter(m => (m.status || 'active') === 'active');
    const memberIds = new Set(activeMembers.map(m => String(m.user?._id || m.user)));
    const participants = [...new Set((Array.isArray(participantIds) ? participantIds : []).map(String))]
        .filter(id => memberIds.has(id) && id !== String(ctx.userId));
    const duration = Math.max(5, Math.min(Number(durationMinutes) || 30, 480));
    const me = await identity.users.findById(ctx.userId);

    let chosenBy = 'user';
    if (!start) {
        const meetingsService = require('../src/features/meetings/meetings.service');
        const suggestion = await meetingsService.suggestTime({
            participantIds: [String(ctx.userId), ...participants],
            durationMinutes: duration,
            from: earliest, to: latest, limit: 3,
            timezone: me?.preferences?.region?.timezone,
        });
        const best = (suggestion.slots || [])[0];
        if (!best || !best.allAvailable) {
            return {
                success: false,
                error: best ? 'No time suits every participant in that window. Nothing was booked; ask the user to pick one of these slots or another time.'
                    : 'No free slot in that window. Nothing was booked; ask the user for another time or a wider window.',
                candidates: (suggestion.slots || []).map(s => ({ start: s.start, end: s.end, availableCount: s.availableCount, attendeeCount: s.attendeeCount })),
                window: suggestion.window,
            };
        }
        start = new Date(best.start);
        chosenBy = 'availability';
    }

    const meeting = await ScheduledMeeting.create({
        companyId: me?.companyId || null,
        workspaceId: ctx.workspaceId,
        createdBy: ctx.userId,
        title: title.trim().slice(0, 200),
        startTime: start,
        duration,
        participants,
        invitees: participants,
        priority: ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal',
        status: 'scheduled',
    });
    const io = ioFrom(ctx);
    // Clashes are advisory: the meeting stays booked, both meetings are marked and the result says so.
    let clashes = [];
    try {
        clashes = await require('../src/features/meetings/conflicts').recordClashes(meeting, { io });
    } catch { clashes = []; }
    if (io) io.to(`workspace:${ctx.workspaceId}`).emit('schedule:created', { meeting });
    try {
        const notificationService = require('../src/modules/notifications/notificationService');
        const recipients = (participants.length ? participants : [...memberIds]).filter(id => id !== String(ctx.userId));
        const base = { workspaceId: ctx.workspaceId, title: meeting.title, scheduledMeetingId: meeting._id, startTime: meeting.startTime, priority: meeting.priority };
        const clashing = new Set(clashes.flatMap(c => (c.userIds || []).map(String)));
        await notificationService.scheduleCreated(io, { ...base, recipientIds: recipients.filter(id => !clashing.has(id)) });
        for (const id of recipients.filter(r => clashing.has(r))) {
            await notificationService.scheduleCreated(io, { ...base, recipientIds: [id], conflicts: clashes.filter(c => (c.userIds || []).map(String).includes(id)) });
        }
    } catch { /* non-fatal */ }
    return {
        success: true, meetingId: String(meeting._id), title: meeting.title, startTime: meeting.startTime, duration: meeting.duration, chosenBy,
        priority: meeting.priority || 'normal',
        ...(clashes.length ? { conflicts: clashes.map(c => ({ title: c.title, priority: c.priority, start: c.start, end: c.end, people: (c.userIds || []).map(String) })) } : {}),
    };
}

/* ── Reminders ─────────────────────────────────────────────────────────── */

/**
 * Remind the requester about a message at a time (the same reminder as "Remind me" on a
 * message: delivered as reminder:due and listed under Reminders). Without messageId: the
 * thread or message the assistant was asked in. Only ever for the requester.
 */
async function setReminder({ remindAt, note, messageId }, ctx) {
    const when = new Date(remindAt);
    if (!remindAt || Number.isNaN(when.getTime())) return fail('remindAt must be an ISO date-time');
    if (when <= new Date()) return fail('remindAt must be in the future');
    const { error } = await membership(ctx);
    if (error) return error;
    if (await featureOff(ctx.workspaceId, 'reminders')) return fail('Reminders are turned off in this workspace.');
    const target = messageId || ctx.conversation?.parentId || ctx.conversation?.triggerMessageId;
    if (!target) return fail('Reminders are attached to a message. Ask me in the conversation the reminder is about, or create a thread first and remind on it.');
    const msg = await linkableMessage(target, ctx);
    if (!msg) return fail('That message was not found, or you cannot see it.');
    const MessageReminder = require('../src/modules/messages/messageReminder.model');
    const reminder = await MessageReminder.findOneAndUpdate(
        { userId: ctx.userId, messageId: msg._id },
        { remindAt: when, note: String(note || '').trim().slice(0, 500), delivered: false, deliveredAt: null },
        { upsert: true, new: true },
    );
    return { success: true, reminderId: String(reminder._id), remindAt: when.toISOString(), note: reminder.note || '' };
}

/* ── Personal memory (private to the user; see ai.memory.service) ─────── */

// Assistant-saved memories apply everywhere; users can scope them in Settings → AI.
async function rememberAboutUser({ fact }, ctx) {
    if (!fact || !String(fact).trim()) return fail('fact is required');
    if (ctx.shared) return fail('Memories can only be saved in your private assistant chat.');
    const memory = require('../src/features/ai/ai.memory.service');
    try {
        const saved = await memory.add(ctx.userId, {
            text: fact,
            scope: 'everywhere',
            source: 'assistant',
        });
        return { success: true, remembered: saved.text, scope: saved.scope };
    } catch (err) {
        return fail(err.message);
    }
}

async function forgetAboutUser({ about }, ctx) {
    if (!about || !String(about).trim()) return fail('about is required');
    if (ctx.shared) return fail('Memories can only be changed in your private assistant chat.');
    const memory = require('../src/features/ai/ai.memory.service');
    const res = await memory.forgetMatching(ctx.userId, ctx.workspaceId, about);
    return { success: true, forgotten: res.deleted, count: res.deleted.length };
}

module.exports = {
    rememberAboutUser,
    forgetAboutUser,
    getCurrentWorkspace,
    getUserChannels,
    getWorkspaceMembers,
    sendMessageToChannel,
    sendDirectMessage,
    createThread,
    replyInThread,
    createTaskForUser,
    listMyTasks,
    updateTaskStatus,
    createNote,
    appendToNote,
    listRecentNotes,
    searchWorkspace,
    scheduleMeeting,
    setReminder,
};

// Pure helpers, for tests (underscore: never reachable through the internal actions endpoint).
module.exports._markdownToBlocks = markdownToBlocks;
module.exports._threadTitle = threadTitle;
module.exports._mentionHandles = mentionHandles;
