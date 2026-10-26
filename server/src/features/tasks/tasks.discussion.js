'use strict';

/**
 * Every task's discussion tab (works for tasks on either store).
 *
 *   Who is in it   the creator, the assignees, watchers, and people the creator / an assignee /
 *                  a workspace admin added. Anyone who can see the task may read and comment;
 *                  commenting makes them a participant (a watcher), like replying follows a
 *                  thread. People added explicitly may open the task even when it is private.
 *   Automatic      status changes (To do → In progress → Review → Done), assignees added /
 *                  removed / reassigned, due date and priority changes are written into the
 *                  stream by the tasks service (recordActivity). Moving to Done marks the
 *                  discussion resolved; moving it out of Done reopens it. Resolved is derived
 *                  from the task's status, so it can never drift.
 *   Linked thread  a task created from a message keeps it (task.linkedMessage): the discussion
 *                  shows that thread's latest replies (end-to-end encrypted payloads the client
 *                  decrypts) and the thread gets a "Task created: …" reply pointing back.
 *   Real time      `task:discussion` { taskId, entry } / `task:discussion-removed` { taskId,
 *                  commentId } to the task's audience; participants get a `task_comment`
 *                  notification for each comment (their notification preferences apply).
 *
 * Content is plaintext on the server, like the task's own title and description.
 */

const mongoose = require('mongoose');
const logger = require('../../../utils/logger');

const sid = (v) => (v == null ? null : String(v._id || v));
const isId = (v) => /^[a-f\d]{24}$/i.test(String(v || ''));
const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode, status: statusCode });

const MAX_TEXT = 10000;
const RESOLVED_STATUSES = new Set(['done']);

const models = () => require('./taskDiscussion.model');
const tasksService = () => require('./tasks.service');
const identity = () => require('../../identity');
// Overridable in tests (no database there).
const env = { dbReady: () => mongoose.connection.readyState === 1 };
const dbReady = () => env.dbReady();

function getIo(io) {
    if (io) return io;
    try { return require('../../socket/getIO').getIO(); } catch { return null; }
}

/** Creator, assignees and watchers by role, plus people added to the discussion. */
function participantIds(task, discussion) {
    const ids = new Set();
    if (task.createdBy) ids.add(sid(task.createdBy));
    (task.assignedTo || []).forEach((a) => a && ids.add(sid(a)));
    (task.watchers || []).forEach((w) => w && ids.add(sid(w)));
    (discussion?.participants || []).forEach((p) => p && ids.add(sid(p)));
    return [...ids].filter(Boolean);
}

function rolesOf(task, discussion, userId) {
    const uid = String(userId);
    const roles = [];
    if (sid(task.createdBy) === uid) roles.push('creator');
    if ((task.assignedTo || []).some((a) => sid(a) === uid)) roles.push('assignee');
    if ((task.watchers || []).some((w) => sid(w) === uid)) roles.push('watcher');
    if ((discussion?.participants || []).some((p) => sid(p) === uid)) roles.push('added');
    return roles;
}

function permissionsFor(task, userId, isManager) {
    const uid = String(userId);
    const isCreator = sid(task.createdBy) === uid;
    const isAssignee = (task.assignedTo || []).some((a) => sid(a) === uid);
    return {
        canComment: !task.deleted,
        // "The assignee, the creator and anyone they add."
        canAddPeople: !task.deleted && (isCreator || isAssignee || !!isManager),
        // Remove others' comments and people they added.
        canModerate: isCreator || !!isManager,
    };
}

/** Whether userId was added to the task's discussion (grants view access). Never throws. */
async function isExplicitParticipant(taskId, userId) {
    if (!dbReady() || !isId(taskId) || !isId(userId)) return false;
    try {
        return !!(await models().TaskDiscussion.exists({ task: taskId, participants: userId }));
    } catch {
        return false;
    }
}

async function hydrateUsers(ids) {
    const unique = [...new Set(ids.filter(Boolean).map(String))];
    if (!unique.length) return new Map();
    try {
        const users = await identity().users.findManyByIds(unique);
        return users instanceof Map ? users : new Map();
    } catch {
        return new Map();
    }
}

const userCard = (users, id) => {
    if (!id) return null;
    const u = users.get(String(id));
    return { _id: String(id), username: u?.username || null, profilePicture: u?.profilePicture || null };
};

function entryOut(c, users) {
    return {
        _id: sid(c._id),
        taskId: sid(c.task),
        kind: c.kind,
        author: userCard(users, sid(c.author)),
        text: c.kind === 'comment' ? c.text : '',
        mentions: (c.mentions || []).map(sid),
        attachments: c.attachments || [],
        event: c.kind === 'event' ? {
            type: c.event?.type,
            from: c.event?.from ?? null,
            to: c.event?.to ?? null,
            meta: c.event?.meta ?? null,
        } : null,
        createdAt: c.createdAt,
        editedAt: c.editedAt || null,
    };
}

async function entriesOut(list) {
    const ids = [];
    for (const c of list) {
        ids.push(sid(c.author));
        if (c.kind === 'event') {
            for (const v of [c.event?.from, c.event?.to].flat()) if (isId(v)) ids.push(String(v));
        }
    }
    const users = await hydrateUsers(ids);
    const out = list.map((c) => entryOut(c, users));
    // Names for the people an event is about ("assigned Bob"), so clients need no lookup.
    for (const e of out) {
        if (!e.event) continue;
        const names = {};
        for (const v of [e.event.from, e.event.to].flat()) if (isId(v)) names[String(v)] = users.get(String(v))?.username || null;
        if (Object.keys(names).length) e.event.names = names;
    }
    return out;
}

async function emitEntry(io, task, discussion, entry) {
    const socket = getIo(io);
    if (!socket) return;
    const { emitToTaskAudience } = require('./tasks.shared');
    await emitToTaskAudience(socket, task, 'task:discussion', { taskId: sid(task._id), entry }, (discussion?.participants || []).map(sid));
}

async function touchDiscussion(task, { comment = false, addParticipants = [], removeParticipants = [] } = {}) {
    const { TaskDiscussion } = models();
    const update = {
        $setOnInsert: { workspace: task.workspace ? sid(task.workspace) : null },
        $set: { lastActivityAt: new Date() },
    };
    if (comment) update.$inc = { commentCount: 1 };
    if (addParticipants.length) update.$addToSet = { participants: { $each: addParticipants } };
    const doc = await TaskDiscussion.findOneAndUpdate({ task: sid(task._id) }, update, { upsert: true, new: true }).lean();
    if (removeParticipants.length) {
        return TaskDiscussion.findOneAndUpdate({ task: sid(task._id) }, { $pull: { participants: { $in: removeParticipants } } }, { new: true }).lean();
    }
    return doc;
}

// ── Automatic entries from the tasks service ────────────────────────────────

/** TaskActivity action → discussion events (none for actions the discussion does not show). */
function eventsForActivity(action, extra = {}) {
    const { field, from = null, to = null } = extra || {};
    switch (action) {
        case 'status_changed': {
            const events = [{ type: 'status', from, to, meta: extra.metadata?.reason ? { reason: extra.metadata.reason } : null }];
            if (RESOLVED_STATUSES.has(to) && !RESOLVED_STATUSES.has(from)) events.push({ type: 'resolved' });
            else if (RESOLVED_STATUSES.has(from) && !RESOLVED_STATUSES.has(to)) events.push({ type: 'reopened' });
            return events;
        }
        case 'assignee_added': return [{ type: 'assignee_added', to: sid(to) }];
        case 'assignee_removed': return [{ type: 'assignee_removed', from: sid(from) }];
        case 'all_assignees_changed':
        case 'transfer_approved':
            return [{ type: 'reassigned', from: Array.isArray(from) ? from.map(sid) : sid(from), to: Array.isArray(to) ? to.map(sid) : sid(to) }];
        case 'due_date_changed': return [{ type: 'due_date', from, to }];
        case 'priority_changed': return [{ type: 'priority', from, to }];
        case 'updated':
            if (field === 'dueDate') return [{ type: 'due_date', from: from ? new Date(from).toISOString() : null, to: to ? new Date(to).toISOString() : null }];
            if (field === 'priority') return [{ type: 'priority', from, to }];
            return [];
        default: return [];
    }
}

/**
 * Write the automatic entries for one task activity. Fire-and-forget: never throws and never
 * delays the task change (the tasks service calls it from its activity logger).
 */
function recordActivity(taskId, actorId, action, extra = {}, io = null) {
    const events = eventsForActivity(action, extra);
    if (!events.length || !dbReady()) return Promise.resolve([]);
    return (async () => {
        const task = await tasksService()._loadRawTask(taskId);
        if (!task) return [];
        const { TaskComment } = models();
        const created = await TaskComment.insertMany(events.map((event) => ({
            task: sid(task._id),
            workspace: task.workspace ? sid(task.workspace) : null,
            kind: 'event',
            author: isId(actorId) ? String(actorId) : null,
            event,
        })));
        const discussion = await touchDiscussion(task);
        const entries = await entriesOut(created.map((c) => (typeof c.toObject === 'function' ? c.toObject() : c)));
        for (const entry of entries) await emitEntry(io, task, discussion, entry);
        return entries;
    })().catch((err) => {
        logger.warn({ err: err.message, action }, '[tasks.discussion] automatic entry not recorded');
        return [];
    });
}

// ── Linked thread ────────────────────────────────────────────────────────────

/**
 * The thread a task came from: { messageId (thread root), sourceMessageId, channelId, dmId,
 * channelName, replyCount, lastReplyAt, locked, parent, latestReplies } — or
 * { messageId, restricted: true } when the caller cannot see that conversation.
 */
async function linkedThreadFor(task, userId) {
    if (!task?.linkedMessage || !isId(sid(task.linkedMessage))) return null;
    const Message = require('../../modules/messages/message.model.js');
    const { checkConversationAccess } = require('../../modules/threads/threadAccess');
    const { LIVE_REPLY } = require('../../modules/threads/threads.service');
    const { hydrate } = require('../../identity/hydrate');

    const source = await Message.findById(sid(task.linkedMessage)).select('channel dm parentId').lean();
    if (!source) return null;
    const rootId = sid(source.parentId) || sid(source._id);
    const root = await Message.findById(rootId).lean();
    if (!root) return null;

    // The thread is shown only to people who can read it in chat (a group member who joined after
    // it was posted sees it as restricted, like someone outside the conversation).
    const access = await checkConversationAccess({ channel: root.channel, dm: root.dm }, userId);
    const tooEarly = access.ok && access.since && root.createdAt && new Date(root.createdAt) < new Date(access.since);
    if (!access.ok || tooEarly) return { messageId: rootId, sourceMessageId: sid(source._id), restricted: true };

    let channelName = null;
    if (root.channel) {
        const Channel = require('../channels/channel.model.js');
        channelName = (await Channel.findById(sid(root.channel)).select('name').lean())?.name || null;
    }
    const latest = await Message.find({ parentId: rootId, ...LIVE_REPLY, hiddenFor: { $ne: userId } })
        .sort({ createdAt: -1 }).limit(3).lean();
    latest.reverse();
    const SENDER = { type: 'user', fields: ['username', 'profilePicture'] };
    await hydrate([root, ...latest], { sender: SENDER });
    const strip = (m) => ({
        _id: sid(m._id),
        sender: m.sender,
        payload: m.isDeletedUniversally || m.isDeleted ? { isDeleted: true } : m.payload,
        type: m.type,
        linkedTaskId: sid(m.linkedTaskId),
        attachments: (m.attachments || []).map((a) => ({ type: a.type, name: a.name })),
        createdAt: m.createdAt,
    });
    return {
        messageId: rootId,
        sourceMessageId: sid(source._id),
        channelId: sid(root.channel),
        dmId: sid(root.dm),
        channelName,
        replyCount: root.replyCount || 0,
        lastReplyAt: root.lastReplyAt || null,
        locked: !!root.threadLockedAt,
        parent: strip(root),
        latestReplies: latest.map(strip),
    };
}

// ── Reads and writes ─────────────────────────────────────────────────────────

async function getDiscussion(userId, taskId) {
    const { task, isManager } = await tasksService()._loadTaskForDiscussion(userId, taskId);
    const { TaskDiscussion, TaskComment } = models();
    const [discussion, list] = await Promise.all([
        TaskDiscussion.findOne({ task: sid(task._id) }).lean(),
        TaskComment.find({ task: sid(task._id), deletedAt: null }).sort({ createdAt: 1 }).limit(500).lean(),
    ]);
    const ids = participantIds(task, discussion);
    const users = await hydrateUsers(ids);
    const entries = await entriesOut(list);
    let linkedThread = null;
    try {
        linkedThread = await linkedThreadFor(task, userId);
    } catch (err) {
        logger.warn({ err: err.message }, '[tasks.discussion] linked thread unavailable');
    }
    const resolved = RESOLVED_STATUSES.has(task.status);
    return {
        taskId: sid(task._id),
        status: task.status,
        resolved,
        resolvedAt: resolved ? task.completedAt || null : null,
        participants: ids.map((id) => ({ ...userCard(users, id), roles: rolesOf(task, discussion, id) })),
        entries,
        commentCount: entries.filter((e) => e.kind === 'comment').length,
        linkedThread,
        permissions: permissionsFor(task, userId, isManager),
    };
}

/** @handles in the text that name active members of the task's workspace (not the author). */
async function resolveMentions(task, authorId, text) {
    const { parseMentionHandles } = require('../../utils/mentionParser');
    const { userHandles } = parseMentionHandles(String(text).slice(0, 4000));
    if (!userHandles.length || !task.workspace) return [];
    const ws = await identity().workspaces.findById(sid(task.workspace));
    const memberIds = (ws?.members || [])
        .filter((m) => m?.user && (!m.status || m.status === 'active'))
        .map((m) => sid(m.user))
        .filter((id) => id !== String(authorId));
    const users = await hydrateUsers(memberIds);
    const handles = new Set(userHandles);
    return memberIds.filter((id) => handles.has(String(users.get(id)?.username || '').toLowerCase()));
}

async function postComment(userId, taskId, { text, attachments = [] } = {}, io = null) {
    const body = typeof text === 'string' ? text.trim() : '';
    if (!body && !(Array.isArray(attachments) && attachments.length)) throw httpError(400, 'Write a comment first');
    if (body.length > MAX_TEXT) throw httpError(400, 'That comment is too long');

    const { task, isManager } = await tasksService()._loadTaskForDiscussion(userId, taskId);
    const perms = permissionsFor(task, userId, isManager);
    if (!perms.canComment) throw httpError(400, 'This task is in the trash');

    let cleanAttachments = [];
    if (Array.isArray(attachments) && attachments.length) {
        const { sanitizeAttachments } = require('../../modules/uploads/attachmentSanitizer');
        cleanAttachments = (await sanitizeAttachments(attachments, userId))
            .map((a) => ({ url: a.url, name: a.name || '', type: a.type || 'file', size: a.size ?? null, mimeType: a.mimeType || null }));
    }

    const { TaskDiscussion, TaskComment } = models();
    const before = await TaskDiscussion.findOne({ task: sid(task._id) }).lean();
    const already = new Set(participantIds(task, before));

    const mentioned = body ? await resolveMentions(task, userId, body) : [];
    // A mention adds the person when the author may add people; otherwise it only reaches
    // people already in the discussion.
    const addedByMention = perms.canAddPeople ? mentioned.filter((id) => !already.has(id)) : [];
    const joinAsWatcher = already.has(String(userId)) ? [] : [String(userId)];

    const doc = await TaskComment.create({
        task: sid(task._id),
        workspace: task.workspace ? sid(task.workspace) : null,
        kind: 'comment',
        author: userId,
        text: body,
        mentions: mentioned,
        attachments: cleanAttachments,
    });
    if (joinAsWatcher.length || addedByMention.length) {
        await tasksService()._setWatchers(sid(task._id), { add: [...joinAsWatcher, ...addedByMention] });
    }
    const discussion = await touchDiscussion(task, { comment: true, addParticipants: addedByMention });
    const [entry] = await entriesOut([doc.toObject ? doc.toObject() : doc]);
    const audienceTask = { ...task, watchers: [...(task.watchers || []), ...joinAsWatcher, ...addedByMention] };
    await emitEntry(io, audienceTask, discussion, entry);

    // Everyone in the discussion (and anyone mentioned in it) hears about the comment.
    const recipients = participantIds(audienceTask, discussion).filter((id) => id !== String(userId));
    if (recipients.length && task.workspace) {
        (async () => {
            const notificationService = require('../../modules/notifications/notificationService');
            const me = await identity().users.findById(userId).catch(() => null);
            await Promise.allSettled(recipients.map((recipientId) => notificationService.taskComment(getIo(io), {
                recipientId,
                commenterUsername: me?.username || 'Someone',
                workspaceId: task.workspace,
                taskTitle: task.title,
                taskId: sid(task._id),
            })));
        })().catch((err) => logger.warn({ err: err.message }, '[tasks.discussion] comment notifications failed'));
    }
    return { entry };
}

async function deleteComment(userId, taskId, commentId, io = null) {
    if (!isId(commentId)) throw httpError(404, 'Comment not found');
    const { task, isManager } = await tasksService()._loadTaskForDiscussion(userId, taskId);
    const { TaskComment } = models();
    const comment = await TaskComment.findOne({ _id: commentId, task: sid(task._id), deletedAt: null }).lean();
    if (!comment || comment.kind !== 'comment') throw httpError(404, 'Comment not found');
    const own = sid(comment.author) === String(userId);
    if (!own && !permissionsFor(task, userId, isManager).canModerate) {
        throw httpError(403, 'Only the author, the task creator or a workspace admin can delete this comment');
    }
    await TaskComment.updateOne({ _id: commentId }, { $set: { deletedAt: new Date(), text: '', attachments: [] } });
    const { TaskDiscussion } = models();
    await TaskDiscussion.updateOne({ task: sid(task._id) }, { $inc: { commentCount: -1 } });
    const socket = getIo(io);
    if (socket) {
        const discussion = await TaskDiscussion.findOne({ task: sid(task._id) }).lean();
        const { emitToTaskAudience } = require('./tasks.shared');
        await emitToTaskAudience(socket, task, 'task:discussion-removed', { taskId: sid(task._id), commentId: String(commentId) }, (discussion?.participants || []).map(sid));
    }
    return { deleted: String(commentId) };
}

/** Add people to the discussion: creator, assignees and workspace admins only. */
async function addParticipants(userId, taskId, userIds, io = null) {
    const { task, isManager } = await tasksService()._loadTaskForDiscussion(userId, taskId);
    if (!permissionsFor(task, userId, isManager).canAddPeople) {
        throw httpError(403, 'Only the task creator, its assignees or a workspace admin can add people');
    }
    const wanted = [...new Set((Array.isArray(userIds) ? userIds : []).map(String))].filter(isId);
    if (!wanted.length) throw httpError(400, 'Choose at least one person to add');
    if (wanted.length > 50) throw httpError(400, 'Add at most 50 people at a time');

    const ws = task.workspace ? await identity().workspaces.findById(sid(task.workspace)) : null;
    const { isActiveMember } = require('./tasks.shared');
    const invalid = wanted.filter((id) => !ws || !isActiveMember(ws, id));
    if (invalid.length) throw httpError(400, 'Only active members of this workspace can be added');

    const { TaskDiscussion, TaskComment } = models();
    const before = await TaskDiscussion.findOne({ task: sid(task._id) }).lean();
    const already = new Set(participantIds(task, before));
    const added = wanted.filter((id) => !already.has(id));
    if (!added.length) return { added: [], participants: (await getDiscussion(userId, taskId)).participants };

    await tasksService()._setWatchers(sid(task._id), { add: added });
    const discussion = await touchDiscussion(task, { addParticipants: added });
    const doc = await TaskComment.create({
        task: sid(task._id),
        workspace: task.workspace ? sid(task.workspace) : null,
        kind: 'event',
        author: userId,
        event: { type: 'participant_added', to: added },
    });
    const [entry] = await entriesOut([doc.toObject ? doc.toObject() : doc]);
    await emitEntry(io, { ...task, watchers: [...(task.watchers || []), ...added] }, discussion, entry);

    (async () => {
        const notificationService = require('../../modules/notifications/notificationService');
        const me = await identity().users.findById(userId).catch(() => null);
        await notificationService.taskDiscussionAdded(getIo(io), {
            recipientIds: added.filter((id) => id !== String(userId)),
            adderUsername: me?.username || 'Someone',
            workspaceId: task.workspace,
            taskTitle: task.title,
            taskId: sid(task._id),
        });
    })().catch((err) => logger.warn({ err: err.message }, '[tasks.discussion] added notifications failed'));

    return { added, entry };
}

/** Leave the discussion yourself, or (creator / workspace admin) remove someone who was added. */
async function removeParticipant(userId, taskId, targetId, io = null) {
    if (!isId(targetId)) throw httpError(404, 'Person not found');
    const { task, isManager } = await tasksService()._loadTaskForDiscussion(userId, taskId);
    const self = String(targetId) === String(userId);
    if (!self && !permissionsFor(task, userId, isManager).canModerate) {
        throw httpError(403, 'Only the task creator or a workspace admin can remove people');
    }
    if (sid(task.createdBy) === String(targetId) || (task.assignedTo || []).some((a) => sid(a) === String(targetId))) {
        throw httpError(400, 'The creator and the assignees are always part of the discussion');
    }
    await tasksService()._setWatchers(sid(task._id), { remove: [String(targetId)] });
    const discussion = await touchDiscussion(task, { removeParticipants: [String(targetId)] });
    if (!self) {
        const { TaskComment } = models();
        const doc = await TaskComment.create({
            task: sid(task._id),
            workspace: task.workspace ? sid(task.workspace) : null,
            kind: 'event',
            author: userId,
            event: { type: 'participant_removed', from: String(targetId) },
        });
        const [entry] = await entriesOut([doc.toObject ? doc.toObject() : doc]);
        await emitEntry(io, task, discussion, entry);
    }
    return { removed: String(targetId) };
}

// ── Message → task: link the thread both ways ────────────────────────────────

/**
 * After "Convert to task": a "Task created: …" reply in the message's thread (encrypted with the
 * conversation key the server holds, like other server-authored notices; skipped when the server
 * cannot encrypt for that conversation or the thread is locked), and a `thread_linked` entry in
 * the task's discussion. Never throws.
 */
async function linkTaskToThread({ task, message, userId, io = null }) {
    try {
        const Message = require('../../modules/messages/message.model.js');
        const rootId = sid(message.parentId) || sid(message._id);
        const root = await Message.findById(rootId).lean();
        if (!root) return null;
        let channelName = null;
        if (root.channel) {
            const Channel = require('../channels/channel.model.js');
            channelName = (await Channel.findById(sid(root.channel)).select('name').lean())?.name || null;
        }

        if (dbReady()) {
            const { TaskComment } = models();
            await TaskComment.create({
                task: sid(task._id),
                workspace: task.workspace ? sid(task.workspace) : null,
                kind: 'event',
                author: userId,
                event: { type: 'thread_linked', meta: { messageId: rootId, channelId: sid(root.channel), dmId: sid(root.dm), channelName } },
            });
            await touchDiscussion(task);
        }

        if (root.threadLockedAt) return null;
        const convId = sid(root.channel) || sid(root.dm);
        const convType = root.channel ? 'channel' : 'dm';
        const { encryptForConversation } = require('../../modules/conversations/cryptoUtils');
        let enc;
        try {
            enc = await encryptForConversation(convId, convType, `📋 Task created: ${task.title}`);
        } catch (err) {
            logger.info({ err: err.message }, '[tasks.discussion] thread link reply skipped (cannot encrypt for conversation)');
            return null;
        }
        const reply = await Message.create({
            type: 'message',
            sender: userId,
            payload: { ciphertext: enc.ciphertext, messageIv: enc.messageIv, keyVersion: enc.keyVersion, isEncrypted: true },
            parentId: rootId,
            linkedTaskId: sid(task._id),
            readBy: [userId],
            workspace: root.workspace || null,
            company: root.company || null,
            ...(root.channel ? { channel: sid(root.channel) } : { dm: sid(root.dm) }),
        });
        const updatedParent = await Message.findByIdAndUpdate(rootId, { $inc: { replyCount: 1 }, $set: { lastReplyAt: reply.createdAt || new Date() } }, { new: true }).lean();

        const socket = getIo(io);
        if (socket) {
            const { hydrate } = require('../../identity/hydrate');
            const out = reply.toObject();
            await hydrate(out, { sender: { type: 'user', fields: ['username', 'profilePicture'] } });
            const room = root.channel ? `channel:${sid(root.channel)}` : `dm:${sid(root.dm)}`;
            socket.to(room).emit('thread-reply', { parentId: rootId, reply: out });
            require('../../modules/threads/threads.service').emitThreadCounters(socket, root, updatedParent || {});
        }
        const me = await identity().users.findById(userId).catch(() => null);
        require('../../modules/threads/threads.service')
            .followAndNotify(socket, { parent: root, replierId: userId, senderUsername: me?.username, replyId: reply._id })
            .catch(() => {});
        return reply;
    } catch (err) {
        logger.warn({ err: err.message }, '[tasks.discussion] could not link the task to its thread');
        return null;
    }
}

module.exports = {
    _env: env,
    isExplicitParticipant,
    participantIds,
    permissionsFor,
    eventsForActivity,
    recordActivity,
    linkedThreadFor,
    getDiscussion,
    postComment,
    deleteComment,
    addParticipants,
    removeParticipant,
    linkTaskToThread,
};
