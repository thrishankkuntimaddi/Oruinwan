'use strict';

/**
 * Huddle sessions in MongoDB: History, the shared notes, linked tasks and the
 * wrap-up. The socket handlers call the recorder (started/joined/left/ended);
 * the REST routes call the rest.
 *
 * Recorder writes for one huddle run strictly in order (a per-huddle promise
 * chain), so a join can never be written before the session it belongs to.
 * Every write is best-effort: a database hiccup must never break the call.
 *
 * Every run belongs to a meeting record (features/meetings/meetingRecords.js): the
 * scheduled meeting of a "meeting-<id>" huddle, else the ad-hoc huddle's own record,
 * found or created when the run starts. Notes, action items (linked tasks), the
 * summary, recording and transcript of such runs live on the meeting.
 */

const mongoose = require('mongoose');
const logger = require('../../../utils/logger');
const { isValidId, HttpError, getWorkspaceMembership, assertWorkspaceMember } = require('../../shared/utils/workspaceAccess');
const notes = require('./huddleNotes');

const lazy = {
    Session: () => require('./huddleSession.model'),
    Note: () => require('../../../models/Note'),
    Channel: () => require('../../features/channels/channel.model'),
    DMSession: () => require('../../../models/DMSession'),
    Message: () => require('../messages/message.model'),
    registry: () => require('./huddleRegistry').registry,
    sanitize: () => require('../../features/notes/notes.sanitize').sanitizeNoteContent,
    notesNotify: () => require('../../features/notes/notes.notifications'),
    notifications: () => require('../notifications/notificationService'),
    tasks: () => require('../../features/tasks/tasks.service'),
    records: () => require('../../features/meetings/meetingRecords'),
};

/** The run's meeting record id: set at start, or implied by a "meeting-<id>" huddle id. */
function meetingIdOf(session) {
    if (!session) return null;
    if (session.meeting) return idOf(session.meeting);
    return lazy.records().meetingIdFromHuddleId(session.huddleId);
}

/** Links runs to meeting records (live database only). */
const defaultMeetingLink = {
    async started(h) {
        const m = await lazy.records().findOrCreateForHuddle(h);
        return m ? idOf(m._id) : null;
    },
    joined: (meetingId, user) => lazy.records().addAttendee(meetingId, user),
};

const idOf = (v) => String(v?._id || v || '');

// ── Ordered, best-effort queues ─────────────────────────────────────────────

function createQueue() {
    const chains = new Map();
    const run = (key, fn) => {
        const prev = chains.get(key) || Promise.resolve();
        const p = prev.then(fn);
        const settled = p.catch(() => {});
        chains.set(key, settled);
        settled.then(() => { if (chains.get(key) === settled) chains.delete(key); });
        return p;
    };
    const idle = (key) => chains.get(key) || Promise.resolve();
    return { run, idle };
}

// ── Recorder (socket lifecycle -> sessions) ─────────────────────────────────

function scopeOf(h) {
    if (h.channelId) return 'channel';
    if (h.dmId) return 'dm';
    return 'workspace';
}

/**
 * @param {object} deps  Session model, clock and "is the DB up" check (injectable for tests).
 */
function createRecorder({
    Session = null,
    now = () => new Date(),
    isConnected = () => mongoose.connection.readyState === 1,
    meetingLink = null,
} = {}) {
    const model = () => Session || lazy.Session();
    const queue = createQueue();
    // huddleId -> meeting record id of its open run (this process).
    const meetingOf = new Map();
    const linkMeeting = async (h) => {
        if (!meetingLink) return null;
        try {
            return await meetingLink.started(h);
        } catch (err) {
            logger.warn(`[huddles] meeting record for ${h.huddleId} failed: ${err.message}`);
            return null;
        }
    };
    const write = (huddleId, label, fn) => {
        if (!isConnected()) return Promise.resolve(null);
        return queue.run(huddleId, fn).catch((err) => {
            logger.warn(`[huddles] history ${label} failed for ${huddleId}: ${err.message}`);
            return null;
        });
    };

    return {
        /** A huddle came to life (first start or join after it was empty). */
        started(h) {
            return write(h.huddleId, 'start', async () => {
                const S = model();
                // A previous run of the same id that never closed (server restart): close it now.
                await S.updateMany({ huddleId: h.huddleId, endedAt: null }, { $set: { endedAt: now() } });
                const meetingId = await linkMeeting(h);
                if (meetingId) meetingOf.set(h.huddleId, meetingId);
                return S.create({
                    meeting: isValidId(meetingId) ? meetingId : null,
                    huddleId: h.huddleId,
                    workspace: isValidId(h.workspaceId) ? h.workspaceId : null,
                    scope: scopeOf(h),
                    channel: isValidId(h.channelId) ? h.channelId : null,
                    dm: isValidId(h.dmId) ? h.dmId : null,
                    channelName: h.channelName || null,
                    video: !!h.video,
                    startedBy: isValidId(h.startedBy?._id) ? h.startedBy._id : null,
                    startedByName: h.startedBy?.username || '',
                    startedAt: h.startedAt || now(),
                });
            });
        },

        joined(huddleId, { userId, username }) {
            if (!isValidId(userId)) return Promise.resolve(null);
            return write(huddleId, 'join', async () => {
                const S = model();
                const back = await S.updateOne(
                    { huddleId, endedAt: null, 'participants.user': userId },
                    { $set: { 'participants.$.leftAt': null, 'participants.$.username': username || '' } },
                );
                const result = back.matchedCount ? back : await S.updateOne(
                    { huddleId, endedAt: null },
                    { $push: { participants: { user: userId, username: username || '', joinedAt: now(), leftAt: null } } },
                );
                if (meetingLink) {
                    let meetingId = meetingOf.get(huddleId);
                    if (!meetingId) {
                        // The run was started on another instance.
                        const open = await S.findOne({ huddleId, endedAt: null }).select('meeting').lean();
                        meetingId = open?.meeting ? idOf(open.meeting) : null;
                        if (meetingId) meetingOf.set(huddleId, meetingId);
                    }
                    if (meetingId) await meetingLink.joined(meetingId, { userId, username }).catch(() => {});
                }
                return result;
            });
        },

        left(huddleId, userId) {
            if (!isValidId(userId)) return Promise.resolve(null);
            return write(huddleId, 'leave', () => model().updateOne(
                { huddleId, endedAt: null, 'participants.user': userId },
                { $set: { 'participants.$.leftAt': now() } },
            ));
        },

        ended(huddleId) {
            meetingOf.delete(huddleId);
            return write(huddleId, 'end', async () => {
                const at = now();
                const result = await model().updateOne(
                    { huddleId, endedAt: null },
                    { $set: { endedAt: at, 'participants.$[p].leftAt': at } },
                    { arrayFilters: [{ 'p.leftAt': null }] },
                );
                // Notes opened during the call but never written in aren't kept.
                await dropBlankNotes(model(), huddleId).catch((err) => logger.warn?.('[huddle] blank-note cleanup failed:', err?.message));
                return result;
            });
        },

        /**
         * Whether this huddle's last run is over: it was recorded and closed. A run that was never
         * closed (the server restarted mid-call) is not over, so its people can rejoin it.
         */
        async hasEnded(huddleId) {
            if (!isConnected()) return false;
            await queue.idle(huddleId);
            const S = model();
            if (await S.exists({ huddleId, endedAt: null })) return false;
            return !!(await S.exists({ huddleId }));
        },

        /** Resolves once every queued write for this huddle has finished. */
        whenIdle: (huddleId) => queue.idle(huddleId),
    };
}

/** Deletes the shared notes of a huddle's latest run when nobody wrote anything in them. */
async function dropBlankNotes(Session, huddleId) {
    const run = await Session.findOne({ huddleId, notes: { $ne: null } }).sort({ startedAt: -1 }).select('_id notes').lean();
    if (!run?.notes) return false;
    const Note = lazy.Note();
    const note = await Note.findById(run.notes).select('content').lean();
    if (!note || !notes.isBlankNote(note.content)) return false;
    await Note.deleteOne({ _id: run.notes });
    await Session.updateOne({ _id: run._id }, { $set: { notes: null } });
    return true;
}

const recorder = createRecorder({ meetingLink: defaultMeetingLink });

// ── Access ──────────────────────────────────────────────────────────────────

const isParticipant = (session, userId) => (session.participants || []).some((p) => idOf(p.user) === String(userId));

async function canView(session, userId) {
    if (isParticipant(session, userId)) return true;
    if (session.scope === 'channel' && session.channel) {
        const channel = await lazy.Channel().findById(session.channel).select('members');
        return !!channel && channel.isMember(String(userId));
    }
    if (session.scope === 'dm' && session.dm) {
        const dm = await lazy.DMSession().findById(session.dm).select('participants').lean();
        return !!dm && (dm.participants || []).some((p) => idOf(p) === String(userId));
    }
    if (session.workspace) {
        const access = await getWorkspaceMembership(idOf(session.workspace), userId);
        return !!access?.member;
    }
    return false;
}

/** The running session of a huddle, else its most recent one. */
async function findSession(huddleId) {
    await recorder.whenIdle(huddleId);
    const S = lazy.Session();
    return (await S.findOne({ huddleId, endedAt: null }).sort({ startedAt: -1 }))
        || S.findOne({ huddleId }).sort({ startedAt: -1 });
}

async function loadAccessible(userId, huddleId) {
    const session = await findSession(huddleId);
    if (!session) throw new HttpError(404, 'Huddle not found');
    if (!(await canView(session, userId))) throw new HttpError(403, 'You do not have access to this huddle');
    return session;
}

/** In the call right now, or was in this run of it. */
function assertMember(session, userId) {
    const live = !session.endedAt && !!lazy.registry().participant(session.huddleId, userId);
    if (!live && !isParticipant(session, userId)) throw new HttpError(403, 'Only people in this huddle can do that');
}

// ── Serialising ─────────────────────────────────────────────────────────────

function serialize(s, { live = false } = {}) {
    const people = (s.participants || []).map((p) => ({
        userId: idOf(p.user), username: p.username || 'Someone', joinedAt: p.joinedAt, leftAt: p.leftAt,
    }));
    // A run that never closed and is not live any more (server restart): ended when the last person left.
    let endedAt = s.endedAt || null;
    if (!endedAt && !live) {
        const lefts = people.map((p) => p.leftAt).filter(Boolean).map((d) => new Date(d).getTime());
        endedAt = lefts.length ? new Date(Math.max(...lefts)) : null;
    }
    const start = new Date(s.startedAt).getTime();
    const end = endedAt ? new Date(endedAt).getTime() : Date.now();
    return {
        id: idOf(s._id),
        huddleId: s.huddleId,
        meetingId: meetingIdOf(s),
        scope: s.scope,
        workspaceId: s.workspace ? idOf(s.workspace) : null,
        channelId: s.channel ? idOf(s.channel) : null,
        dmId: s.dm ? idOf(s.dm) : null,
        channelName: s.channelName || null,
        video: !!s.video,
        startedBy: s.startedBy ? { _id: idOf(s.startedBy), username: s.startedByName || '' } : null,
        startedAt: s.startedAt,
        endedAt,
        live,
        durationSec: Math.max(0, Math.round((end - start) / 1000)),
        participants: people,
        notesId: s.notes ? idOf(s.notes) : null,
        linkedTaskIds: (s.linkedTasks || []).map(idOf),
        recording: s.recording?.path ? {
            mimeType: s.recording.mimeType,
            size: s.recording.size,
            durationSec: s.recording.durationSec ?? null,
            uploadedBy: s.recording.uploadedBy ? idOf(s.recording.uploadedBy) : null,
            uploadedAt: s.recording.uploadedAt,
        } : null,
        ...(Array.isArray(s.transcriptSegments) ? { transcriptSegmentCount: s.transcriptSegments.length } : {}),
        summary: s.summary?.message ? {
            messageId: idOf(s.summary.message),
            channelId: s.summary.channel ? idOf(s.summary.channel) : null,
            dmId: s.summary.dm ? idOf(s.summary.dm) : null,
            postedAt: s.summary.postedAt,
            postedBy: idOf(s.summary.postedBy),
        } : null,
    };
}

const isLive = (s) => !s.endedAt && !!lazy.registry().get(s.huddleId);

// ── Queries ─────────────────────────────────────────────────────────────────

/** Past huddles this user may see in a workspace, newest first. */
async function listHistory(userId, workspaceId, { limit = 30 } = {}) {
    await assertWorkspaceMember(workspaceId, userId);
    const channels = await lazy.Channel().find({ workspace: workspaceId, 'members.user': userId }).select('_id').lean();
    const sessions = await lazy.Session().find({
        workspace: workspaceId,
        $or: [
            { 'participants.user': userId },
            { scope: 'channel', channel: { $in: channels.map((c) => c._id) } },
            { scope: 'workspace' },
        ],
    }).select('-transcriptSegments').sort({ startedAt: -1 }).limit(Math.min(Math.max(Number(limit) || 30, 1), 100)).lean();
    // Live runs belong in "Live now"; runs nobody joined are noise.
    return sessions
        .filter((s) => !isLive(s) && (s.participants || []).length > 0)
        .map((s) => serialize(s));
}

async function getSession(userId, huddleId) {
    const session = await loadAccessible(userId, huddleId);
    return serialize(session, { live: isLive(session) });
}

// ── Shared notes ────────────────────────────────────────────────────────────

const notesQueue = createQueue();

async function activeMembers(workspaceId) {
    const access = await getWorkspaceMembership(workspaceId, null);
    return new Set((access?.workspace?.members || [])
        .filter((m) => (m.status || 'active') === 'active')
        .map((m) => idOf(m.user)));
}

/** Lean note with owner / sharedWith attached from PostgreSQL (users moved off MongoDB). */
async function withNoteUsers(query) {
    const note = await query;
    if (note) {
        const CARD = { type: 'user', fields: ['username', 'profilePicture'] };
        await require('../../identity/hydrate').hydrate(note, { owner: CARD, sharedWith: CARD });
    }
    return note;
}

async function emitShared(io, noteId, userId) {
    if (!io) return;
    const Note = lazy.Note();
    const populated = await withNoteUsers(Note.findById(noteId).select('-versions').lean());
    if (populated) io.to(`user_${userId}`).emit('note-shared', populated);
}

/**
 * The huddle's notes: created by the first person who opens the Notes tab,
 * shared (editable) with everyone who was in the call. Returns { noteId, created }.
 */
async function ensureNotes(userId, huddleId, io) {
    const session = await loadAccessible(userId, huddleId);
    assertMember(session, userId);
    if (!session.workspace) throw new HttpError(400, 'Notes need a workspace');

    // A meeting's huddle uses the meeting's notes: the same Note for every run.
    const meetingId = meetingIdOf(session);
    if (meetingId) {
        const { noteId, created } = await lazy.records().ensureNote(meetingId, userId, { io });
        if (idOf(session.notes) !== noteId) await lazy.Session().updateOne({ _id: session._id }, { $set: { notes: noteId } });
        if (io && idOf(session.notes) !== noteId) io.to(`huddle:${huddleId}`).emit('huddle:notes_ready', { huddleId, noteId, meetingId });
        if (created && io) {
            const populated = await withNoteUsers(lazy.Note().findById(noteId).select('-versions').lean());
            if (populated) lazy.notesNotify().notifyNoteCreated(populated, io);
        }
        return { noteId, created, meetingId };
    }

    return notesQueue.run(`notes:${session._id}`, async () => {
        const Session = lazy.Session();
        const Note = lazy.Note();
        const fresh = await Session.findById(session._id);
        const wsId = idOf(fresh.workspace);

        if (fresh.notes) {
            const note = await Note.findById(fresh.notes).select('owner sharedWith isArchived');
            if (note) {
                const already = idOf(note.owner) === String(userId) || (note.sharedWith || []).some((u) => idOf(u) === String(userId));
                if (!already && (await activeMembers(wsId)).has(String(userId))) {
                    await Note.updateOne({ _id: note._id }, { $addToSet: { sharedWith: userId } });
                    await emitShared(io, note._id, userId).catch(() => {});
                }
                return { noteId: idOf(note._id), created: false };
            }
        }

        const members = await activeMembers(wsId);
        const live = lazy.registry().get(huddleId);
        const people = new Set([
            ...(fresh.participants || []).map((p) => idOf(p.user)),
            ...(live ? [...live.participants.keys()] : []),
        ].filter((id) => isValidId(id) && members.has(id)));
        people.delete(String(userId));

        const access = await getWorkspaceMembership(wsId, userId);
        const note = await Note.create({
            company: access?.workspace?.company || null,
            workspace: wsId,
            owner: userId,
            title: notes.notesTitle({ channelName: fresh.channelName, startedAt: fresh.startedAt }),
            content: JSON.stringify(notes.initialBlocks()),
            type: 'meeting',
            channel: fresh.channel || null,
            meetingDate: fresh.startedAt,
            meetingParticipants: [String(userId), ...people],
            sharedWith: [...people],
            allowEditing: true,
            tags: ['huddle'],
        });
        await Session.updateOne({ _id: fresh._id }, { $set: { notes: note._id } });

        if (io) {
            const populated = await withNoteUsers(Note.findById(note._id).select('-versions').lean());
            lazy.notesNotify().notifyNoteCreated(populated, io);
            io.to(`huddle:${huddleId}`).emit('huddle:notes_ready', { huddleId, noteId: idOf(note._id) });
        }
        return { noteId: idOf(note._id), created: true };
    });
}

// The Notes app hears about huddle edits at most every few seconds (not per keystroke).
const NOTE_BROADCAST_MS = 4000;
const broadcastTimers = new Map();
function scheduleNoteUpdated(io, noteId) {
    if (!io || broadcastTimers.has(noteId)) return;
    const t = setTimeout(async () => {
        broadcastTimers.delete(noteId);
        try {
            const populated = await withNoteUsers(lazy.Note().findById(noteId).select('-versions').lean());
            if (populated) lazy.notesNotify().notifyNoteUpdated(populated, io);
        } catch (err) {
            logger.warn(`[huddles] note-updated broadcast failed: ${err.message}`);
        }
    }, NOTE_BROADCAST_MS);
    if (t.unref) t.unref();
    broadcastTimers.set(noteId, t);
}

/**
 * Apply one notes operation for someone in the call (see huddleNotes.applyOp).
 * Operations on one note run one at a time. Returns { noteId, applied }.
 */
async function applyNotesOp({ userId, username, huddleId, op, io }) {
    const session = await findSession(huddleId);
    const meetingId = meetingIdOf(session);
    if (meetingId && op && (op.kind === 'action' || op.kind === 'action_remove')) {
        // Action items of a meeting's huddle are the meeting's action items.
        if (session.endedAt || !lazy.registry().participant(huddleId, userId)) throw new HttpError(403, 'Only people in this huddle can edit its action items');
        const applied = await lazy.records().applyHuddleActionOp(meetingId, op, { userId, io });
        return { noteId: session.notes ? idOf(session.notes) : null, applied, meetingId };
    }
    if (!session || !session.notes) throw new HttpError(404, 'This huddle has no notes yet');
    if (session.endedAt || !lazy.registry().participant(huddleId, userId)) throw new HttpError(403, 'Only people in this huddle can edit its notes');
    const noteId = idOf(session.notes);

    return notesQueue.run(`note:${noteId}`, async () => {
        const note = await lazy.Note().findById(noteId);
        if (!note || note.isArchived) throw new HttpError(404, 'These notes were deleted or archived');
        const { blocks, applied } = notes.applyOp(notes.parseBlocks(note.content), op, { author: username || null });
        note.content = lazy.sanitize()(JSON.stringify(blocks));
        await note.save();
        scheduleNoteUpdated(io, noteId);
        return { noteId, applied };
    });
}

// ── Tasks ───────────────────────────────────────────────────────────────────

async function linkTask(userId, huddleId, taskId, io) {
    if (!isValidId(taskId)) throw new HttpError(400, 'Invalid task id');
    const session = await loadAccessible(userId, huddleId);
    assertMember(session, userId);
    const task = await lazy.tasks().getTask(userId, taskId); // throws when the user cannot see it
    const meetingId = meetingIdOf(session);
    if (meetingId) {
        // A meeting's huddle: the task becomes one of the meeting's action items.
        const taskIds = await lazy.records().linkTask(meetingId, { ...(task?.task || task || {}), _id: taskId }, { userId, io });
        if (io) io.to(`huddle:${huddleId}`).emit('huddle:tasks_linked', { huddleId, taskIds, meetingId });
        return { taskIds, meetingId };
    }
    const updated = await lazy.Session().findOneAndUpdate({ _id: session._id }, { $addToSet: { linkedTasks: taskId } }, { new: true });
    const taskIds = (updated?.linkedTasks || []).map(idOf);
    if (io) io.to(`huddle:${huddleId}`).emit('huddle:tasks_linked', { huddleId, taskIds });
    return { taskIds };
}

async function unlinkTask(userId, huddleId, taskId, io) {
    if (!isValidId(taskId)) throw new HttpError(400, 'Invalid task id');
    const session = await loadAccessible(userId, huddleId);
    assertMember(session, userId);
    const meetingId = meetingIdOf(session);
    if (meetingId) {
        const taskIds = await lazy.records().unlinkTask(meetingId, taskId, { io });
        if (io) io.to(`huddle:${huddleId}`).emit('huddle:tasks_linked', { huddleId, taskIds, meetingId });
        return { taskIds, meetingId };
    }
    const updated = await lazy.Session().findOneAndUpdate({ _id: session._id }, { $pull: { linkedTasks: taskId } }, { new: true });
    const taskIds = (updated?.linkedTasks || []).map(idOf);
    if (io) io.to(`huddle:${huddleId}`).emit('huddle:tasks_linked', { huddleId, taskIds });
    return { taskIds };
}

// ── Wrap-up ─────────────────────────────────────────────────────────────────

/**
 * The client posted the wrap-up through the normal (E2EE) send path; record it
 * and notify everyone who was in the call. The server never sees the text.
 */
async function recordWrapUp({ userId, username, huddleId, messageId, summaryText, io }) {
    if (!isValidId(messageId)) throw new HttpError(400, 'Invalid message id');
    const session = await loadAccessible(userId, huddleId);
    assertMember(session, userId);

    const message = await lazy.Message().findById(messageId).select('sender channel dm workspace').lean();
    if (!message || idOf(message.sender) !== String(userId)) throw new HttpError(404, 'Message not found');
    const channelId = message.channel ? idOf(message.channel) : null;
    const dmId = message.dm ? idOf(message.dm) : null;
    if (session.scope === 'channel' && channelId !== idOf(session.channel)) throw new HttpError(400, 'Post the summary in the huddle\'s channel');
    if (session.scope === 'dm' && dmId !== idOf(session.dm)) throw new HttpError(400, 'Post the summary in the huddle\'s conversation');
    if (session.scope === 'workspace') {
        if (!channelId) throw new HttpError(400, 'Post the summary in a channel');
        const channel = await lazy.Channel().findById(channelId).select('workspace').lean();
        if (!channel || idOf(channel.workspace) !== idOf(session.workspace)) throw new HttpError(400, 'That channel is in another workspace');
    }

    await lazy.Session().updateOne({ _id: session._id }, {
        $set: { summary: { message: messageId, channel: channelId, dm: dmId, postedBy: userId, postedAt: new Date() } },
    });

    // A meeting's huddle: the wrap-up is the meeting's summary. The client sends the text it
    // posted (the chat message itself is end-to-end encrypted); without it the meeting keeps
    // its current summary text and only learns where the wrap-up was posted.
    const meetingId = meetingIdOf(session);
    if (meetingId) {
        const records = lazy.records();
        const text = typeof summaryText === 'string' && summaryText.trim() ? summaryText : undefined;
        await records.setSummary(meetingId, { text, by: userId, source: 'wrap-up', messageId, channelId, dmId }, { io })
            .catch((err) => logger.warn(`[huddles] meeting summary not saved: ${err.message}`));
    }

    let channelName = session.channelName;
    if (channelId && channelId !== idOf(session.channel)) {
        const ch = await lazy.Channel().findById(channelId).select('name').lean();
        channelName = ch?.name || channelName;
    }
    const recipients = [...new Set((session.participants || []).map((p) => idOf(p.user)))].filter((id) => id !== String(userId));
    let notified = [];
    if (recipients.length && session.workspace) {
        notified = await lazy.notifications().createMany(io, recipients, {
            workspaceId: idOf(session.workspace),
            type: 'huddle_started', // shown as "Huddle"; meta.kind tells the summary apart
            title: 'Huddle summary posted',
            body: `${username || 'Someone'} posted the huddle wrap-up${channelName ? ` in #${channelName}` : ''}`,
            link: channelId ? `/channel/${channelId}` : (dmId ? `/dm/${dmId}` : '/huddles?tab=history'),
            meta: { kind: 'huddle_summary', huddleId, meetingId, messageId: String(messageId), channelId, dmSessionId: dmId, channelName },
        });
    }
    if (io) io.to(`huddle:${huddleId}`).emit('huddle:wrapped_up', { huddleId, meetingId, messageId: String(messageId), channelId, dmId, postedBy: String(userId) });
    return { notified: notified.length, recipients: recipients.length, meetingId };
}

module.exports = {
    createRecorder,
    recorder,
    serialize,
    canView,
    listHistory,
    getSession,
    ensureNotes,
    applyNotesOp,
    linkTask,
    unlinkTask,
    recordWrapUp,
    findSession,
    loadAccessible,
    meetingIdOf,
    defaultMeetingLink,
    assertMember,
    isLive,
    _lazy: lazy,
};
