'use strict';

/**
 * Task discussion ↔ linked chat thread, both ways (a task made from a message is linked to that
 * message's thread: TaskDiscussion.thread).
 *
 *   Task comment → thread   The comment is posted in the thread as a reply from its author,
 *                           encrypted with the conversation key the server holds (like other
 *                           server-written replies). The reply points back (Message.taskComment)
 *                           and the comment records it (TaskComment.sync).
 *   Thread reply → task     The reply shows in each linked task's discussion as a comment from
 *                           its author (TaskComment.mirror). Its text stays end-to-end encrypted:
 *                           the entry carries the reply's ciphertext and the apps decrypt it.
 *
 * Each side keeps its own rules (independent authorization):
 *   - a comment goes to the thread only if its author may post there, the thread isn't locked,
 *     and everyone who can read the thread may also see the task (otherwise the thread would
 *     show the task's discussion to people the task is hidden from); the comment then says why
 *     it wasn't shared (sync.reason);
 *   - a reply goes to a task only if its author may see and comment on that task, and in the
 *     task it is shown only to people who can read the thread in chat (on every read and live
 *     event), so the task never shows a conversation to someone outside it.
 *
 * Ownership: the original owns its copy. Deleting a comment deletes its reply in the thread;
 * deleting a reply (for everyone) deletes its copy in the task; editing a reply updates the copy.
 * Deleting a copy only removes it from that side. Copies are never copied again (no loops), the
 * "Task created" reply and other automatic entries are never copied, and every copy has a stable
 * reference to its original, so a retry never makes a second copy. A sync that fails (database or
 * key hiccup) is marked pending and retried by the job below (up to MAX_ATTEMPTS times).
 */

const mongoose = require('mongoose');
const logger = require('../../../utils/logger');

const MAX_ATTEMPTS = 5;
const MAX_AUDIENCE_CHECK = 200; // people checked one by one when the task isn't workspace-wide

// No database (unit tests of other modules, or before it connects): nothing to sync. Overridable in tests.
const env = { dbReady: () => mongoose.connection.readyState === 1 };

const sid = (v) => (v == null ? null : String(v._id || v));
const models = () => require('./taskDiscussion.model');
const Message = () => require('../../modules/messages/message.model.js');
const tasksService = () => require('./tasks.service');

function getIo(io) {
    if (io) return io;
    try { return require('../../socket/getIO').getIO(); } catch { return null; }
}

/** The task as `userId` may see it, or null. */
async function taskFor(userId, taskId) {
    try {
        return await tasksService()._loadTaskForDiscussion(userId, taskId);
    } catch {
        return null;
    }
}

/** The thread (root message id) a task is linked to: TaskDiscussion.thread, else its linked message's thread. */
async function threadOf(task) {
    const { TaskDiscussion } = models();
    const d = await TaskDiscussion.findOne({ task: sid(task._id) }).select('thread').lean();
    if (d?.thread) return sid(d.thread);
    if (!task.linkedMessage) return null;
    const source = await Message().findById(sid(task.linkedMessage)).select('parentId').lean();
    if (!source) return null;
    const root = sid(source.parentId) || sid(source._id);
    await TaskDiscussion.updateOne({ task: sid(task._id) }, { $set: { thread: root }, $setOnInsert: { workspace: task.workspace ? sid(task.workspace) : null } }, { upsert: true }).catch(() => {});
    return root;
}

/** Records the link (called when a task is made from a message). */
async function linkThread(task, rootId) {
    const { TaskDiscussion } = models();
    await TaskDiscussion.updateOne(
        { task: sid(task._id) },
        { $set: { thread: rootId }, $setOnInsert: { workspace: task.workspace ? sid(task.workspace) : null } },
        { upsert: true },
    );
}

/**
 * Everyone who can read a thread in chat: channel members (a public channel: every active member
 * of the workspace), or the DM's people (a group: those who joined before the thread started),
 * active in the workspace.
 */
async function threadReaders(root) {
    const identity = require('../../identity');
    const workspaceId = sid(root.workspace);
    const ws = workspaceId ? await identity.workspaces.findById(workspaceId) : null;
    const active = new Set((ws?.members || []).filter((m) => m?.user && (!m.status || m.status === 'active')).map((m) => sid(m.user)));
    let ids = [];
    if (root.channel) {
        const Channel = require('../channels/channel.model.js');
        const ch = await Channel.findById(sid(root.channel)).select('isPrivate members workspace').lean();
        if (!ch) return new Set();
        ids = ch.isPrivate ? (ch.members || []).map((m) => sid(m.user)) : [...active];
        if (!ws) {
            const w = await identity.workspaces.findById(sid(ch.workspace));
            (w?.members || []).filter((m) => m?.user && (!m.status || m.status === 'active')).forEach((m) => active.add(sid(m.user)));
        }
    } else if (root.dm) {
        const DMSession = require('../../../models/DMSession');
        const dm = await DMSession.findById(sid(root.dm)).select('participants isGroup memberSince workspace').lean();
        if (!dm) return new Set();
        const at = new Date(root.createdAt || 0).getTime();
        ids = (dm.participants || []).map(sid).filter((u) => {
            if (!dm.isGroup) return true;
            const row = (dm.memberSince || []).find((m) => sid(m.user) === u);
            return !row?.at || new Date(row.at).getTime() <= at + 999;
        });
        if (!ws) {
            const w = await identity.workspaces.findById(sid(dm.workspace));
            (w?.members || []).filter((m) => m?.user && (!m.status || m.status === 'active')).forEach((m) => active.add(sid(m.user)));
        }
    }
    return new Set(ids.filter((u) => active.has(u)));
}

/** Whether everyone who reads the thread may also see the task. */
async function threadAudienceSeesTask(root, task) {
    const readers = await threadReaders(root);
    const sameWorkspace = sid(task.workspace) && sid(task.workspace) === sid(root.workspace);
    // A workspace-wide task: every active member of its workspace sees it.
    if (task.visibility === 'workspace' && sameWorkspace && !task.deleted) return true;
    if (readers.size > MAX_AUDIENCE_CHECK) return false;
    for (const u of readers) {
        if (!(await taskFor(u, sid(task._id)))) return false;
    }
    return true;
}

async function setCommentSync(commentId, sync) {
    const { TaskComment } = models();
    await TaskComment.updateOne({ _id: commentId }, { $set: { sync: { ...sync, at: new Date() } } });
}

// ── Task comment → thread ────────────────────────────────────────────────────

/** The text a comment shows in chat: its words, and its files by name. */
function commentText(comment) {
    const files = (comment.attachments || []).map((a) => `📎 ${a.name || 'file'}`);
    return [String(comment.text || '').trim(), ...files].filter(Boolean).join('\n');
}

/**
 * Posts a task comment in the task's linked thread (see the top of this file). Returns the
 * comment's sync state: { state: 'synced' | 'skipped' | 'pending' | 'none', reason?, messageId? }.
 */
async function commentToThread(comment, task, io = null) {
    if (!env.dbReady()) return { state: 'none' };
    if (!comment || comment.kind !== 'comment' || comment.deletedAt || comment.mirror?.messageId) return { state: 'none' };
    const rootId = await threadOf(task);
    if (!rootId) return { state: 'none' };
    const attempts = (comment.sync?.attempts || 0) + 1;
    try {
        // Already posted (a retry after a lost answer): keep that reply.
        const existing = await Message().findOne({ taskComment: sid(comment._id) }).select('_id').lean();
        if (existing) {
            const s = { state: 'synced', messageId: sid(existing._id), attempts };
            await setCommentSync(comment._id, s);
            return s;
        }
        const root = await Message().findById(rootId).lean();
        const skip = async (reason) => {
            const s = { state: 'skipped', reason, attempts };
            await setCommentSync(comment._id, s);
            return s;
        };
        if (!root || root.isDeletedUniversally || root.isDeleted) return skip('thread_gone');
        if (root.threadLockedAt) return skip('thread_locked');
        const { checkThreadAccess } = require('../../modules/threads/threadAccess');
        const access = await checkThreadAccess(root, sid(comment.author), { forWrite: true });
        if (!access.ok) return skip('author_cannot_post');
        if (!(await threadAudienceSeesTask(root, task))) return skip('audience');
        const text = commentText(comment);
        if (!text) return skip('empty');

        const { encryptForConversation } = require('../../modules/conversations/cryptoUtils');
        const convId = sid(root.channel) || sid(root.dm);
        const enc = await encryptForConversation(convId, root.channel ? 'channel' : 'dm', text);
        const reply = await require('../../modules/threads/threads.service').postEncryptedReply(getIo(io), {
            parent: root,
            senderId: sid(comment.author),
            ciphertext: enc.ciphertext,
            messageIv: enc.messageIv,
            keyVersion: enc.keyVersion,
            extra: { taskComment: sid(comment._id), taskCommentTask: sid(task._id), clientMessageId: `taskc:${sid(comment._id)}` },
        });
        const s = { state: 'synced', messageId: sid(reply._id), attempts };
        await setCommentSync(comment._id, s);
        return s;
    } catch (err) {
        // The same comment raced itself (unique per sender + clientMessageId): the other one won.
        if (err?.code === 11000) {
            const won = await Message().findOne({ taskComment: sid(comment._id) }).select('_id').lean().catch(() => null);
            if (won) {
                const s = { state: 'synced', messageId: sid(won._id), attempts };
                await setCommentSync(comment._id, s).catch(() => {});
                return s;
            }
        }
        logger.warn({ err: err?.message, commentId: sid(comment._id) }, '[taskSync] comment → thread failed; will retry');
        const s = { state: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', reason: 'error', attempts };
        await setCommentSync(comment._id, s).catch(() => {});
        return s;
    }
}

/** A comment was deleted: its reply in the thread goes too (deleted for everyone). */
async function commentDeleted(comment, io = null, { deletedBy = null } = {}) {
    if (!env.dbReady()) return false;
    try {
        const reply = await Message().findOne({ taskComment: sid(comment._id), isDeletedUniversally: { $ne: true } }).lean();
        if (!reply) return false;
        await deleteReplyEverywhere(reply, getIo(io), deletedBy);
        return true;
    } catch (err) {
        logger.warn({ err: err?.message }, '[taskSync] could not delete the comment\'s thread reply');
        return false;
    }
}

async function deleteReplyEverywhere(reply, io, deletedBy = null) {
    // As "delete for everyone" in chat (messages.service deleteMessage).
    const now = new Date();
    let deletedByName = null;
    if (deletedBy) deletedByName = (await require('../../identity').users.findById(deletedBy).catch(() => null))?.username || null;
    await Message().updateOne({ _id: reply._id }, {
        $set: { isDeleted: true, isDeletedUniversally: true, deletedAt: now, deletedBy: deletedBy || reply.sender, deletedByName },
    });
    const threads = require('../../modules/threads/threads.service');
    const counters = await threads.recountThread(sid(reply.parentId)).catch(() => null);
    if (io) {
        const { emitAboutMessage } = require('../../modules/conversations/conversationRooms');
        const parent = await Message().findById(sid(reply.parentId)).select('createdAt channel dm').lean();
        await emitAboutMessage(io, reply, 'message:deleted', {
            messageId: sid(reply._id), dm: sid(reply.dm), channel: sid(reply.channel), parentId: sid(reply.parentId),
            deletedBy: deletedBy || sid(reply.sender), deletedByName, deletedAt: now,
        }, { anchor: parent });
        if (counters && parent) threads.emitThreadCounters(io, parent, counters);
    }
}

// ── Thread reply → task ──────────────────────────────────────────────────────

/** A reply that is never copied into a task. */
function notCopied(reply) {
    return !reply || reply.type === 'system' || reply.taskComment || reply.linkedTaskId
        || reply.isDeletedUniversally || reply.isDeleted || !reply.payload?.ciphertext;
}

/**
 * Copies a new thread reply into every task linked to its thread (see the top of this file).
 * Returns the number of tasks it was added to. Never throws; a failure marks the reply for a retry.
 */
async function replyToTasks(reply, root = null, io = null) {
    if (!env.dbReady() || notCopied(reply) || !reply.parentId) return 0;
    try {
        const { TaskDiscussion, TaskComment } = models();
        const rootId = sid(reply.parentId);
        const links = await TaskDiscussion.find({ thread: rootId }).select('task').lean();
        if (!links.length) return 0;
        const parent = root || await Message().findById(rootId).lean();
        if (!parent) return 0;
        let added = 0;
        for (const { task: taskId } of links) {
            const loaded = await taskFor(sid(reply.sender), sid(taskId));
            // Its author can't see the task (or it is in the trash): it stays in chat only.
            if (!loaded || loaded.task.deleted) continue;
            const already = await TaskComment.findOne({ task: sid(taskId), 'mirror.messageId': sid(reply._id) }).select('_id').lean();
            if (already) continue;
            let doc;
            try {
                doc = await TaskComment.create({
                    task: sid(taskId),
                    workspace: loaded.task.workspace ? sid(loaded.task.workspace) : null,
                    kind: 'comment',
                    author: sid(reply.sender),
                    text: '',
                    mirror: mirrorOf(reply, parent),
                });
            } catch (err) {
                if (err?.code === 11000) continue; // a retry raced the first copy
                throw err;
            }
            added += 1;
            await announceMirror(loaded.task, doc.toObject ? doc.toObject() : doc, parent, getIo(io));
        }
        if (reply.taskMirror) await Message().updateOne({ _id: reply._id }, { $unset: { taskMirror: 1, taskMirrorAttempts: 1 } });
        return added;
    } catch (err) {
        logger.warn({ err: err?.message, messageId: sid(reply._id) }, '[taskSync] thread → task failed; will retry');
        const attempts = (reply.taskMirrorAttempts || 0) + 1;
        await Message().updateOne({ _id: reply._id }, { $set: { taskMirror: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', taskMirrorAttempts: attempts } }).catch(() => {});
        return 0;
    }
}

function mirrorOf(reply, parent) {
    return {
        messageId: sid(reply._id),
        rootId: sid(parent._id),
        rootAt: parent.createdAt || null,
        conversationId: sid(parent.channel) || sid(parent.dm),
        conversationType: parent.channel ? 'channel' : 'dm',
        payload: { ciphertext: reply.payload.ciphertext, messageIv: reply.payload.messageIv, keyVersion: reply.payload.keyVersion || null },
        hasAttachments: Boolean(reply.attachments?.length),
    };
}

/** Live event and notifications for a copied reply: only to people who can read the thread. */
async function announceMirror(task, doc, parent, io) {
    const { TaskDiscussion } = models();
    const discussion = await TaskDiscussion.findOneAndUpdate(
        { task: sid(task._id) },
        { $set: { lastActivityAt: new Date() }, $inc: { commentCount: 1 } },
        { new: true },
    ).lean();
    const readers = await threadReaders(parent);
    const discussionApi = require('./tasks.discussion');
    const [entry] = await discussionApi._entriesOut([doc]);
    if (io) {
        const audience = await taskAudienceIds(task, discussion);
        const allowed = audience.filter((u) => readers.has(u));
        if (allowed.length) io.to(allowed.flatMap((u) => [`user_${u}`, `user:${u}`])).emit('task:discussion', { taskId: sid(task._id), entry });
    }
    const recipients = discussionApi.participantIds(task, discussion).filter((u) => u !== sid(doc.author) && readers.has(u));
    if (recipients.length && task.workspace) {
        (async () => {
            const notificationService = require('../../modules/notifications/notificationService');
            const me = await require('../../identity').users.findById(sid(doc.author)).catch(() => null);
            await Promise.allSettled(recipients.map((recipientId) => notificationService.taskComment(io, {
                recipientId, commenterUsername: me?.username || 'Someone', workspaceId: task.workspace, taskTitle: task.title, taskId: sid(task._id),
            })));
        })().catch(() => {});
    }
}

/** Who sees the task's live discussion events (as tasks.shared.emitToTaskAudience), as ids. */
async function taskAudienceIds(task, discussion) {
    const ids = new Set(require('./tasks.discussion').participantIds(task, discussion));
    const identity = require('../../identity');
    if (task.visibility === 'workspace' && task.workspace) {
        const members = await identity.workspaces.listMembers(sid(task.workspace), { status: 'active' });
        (members || []).forEach((m) => m?.user && ids.add(sid(m.user)));
    } else if (task.visibility === 'channel' && task.channel) {
        const Channel = require('../channels/channel.model.js');
        const ch = await Channel.findById(sid(task.channel)).select('members').lean();
        (ch?.members || []).forEach((m) => m?.user && ids.add(sid(m.user)));
    }
    return [...ids];
}

/** A reply was deleted for everyone: its copies in tasks go too. */
async function replyDeleted(reply, io = null) {
    if (!env.dbReady()) return 0;
    try {
        const { TaskComment, TaskDiscussion } = models();
        const copies = await TaskComment.find({ 'mirror.messageId': sid(reply._id), deletedAt: null }).lean();
        for (const c of copies) {
            await TaskComment.updateOne({ _id: c._id }, { $set: { deletedAt: new Date(), 'mirror.payload': null } });
            await TaskDiscussion.updateOne({ task: sid(c.task) }, { $inc: { commentCount: -1 } });
            await emitRemoved(c, getIo(io));
        }
        return copies.length;
    } catch (err) {
        logger.warn({ err: err?.message }, '[taskSync] could not remove the reply\'s copies');
        return 0;
    }
}

async function emitRemoved(copy, io) {
    if (!io) return;
    const task = await tasksService()._loadRawTask(sid(copy.task));
    if (!task) return;
    const { emitToTaskAudience } = require('./tasks.shared');
    await emitToTaskAudience(io, task, 'task:discussion-removed', { taskId: sid(copy.task), commentId: sid(copy._id) });
}

/** A reply was edited: its copies show the new text (still encrypted). */
async function replyEdited(reply, io = null) {
    if (!env.dbReady()) return 0;
    try {
        const { TaskComment } = models();
        const copies = await TaskComment.find({ 'mirror.messageId': sid(reply._id), deletedAt: null }).lean();
        if (!copies.length) return 0;
        const payload = { ciphertext: reply.payload?.ciphertext, messageIv: reply.payload?.messageIv, keyVersion: reply.payload?.keyVersion || null };
        await TaskComment.updateMany({ _id: { $in: copies.map((c) => c._id) } }, { $set: { 'mirror.payload': payload, editedAt: new Date() } });
        const parent = await Message().findById(sid(reply.parentId)).lean();
        const sock = getIo(io);
        for (const c of copies) {
            const task = await tasksService()._loadRawTask(sid(c.task));
            if (task && parent && sock) {
                const fresh = await TaskComment.findById(c._id).lean();
                const readers = await threadReaders(parent);
                const { TaskDiscussion } = models();
                const discussion = await TaskDiscussion.findOne({ task: sid(c.task) }).lean();
                const allowed = (await taskAudienceIds(task, discussion)).filter((u) => readers.has(u));
                const [entry] = await require('./tasks.discussion')._entriesOut([fresh]);
                if (allowed.length) sock.to(allowed.flatMap((u) => [`user_${u}`, `user:${u}`])).emit('task:discussion', { taskId: sid(c.task), entry });
            }
        }
        return copies.length;
    } catch (err) {
        logger.warn({ err: err?.message }, '[taskSync] could not update the reply\'s copies');
        return 0;
    }
}

// ── Reading ──────────────────────────────────────────────────────────────────

/** Leaves out copies of thread replies `userId` can't read in chat. */
async function visibleEntries(list, userId) {
    const copies = list.filter((c) => c.mirror?.messageId);
    if (!copies.length) return list;
    const { filterReadable } = require('../../modules/conversations/conversationAccess');
    const readable = new Set((await filterReadable(copies, userId, (c) => ({
        [c.mirror.conversationType === 'channel' ? 'channel' : 'dm']: c.mirror.conversationId,
        createdAt: c.mirror.rootAt || c.createdAt,
    }))).map((c) => sid(c._id)));
    return list.filter((c) => !c.mirror?.messageId || readable.has(sid(c._id)));
}

// ── Retries ──────────────────────────────────────────────────────────────────

/** Retries syncs that failed (both ways). Returns how many were tried. */
async function retryPending(io = null) {
    if (!env.dbReady()) return 0;
    const { TaskComment } = models();
    let tried = 0;
    const comments = await TaskComment.find({ 'sync.state': 'pending', deletedAt: null }).limit(50).lean();
    for (const c of comments) {
        const task = await tasksService()._loadRawTask(sid(c.task));
        if (!task || task.deleted) {
            await setCommentSync(c._id, { state: 'skipped', reason: 'task_gone', attempts: c.sync?.attempts || 0 });
            continue;
        }
        tried += 1;
        await commentToThread(c, task, io);
    }
    const replies = await Message().find({ taskMirror: 'pending' }).limit(50).lean();
    for (const r of replies) {
        tried += 1;
        await replyToTasks(r, null, io);
    }
    return tried;
}

function startTaskThreadSyncJob() {
    const { scheduleJob } = require('../../shared/jobs/scheduler');
    return scheduleJob({ name: 'task-thread-sync', intervalMs: 5 * 60 * 1000, run: () => retryPending() });
}

module.exports = {
    _env: env,
    MAX_ATTEMPTS,
    linkThread,
    threadOf,
    threadReaders,
    threadAudienceSeesTask,
    commentToThread,
    commentDeleted,
    replyToTasks,
    replyDeleted,
    replyEdited,
    visibleEntries,
    retryPending,
    startTaskThreadSyncJob,
};
