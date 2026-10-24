'use strict';

/**
 * One meeting record per call (docs/api/meetings-unified.md).
 *
 * Every call has a ScheduledMeeting document: scheduled meetings (kind 'scheduled',
 * huddle id "meeting-<id>") and ad-hoc huddles started in a channel, DM or the
 * workspace (kind 'huddle', created when the huddle starts). The record owns the
 * call's notes (one Note for its whole life), action items, summary, recording and
 * transcript; huddle sessions (HuddleSession) only keep who was in each run.
 *
 * Callers check access first (meetingAccess.loadMeetingForUser / requireMeetingAccess,
 * or the huddle checks for huddle routes); these functions do not.
 */

const mongoose = require('mongoose');
const logger = require('../../../utils/logger');
const { isValidId, HttpError, getWorkspaceMembership, assertWorkspaceMember } = require('../../shared/utils/workspaceAccess');

const lazy = {
    Meeting: () => require('../../models/ScheduledMeeting'),
    Note: () => require('../../../models/Note'),
    Channel: () => require('../channels/channel.model'),
    DMSession: () => require('../../../models/DMSession'),
    Whiteboard: () => require('../collaboration/whiteboard.model'),
    Brainstorm: () => require('../collaboration/brainstorm.model'),
    Notification: () => require('../../modules/notifications/notification.model'),
    notifications: () => require('../../modules/notifications/notificationService'),
    users: () => require('../../identity').users,
    hydrate: () => require('../../identity/hydrate').hydrate,
    summarizer: () => require('../ai/ai.summarizer.service'),
    transcript: () => require('./transcript'),
    recordings: () => require('./recordings'),
    conflicts: () => require('./conflicts'),
    huddleNotes: () => require('../../modules/huddles/huddleNotes'),
    sanitize: () => require('../notes/notes.sanitize').sanitizeNoteContent,
    tasks: () => require('../tasks/tasks.service'),
    huddles: () => require('../../modules/huddles/huddles.socket'),
    emitMeetingCompleted: (...args) => require('./meetings.service').emitMeetingCompleted(...args),
    // Extras (board presence, channel names, recap de-duplication, note content checks) are
    // skipped while the database is down instead of waiting on mongoose's buffer.
    dbReady: () => mongoose.connection.readyState === 1,
};

const HUDDLE_PREFIX = 'meeting-';
/** An ad-hoc huddle that comes back to life this soon after ending continues the same record. */
const REOPEN_WINDOW_MS = 2 * 60 * 1000;
/** Ad-hoc huddles at most this long and without content are hidden from Past by default. */
const SHORT_CALL_SEC = 60;
const ACTION_STATUSES = ['pending', 'in_progress', 'done'];
const MAX_ACTION_ITEMS = 300;
const MAX_ACTION_TEXT = 500;
const MAX_SUMMARY = 20000;

// Transcript segments can be large: they are served by GET /:id/transcript only.
const LIGHT = '-transcriptSegments';
const PERSON = { type: 'user', fields: ['username', 'profilePicture', 'profile'] };
const FULL_REFS = { createdBy: PERSON, participants: PERSON, 'actionItems.assignedTo': PERSON };

const idOf = (v) => String(v?._id || v || '');
const lean = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);
const newId = () => new mongoose.Types.ObjectId();

function meetingIdFromHuddleId(huddleId) {
    const hid = String(huddleId || '');
    if (!hid.startsWith(HUDDLE_PREFIX)) return null;
    const id = hid.slice(HUDDLE_PREFIX.length);
    return isValidId(id) ? id : null;
}

/** Per-key promise chain: work for one key runs one at a time (in this process). */
const chains = new Map();
function exclusive(key, fn) {
    const prev = chains.get(key) || Promise.resolve();
    const p = prev.then(fn);
    const settled = p.catch(() => {});
    chains.set(key, settled);
    settled.then(() => { if (chains.get(key) === settled) chains.delete(key); });
    return p;
}

function emitTo(io, rooms, event, payload) {
    if (!io || !rooms.length) return;
    try {
        io.to(rooms.length === 1 ? rooms[0] : rooms).emit(event, payload);
    } catch (err) {
        logger.warn(`[meetings] ${event} not emitted: ${err.message}`);
    }
}

/** The meeting's room plus its live huddle's room. */
const liveRooms = (m) => [`meeting:${idOf(m._id)}`, ...(m.huddleId ? [`huddle:${m.huddleId}`] : [])];

// ── Presenting ──────────────────────────────────────────────────────────────

function conversationOf(m, { channelNames } = {}) {
    if (m.channelId) {
        const id = idOf(m.channelId);
        return { kind: 'channel', id, name: channelNames?.get(id) ?? m.conversationName ?? null };
    }
    if (m.dmSessionId) return { kind: 'dm', id: idOf(m.dmSessionId), name: m.conversationName || null };
    return { kind: 'workspace', id: idOf(m.workspaceId), name: null };
}

function presentActionItem(a) {
    return {
        id: idOf(a._id),
        _id: idOf(a._id),
        text: a.text || '',
        assigneeId: a.assignedTo ? idOf(a.assignedTo) : null,
        assignedTo: a.assignedTo || null, // legacy: a user card on GET /:id, else an id
        dueDate: a.dueDate || null,
        done: a.status === 'done',
        status: a.status || 'pending',
        taskId: a.taskId ? idOf(a.taskId) : null,
        clientId: a.clientId || null,
        source: a.source || 'manual',
        createdBy: a.createdBy ? idOf(a.createdBy) : null,
        createdAt: a.createdAt || null,
    };
}

function presentSummary(m) {
    if (!m.summary) return null;
    const meta = m.summaryMeta || {};
    return {
        text: m.summary,
        generatedAt: meta.generatedAt || null,
        by: meta.by ? idOf(meta.by) : null,
        source: meta.source || null,
        messageId: meta.messageId ? idOf(meta.messageId) : null,
        channelId: meta.channelId ? idOf(meta.channelId) : null,
        dmId: meta.dmId ? idOf(meta.dmId) : null,
    };
}

/**
 * The API shape of a meeting (docs/api/meetings-unified.md). The legacy fields
 * (startTime, duration, participants, recordingUrl, sharedNotes...) stay for older clients.
 */
function present(m, { channelNames, boards, hasTranscript, viewerId = null } = {}) {
    if (!m) return m;
    const {
        summaryMeta: _summaryMeta, transcriptSegments, sharedNotesMigratedAt: _migrated, attendees: rawAttendees, __v: _v,
        conflicts: rawConflicts,
        ...rest
    } = m;
    const id = idOf(m._id);
    const kind = m.kind || 'scheduled';
    const start = m.startTime ? new Date(m.startTime) : null;
    const attendees = (rawAttendees || []).map((a) => ({ userId: idOf(a.user), username: a.username || '', joinedAt: a.joinedAt || null }));
    const attendeeSet = new Set(attendees.map((a) => a.userId));
    const participantIds = (m.participants || []).map(idOf);
    const invitees = (m.invitees || []).length
        ? m.invitees.map(idOf)
        // Older scheduled meetings kept the invite list in participants only.
        : (kind === 'scheduled' ? participantIds.filter((p) => !attendeeSet.has(p)) : []);
    const recording = m.recording?.path ? lazy.recordings().describeRecording(m.recording) : null;
    const segCount = Array.isArray(transcriptSegments) ? transcriptSegments.length : 0;
    return {
        ...rest,
        id,
        _id: id,
        kind,
        title: m.title || '',
        status: m.status,
        workspaceId: idOf(m.workspaceId),
        scheduledStart: kind === 'scheduled' ? m.startTime || null : null,
        scheduledEnd: kind === 'scheduled' && start ? new Date(start.getTime() + (m.duration || 30) * 60e3) : null,
        startedAt: m.startedAt || null,
        endedAt: m.endedAt || null,
        durationSec: m.durationSec ?? null,
        conversation: conversationOf(m, { channelNames }),
        huddleId: m.huddleId || (kind === 'scheduled' ? `${HUDDLE_PREFIX}${id}` : null),
        participantIds,
        invitees,
        attendees,
        agenda: m.agenda || [],
        noteId: m.noteId ? idOf(m.noteId) : null,
        actionItems: (m.actionItems || []).map(presentActionItem),
        summary: presentSummary(m),
        recording,
        recordingUrl: recording ? `/api/v2/meetings/${id}/recording` : (m.recordingUrl || null),
        hasRecording: !!recording || !!m.recordingUrl,
        hasTranscript: !!(hasTranscript || m.hasTranscript || segCount || m.transcript),
        hasContent: !!m.hasContent,
        whiteboard: boards ? boards.whiteboard : null,
        brainstorm: boards ? boards.brainstorm : null,
        sharedNotes: m.sharedNotes || '', // deprecated, read-only
        priority: lazy.conflicts().normalizePriority(m.priority),
        // Clashes with other meetings: titles only for the viewer's own clashes (features/meetings/conflicts.js).
        conflicts: lazy.conflicts().conflictsForViewer(rawConflicts, viewerId),
    };
}

async function channelNamesFor(meetings) {
    const ids = [...new Set(meetings.map((m) => m.channelId && idOf(m.channelId)).filter(Boolean))];
    const names = new Map();
    if (!ids.length || !lazy.dbReady()) return names;
    try {
        const channels = await lazy.Channel().find({ _id: { $in: ids } }).select('name').lean();
        for (const c of channels || []) names.set(idOf(c._id), c.name || null);
    } catch { /* names are cosmetic */ }
    return names;
}

async function boardsFor(meetingId) {
    if (!lazy.dbReady()) return null;
    const [wb, bs] = await Promise.all([
        lazy.Whiteboard().findOne({ meetingId }).select('strokes updatedAt').lean().catch(() => null),
        lazy.Brainstorm().findOne({ meetingId }).select('items updatedAt').lean().catch(() => null),
    ]);
    return {
        whiteboard: { exists: !!wb, strokeCount: (wb?.strokes || []).length, updatedAt: wb?.updatedAt || null },
        brainstorm: { exists: !!bs, itemCount: (bs?.items || []).length, updatedAt: bs?.updatedAt || null },
    };
}

/** One meeting in the full API shape (people attached, board presence). Null when missing. */
async function getMeetingView(meetingId, { viewerId = null } = {}) {
    const M = lazy.Meeting();
    const doc = await M.findById(meetingId).select(LIGHT).lean();
    if (!doc) return null;
    const [hydrated, channelNames, boards, transcriptExists] = await Promise.all([
        lazy.hydrate()(doc, FULL_REFS),
        channelNamesFor([doc]),
        boardsFor(meetingId),
        doc.hasTranscript || doc.transcript || !M.exists ? !!(doc.hasTranscript || doc.transcript)
            : Promise.resolve(M.exists({ _id: meetingId, 'transcriptSegments.0': { $exists: true } })).then(Boolean).catch(() => false),
    ]);
    return present(hydrated || doc, { channelNames, boards, hasTranscript: transcriptExists, viewerId });
}

// ── Huddles → meeting records ───────────────────────────────────────────────

async function dmPartnerNames(dmId, starterId) {
    const dm = await lazy.DMSession().findById(dmId).select('participants').lean();
    const others = (dm?.participants || []).map(idOf).filter((id) => id && id !== String(starterId));
    if (!others.length) return null;
    const users = await lazy.users().findManyByIds(others);
    const names = others.map((id) => users?.get?.(id)?.username).filter(Boolean);
    return names.length ? names.join(', ') : null;
}

function huddleTitle({ channelId, dmId, conversationName }) {
    if (channelId) return conversationName ? `Huddle in #${String(conversationName).replace(/^#/, '')}` : 'Channel huddle';
    if (dmId) return conversationName ? `Huddle with ${conversationName}` : 'Huddle';
    return 'Workspace huddle';
}

/**
 * The meeting record of a huddle that just came to life (registry summary `h`):
 *   - "meeting-<id>": that scheduled meeting goes live;
 *   - else the live record with this huddle id, or one that ended moments ago;
 *   - else a new kind:'huddle' record.
 * Returns the (lean) meeting or null (no workspace / starter).
 */
async function findOrCreateForHuddle(h, { now = new Date() } = {}) {
    if (!h?.huddleId) return null;
    const M = lazy.Meeting();
    const hid = String(h.huddleId);
    const at = h.startedAt ? new Date(h.startedAt) : now;

    const own = meetingIdFromHuddleId(hid);
    if (own) {
        const m = await M.findById(own).select(LIGHT).lean();
        if (!m) return null;
        const set = { huddleId: hid };
        if (m.status !== 'cancelled') set.status = 'live';
        if (!m.startedAt) set.startedAt = at;
        if (m.status === 'completed') set.endedAt = null;
        await M.updateOne({ _id: m._id }, { $set: set });
        return { ...m, ...set };
    }

    const live = await M.findOne({ huddleId: hid, status: 'live' }).sort({ startTime: -1 }).select(LIGHT).lean();
    if (live) return live;

    const recent = await M.findOne({
        huddleId: hid, kind: 'huddle', status: 'completed', endedAt: { $gte: new Date(now.getTime() - REOPEN_WINDOW_MS) },
    }).sort({ startTime: -1 }).select(LIGHT).lean();
    if (recent) {
        await M.updateOne({ _id: recent._id }, { $set: { status: 'live', endedAt: null } });
        return { ...recent, status: 'live', endedAt: null };
    }

    const starter = idOf(h.startedBy);
    if (!isValidId(h.workspaceId) || !isValidId(starter)) return null;
    const channelId = isValidId(h.channelId) ? String(h.channelId) : null;
    const dmId = !channelId && isValidId(h.dmId) ? String(h.dmId) : null;
    let conversationName = channelId ? (h.channelName || null) : null;
    if (dmId) conversationName = await dmPartnerNames(dmId, starter).catch(() => null);
    let companyId = null;
    try {
        companyId = (await getWorkspaceMembership(String(h.workspaceId), null))?.workspace?.company || null;
    } catch { /* optional */ }

    const doc = await M.create({
        kind: 'huddle',
        companyId,
        workspaceId: String(h.workspaceId),
        channelId,
        dmSessionId: dmId,
        conversationName,
        huddleId: hid,
        video: !!h.video,
        createdBy: starter,
        title: huddleTitle({ channelId, dmId, conversationName }).slice(0, 150),
        startTime: at,
        startedAt: at,
        participants: [starter],
        status: 'live',
    });
    return lean(doc);
}

/** Someone joined the meeting's call: they are a participant and an attendee. */
async function addAttendee(meetingId, { userId, username }, { now = new Date() } = {}) {
    if (!isValidId(meetingId) || !isValidId(userId)) return null;
    const M = lazy.Meeting();
    await M.updateOne({ _id: meetingId }, { $addToSet: { participants: userId } });
    return M.updateOne(
        { _id: meetingId, 'attendees.user': { $ne: userId } },
        { $push: { attendees: { user: userId, username: username || '', joinedAt: now } } },
    );
}

/** The latest meeting record of a huddle id (null when it has none). */
async function findByHuddle(huddleId) {
    const own = meetingIdFromHuddleId(huddleId);
    const M = lazy.Meeting();
    if (own) return M.findById(own).select('_id').lean();
    return M.findOne({ huddleId: String(huddleId) }).sort({ startTime: -1 }).select('_id').lean();
}

// ── Notes ───────────────────────────────────────────────────────────────────

const stripHtml = (html) => String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').trim();

/** Blocks for a new meeting note; the old plain-text shared notes become its first paragraphs. */
function initialNoteBlocks(sharedNotes = '') {
    const { textToHtml } = lazy.huddleNotes();
    const stamp = Date.now().toString(36);
    const paragraphs = String(sharedNotes || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const text = paragraphs.length
        ? paragraphs.map((p, i) => ({ id: `p-${stamp}-${i}`, type: 'text', content: textToHtml(p), meta: { migratedFrom: 'sharedNotes' } }))
        : [{ id: `p-${stamp}`, type: 'text', content: '', meta: {} }];
    return [{ id: 'meeting-notes-heading', type: 'heading', content: 'Notes', meta: { level: 3 } }, ...text];
}

/** True when the note holds nothing but headings / empty blocks. */
function isEmptyNoteContent(content) {
    const blocks = lazy.huddleNotes().parseBlocks(content);
    return !blocks.some((b) => {
        if (b.type === 'heading') return false;
        const c = String(b.content ?? '').trim();
        if (!c || c === '[]') return false;
        return b.type === 'text' ? !!stripHtml(c) : true;
    });
}

/** Plain text of a note's text and heading blocks (for summaries). */
async function noteText(noteId) {
    if (!noteId) return '';
    const note = await lazy.Note().findById(noteId).select('content').lean();
    if (!note) return '';
    return lazy.huddleNotes().parseBlocks(note.content)
        .filter((b) => b.type === 'text' || b.type === 'heading')
        .map((b) => stripHtml(b.content))
        .filter(Boolean)
        .join('\n');
}

async function noteHasContent(noteId) {
    if (!noteId || !lazy.dbReady()) return false;
    try {
        const note = await lazy.Note().findById(noteId).select('content').lean();
        return !!note && !isEmptyNoteContent(note.content);
    } catch {
        return false;
    }
}

function noteTitle(m) {
    const d = new Date(m.startedAt || m.startTime || Date.now());
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${m.title || 'Meeting'} — notes — ${date}`.slice(0, 200);
}

/**
 * The meeting's notes: one Note for the meeting's whole life (before, during and after
 * every run of its call). Created on first use; the caller is added to its sharedWith
 * (editable) so the Notes app lists it too. Returns { noteId, created }.
 */
async function ensureNote(meetingId, userId, { io } = {}) {
    if (!isValidId(meetingId)) throw new HttpError(400, 'Invalid meeting id');
    return exclusive(`meeting-note:${meetingId}`, async () => {
        const M = lazy.Meeting();
        const Note = lazy.Note();
        const m = await M.findById(meetingId)
            .select('workspaceId companyId createdBy title startTime startedAt channelId noteId sharedNotes sharedNotesMigratedAt participants invitees huddleId')
            .lean();
        if (!m) throw new HttpError(404, 'Meeting not found');
        const uid = String(userId);

        let note = m.noteId ? await Note.findById(m.noteId).select('owner sharedWith content').lean() : null;
        let created = false;
        if (!note) {
            const owner = isValidId(idOf(m.createdBy)) ? idOf(m.createdBy) : uid;
            const people = [...new Set([...(m.participants || []), ...(m.invitees || []), uid].map(idOf))]
                .filter((id) => id !== owner && isValidId(id));
            const doc = await Note.create({
                company: m.companyId || null,
                workspace: m.workspaceId,
                owner,
                title: noteTitle(m),
                content: lazy.sanitize()(JSON.stringify(initialNoteBlocks(m.sharedNotes))),
                type: 'meeting',
                channel: m.channelId || null,
                meeting: m._id,
                meetingDate: m.startedAt || m.startTime || null,
                meetingParticipants: [owner, ...people],
                sharedWith: people,
                allowEditing: true,
                tags: ['meeting'],
            });
            note = lean(doc);
            await M.updateOne({ _id: m._id }, {
                $set: { noteId: note._id, ...(m.sharedNotes ? { sharedNotesMigratedAt: new Date(), hasContent: true } : {}) },
            });
            created = true;
        } else {
            // Migration: older meetings typed into the plain-text "Shared notes".
            if (m.sharedNotes && !m.sharedNotesMigratedAt && isEmptyNoteContent(note.content)) {
                await Note.updateOne({ _id: note._id }, { $set: { content: lazy.sanitize()(JSON.stringify(initialNoteBlocks(m.sharedNotes))) } });
                await M.updateOne({ _id: m._id }, { $set: { sharedNotesMigratedAt: new Date(), hasContent: true } });
            }
            const shared = idOf(note.owner) === uid || (note.sharedWith || []).some((u) => idOf(u) === uid);
            if (!shared) await Note.updateOne({ _id: note._id }, { $addToSet: { sharedWith: userId } });
        }

        const noteId = idOf(note._id);
        if (created) emitTo(io, liveRooms(m), 'meeting:note_ready', { meetingId: idOf(m._id), noteId });
        return { noteId, created };
    });
}

// ── Action items ────────────────────────────────────────────────────────────

const isNullish = (v) => v === null || v === '' || v === undefined;

/** Validated changes from a request body (REST or huddle op). Throws HttpError(400). */
function actionItemChanges(body = {}, { requireText = false } = {}) {
    const out = {};
    if (body.text !== undefined || requireText) {
        if (typeof body.text !== 'string' || !body.text.trim()) throw new HttpError(400, 'text is required');
        out.text = body.text.trim().slice(0, MAX_ACTION_TEXT);
    }
    const assignee = body.assigneeId !== undefined ? body.assigneeId : body.assignedTo;
    if (assignee !== undefined) {
        if (!isNullish(assignee) && !isValidId(idOf(assignee))) throw new HttpError(400, 'Invalid assigneeId');
        out.assignedTo = isNullish(assignee) ? null : idOf(assignee);
    }
    if (body.dueDate !== undefined) {
        if (!isNullish(body.dueDate) && Number.isNaN(new Date(body.dueDate).getTime())) throw new HttpError(400, 'Invalid dueDate');
        out.dueDate = isNullish(body.dueDate) ? null : new Date(body.dueDate);
    }
    if (body.status !== undefined) {
        if (!ACTION_STATUSES.includes(body.status)) throw new HttpError(400, `status must be one of ${ACTION_STATUSES.join(', ')}`);
        out.status = body.status;
    }
    if (body.done !== undefined) {
        if (typeof body.done !== 'boolean') throw new HttpError(400, 'done must be true or false');
        out.status = body.done ? 'done' : (out.status && out.status !== 'done' ? out.status : 'pending');
    }
    if (body.taskId !== undefined) {
        if (!isNullish(body.taskId) && !isValidId(idOf(body.taskId))) throw new HttpError(400, 'Invalid taskId');
        out.taskId = isNullish(body.taskId) ? null : idOf(body.taskId);
    }
    return out;
}

async function loadItems(meetingId) {
    const m = await lazy.Meeting().findById(meetingId).select('actionItems huddleId').lean();
    if (!m) throw new HttpError(404, 'Meeting not found');
    return m;
}

async function broadcastItems(meetingId, io) {
    const m = await lazy.Meeting().findById(meetingId).select('actionItems huddleId').lean();
    const actionItems = (m?.actionItems || []).map(presentActionItem);
    if (m) emitTo(io, liveRooms(m), 'meeting:action_items_updated', { meetingId: String(meetingId), actionItems });
    return actionItems;
}

function findItem(items, ref) {
    const key = String(ref || '');
    return (items || []).find((a) => idOf(a._id) === key) || (items || []).find((a) => a.clientId && a.clientId === key) || null;
}

/** Add one item. Returns { actionItem, actionItems }. */
async function addActionItem(meetingId, body, { userId = null, source = 'manual', clientId = null, io } = {}) {
    const changes = actionItemChanges(body, { requireText: true });
    const m = await loadItems(meetingId);
    if ((m.actionItems || []).length >= MAX_ACTION_ITEMS) throw new HttpError(409, 'This meeting has too many action items');
    const item = {
        _id: newId(),
        text: changes.text,
        assignedTo: changes.assignedTo ?? null,
        dueDate: changes.dueDate ?? null,
        status: changes.status || 'pending',
        taskId: changes.taskId ?? null,
        clientId: clientId || null,
        source,
        createdBy: isValidId(idOf(userId)) ? idOf(userId) : null,
        createdAt: new Date(),
    };
    await lazy.Meeting().updateOne({ _id: meetingId }, { $push: { actionItems: item }, $set: { hasContent: true } });
    const actionItems = await broadcastItems(meetingId, io);
    return { actionItem: presentActionItem(item), actionItems };
}

/** Patch one item (by id or the huddle panel's clientId). Returns { actionItem, actionItems }. */
async function updateActionItem(meetingId, itemId, body, { io } = {}) {
    const changes = actionItemChanges(body);
    const m = await loadItems(meetingId);
    const item = findItem(m.actionItems, itemId);
    if (!item) throw new HttpError(404, 'Action item not found');
    if (Object.keys(changes).length) {
        const set = {};
        for (const [k, v] of Object.entries(changes)) set[`actionItems.$.${k}`] = v;
        await lazy.Meeting().updateOne({ _id: meetingId, 'actionItems._id': item._id }, { $set: set });
    }
    const actionItems = await broadcastItems(meetingId, io);
    return { actionItem: actionItems.find((a) => a.id === idOf(item._id)) || presentActionItem({ ...item, ...changes }), actionItems };
}

async function toggleActionItem(meetingId, itemId, { io } = {}) {
    const m = await loadItems(meetingId);
    const item = findItem(m.actionItems, itemId);
    if (!item) throw new HttpError(404, 'Action item not found');
    return updateActionItem(meetingId, idOf(item._id), { done: item.status !== 'done' }, { io });
}

async function removeActionItem(meetingId, itemId, { io } = {}) {
    const m = await loadItems(meetingId);
    const item = findItem(m.actionItems, itemId);
    if (!item) throw new HttpError(404, 'Action item not found');
    await lazy.Meeting().updateOne({ _id: meetingId }, { $pull: { actionItems: { _id: item._id } } });
    const actionItems = await broadcastItems(meetingId, io);
    return { removed: idOf(item._id), actionItems };
}

/**
 * Turn an item into a task (assigned to the item's assignee, else the caller) and keep
 * the task id on the item. Returns { actionItem, actionItems, task }.
 */
async function convertActionItem(meetingId, itemId, userId, { io, req, body = {} } = {}) {
    const M = lazy.Meeting();
    const m = await M.findById(meetingId).select('workspaceId channelId title actionItems huddleId').lean();
    if (!m) throw new HttpError(404, 'Meeting not found');
    const item = findItem(m.actionItems, itemId);
    if (!item) throw new HttpError(404, 'Action item not found');
    if (item.taskId) {
        const actionItems = (m.actionItems || []).map(presentActionItem);
        return { actionItem: presentActionItem(item), actionItems, task: null, alreadyConverted: true };
    }
    const assignee = item.assignedTo ? idOf(item.assignedTo) : null;
    const individual = assignee && assignee !== String(userId);
    if (m.workspaceId) {
        const plansSvc = require('../../shared/plans/planService');
        await plansSvc.enforce(plansSvc.assertCanCreateTasks(idOf(m.workspaceId), userId, individual ? { self: 0, others: 1 } : { self: 1, others: 0 }));
    }
    const result = await lazy.tasks().createTask(userId, {
        workspaceId: idOf(m.workspaceId),
        title: item.text.slice(0, 200),
        description: `From the meeting "${m.title || 'Meeting'}" (/meetings/${idOf(m._id)})`,
        assignmentType: individual ? 'individual' : 'self',
        assignedToIds: individual ? [assignee] : [],
        dueDate: item.dueDate || undefined,
        priority: typeof body.priority === 'string' ? body.priority : undefined,
        source: 'manual',
    }, io, req);
    const task = result?.tasks?.[0] || result?.task || null;
    if (!task?._id) throw new HttpError(500, 'The task could not be created');
    await M.updateOne({ _id: meetingId, 'actionItems._id': item._id }, { $set: { 'actionItems.$.taskId': task._id } });
    const actionItems = await broadcastItems(meetingId, io);
    return { actionItem: actionItems.find((a) => a.id === idOf(item._id)), actionItems, task };
}

/**
 * Add several items, skipping texts already in the list (case-insensitive) and repeats.
 * Used by AI extraction and the huddle wrap-up. Returns { added, actionItems }.
 */
async function addActionItemsDeduped(meetingId, items, { userId = null, source = 'ai', io } = {}) {
    const m = await loadItems(meetingId);
    const seen = new Set((m.actionItems || []).map((a) => String(a.text || '').trim().toLowerCase()));
    const room = Math.max(0, MAX_ACTION_ITEMS - (m.actionItems || []).length);
    const fresh = [];
    for (const raw of items || []) {
        const text = String(raw?.text || '').trim().slice(0, MAX_ACTION_TEXT);
        const key = text.toLowerCase();
        if (!text || seen.has(key) || fresh.length >= room) continue;
        seen.add(key);
        const assignee = raw.assigneeId || raw.assignedTo || null;
        fresh.push({
            _id: newId(),
            text,
            assignedTo: assignee && isValidId(idOf(assignee)) ? idOf(assignee) : null,
            dueDate: null,
            status: 'pending',
            taskId: null,
            clientId: null,
            source,
            createdBy: isValidId(idOf(userId)) ? idOf(userId) : null,
            createdAt: new Date(),
        });
    }
    if (fresh.length) {
        await lazy.Meeting().updateOne({ _id: meetingId }, { $push: { actionItems: { $each: fresh } }, $set: { hasContent: true } });
    }
    const actionItems = fresh.length ? await broadcastItems(meetingId, io) : (m.actionItems || []).map(presentActionItem);
    return { added: fresh.length, actionItems };
}

const CLIENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * A huddle panel action-item op (huddle:notes_op kind 'action' | 'action_remove') for a
 * meeting huddle: applied to the meeting's action items. `applied` keeps the panel's
 * shape { id, text, done, taskId, assigneeId } with the panel's own id.
 */
async function applyHuddleActionOp(meetingId, op, { userId, io } = {}) {
    if (op.kind === 'action_remove') {
        const id = String(op.id ?? '');
        if (!CLIENT_ID_RE.test(id)) throw new HttpError(400, 'Invalid id');
        const m = await loadItems(meetingId);
        const item = findItem(m.actionItems, id);
        if (item) await removeActionItem(meetingId, idOf(item._id), { io });
        return { kind: 'action_remove', id };
    }
    const raw = op.item;
    if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Missing action item');
    const id = String(raw.id ?? '');
    if (!CLIENT_ID_RE.test(id)) throw new HttpError(400, 'Invalid id');
    const body = {};
    if (raw.text !== undefined) body.text = String(raw.text);
    if (raw.done !== undefined) body.done = raw.done === true;
    if (raw.taskId !== undefined) body.taskId = raw.taskId && isValidId(String(raw.taskId)) ? String(raw.taskId) : null;
    if (raw.assigneeId !== undefined) body.assigneeId = raw.assigneeId && isValidId(String(raw.assigneeId)) ? String(raw.assigneeId) : null;

    const m = await loadItems(meetingId);
    const existing = findItem(m.actionItems, id);
    let item;
    if (existing) {
        if (body.text !== undefined && !body.text.trim()) delete body.text; // an empty draft keeps the old text
        ({ actionItem: item } = await updateActionItem(meetingId, idOf(existing._id), body, { io }));
    } else {
        // The panel adds an empty row first and types into it: store it once it has text.
        if (!body.text || !body.text.trim()) {
            return { kind: 'action', item: { id, text: body.text || '', done: !!body.done, taskId: body.taskId || null, assigneeId: body.assigneeId || null } };
        }
        ({ actionItem: item } = await addActionItem(meetingId, body, { userId, source: 'huddle', clientId: id, io }));
    }
    return { kind: 'action', item: { id, text: item.text, done: item.done, taskId: item.taskId, assigneeId: item.assigneeId, itemId: item.id } };
}

/** Link an existing task to the meeting: an action item carrying its id (once per task). */
async function linkTask(meetingId, task, { userId, io } = {}) {
    const m = await loadItems(meetingId);
    const taskId = idOf(task._id);
    if (!(m.actionItems || []).some((a) => idOf(a.taskId) === taskId)) {
        const assignee = Array.isArray(task.assignedTo) ? task.assignedTo[0] : task.assignedTo;
        await addActionItem(meetingId, {
            text: String(task.title || 'Task').slice(0, MAX_ACTION_TEXT),
            taskId,
            assigneeId: assignee && isValidId(idOf(assignee)) ? idOf(assignee) : null,
            done: task.status === 'done',
        }, { userId, source: 'task', io });
    }
    return linkedTaskIds(meetingId);
}

async function unlinkTask(meetingId, taskId, { io } = {}) {
    const m = await loadItems(meetingId);
    const item = (m.actionItems || []).find((a) => idOf(a.taskId) === String(taskId));
    if (item) await removeActionItem(meetingId, idOf(item._id), { io });
    return linkedTaskIds(meetingId);
}

async function linkedTaskIds(meetingId) {
    const m = await loadItems(meetingId);
    return (m.actionItems || []).map((a) => a.taskId && idOf(a.taskId)).filter(Boolean);
}

// ── Summary ─────────────────────────────────────────────────────────────────

/** What to summarise: transcript, the meeting's notes, the agenda. */
async function summarySource(m) {
    const transcript = lazy.transcript();
    const parts = [];
    let source = 'none';
    const segments = m.transcriptSegments || [];
    if (segments.length) {
        const names = await require('./meetings.service').speakerNames(segments);
        parts.push(`Transcript:\n${transcript.renderTranscript(segments, { origin: m.startedAt || m.startTime, names })}`);
        source = 'transcript';
    } else if (m.transcript) {
        parts.push(`Transcript:\n${m.transcript}`);
        source = 'transcript';
    }
    const notes = (await noteText(m.noteId).catch(() => '')) || m.sharedNotes || '';
    if (notes.trim()) {
        parts.push(`Notes:\n${notes}`);
        if (source === 'none') source = 'notes';
    }
    const agenda = (m.agenda || []).filter((a) => a?.title);
    if (agenda.length) {
        parts.push(`Agenda:\n${agenda.map((a) => `- ${a.title}${a.notes ? `: ${a.notes}` : ''}`).join('\n')}`);
        if (source === 'none') source = 'agenda';
    }
    return { text: parts.join('\n\n'), source };
}

/**
 * Store the meeting's summary and tell the meeting / its live huddle. Returns the summary
 * object. text undefined keeps the current text (a wrap-up posted without its text).
 */
async function setSummary(meetingId, { text, by = null, source = 'manual', messageId = null, channelId = null, dmId = null }, { io } = {}) {
    let value;
    if (text === undefined) {
        const current = await lazy.Meeting().findById(meetingId).select('summary').lean();
        if (!current) throw new HttpError(404, 'Meeting not found');
        value = current.summary || '';
    } else {
        value = String(text || '').slice(0, MAX_SUMMARY);
    }
    const meta = {
        generatedAt: new Date(),
        by: isValidId(idOf(by)) ? idOf(by) : null,
        source,
        messageId: isValidId(idOf(messageId)) ? idOf(messageId) : null,
        channelId: isValidId(idOf(channelId)) ? idOf(channelId) : null,
        dmId: isValidId(idOf(dmId)) ? idOf(dmId) : null,
    };
    const M = lazy.Meeting();
    const before = await M.findOneAndUpdate(
        { _id: meetingId },
        { $set: { summary: value, summaryMeta: meta, ...(value ? { hasContent: true } : {}) } },
        { new: false },
    ).lean();
    if (!before) throw new HttpError(404, 'Meeting not found');
    const summary = presentSummary({ summary: value, summaryMeta: meta });
    emitTo(io, liveRooms(before), 'meeting:summary_updated', { meetingId: String(meetingId), summary });
    return summary;
}

/**
 * The single summary: AI over the transcript, notes and agenda, saved on the meeting.
 * Returns { summary (object|null), text, source, aiFallback } or null when the meeting is missing.
 */
async function summarize(meetingId, { userId = null, io } = {}) {
    const m = await lazy.Meeting().findById(meetingId).lean();
    if (!m) return null;
    const { text, source } = await summarySource(m);
    if (!text.trim()) return { summary: presentSummary(m), text: m.summary || '', source: 'none', aiFallback: false };
    const { summary, fallback } = await lazy.summarizer().summarizeDocument(text, {
        title: m.title, type: 'meeting', noCache: true, ...(userId ? { context: { userId: String(userId) } } : {}),
    });
    const saved = await setSummary(meetingId, { text: summary || '', by: userId, source: 'ai' }, { io });
    return { summary: saved, text: saved?.text || '', source, aiFallback: !!fallback };
}

// ── Ending ──────────────────────────────────────────────────────────────────

/** Everyone who should hear that the call ended: attendees, participants and the organiser. */
function recapAudience(m) {
    return [...new Set([
        ...(m.attendees || []).map((a) => idOf(a.user)),
        ...(m.participants || []).map(idOf),
        idOf(m.createdBy),
    ].filter((id) => isValidId(id)))];
}

async function sendRecapNotifications(m, recipients, io) {
    if (!recipients.length || !m.workspaceId) return [];
    const meetingId = idOf(m._id);
    let already = [];
    if (!lazy.dbReady()) return [];
    try {
        already = await lazy.Notification().find({ type: 'meeting_recap', 'meta.meetingId': meetingId, recipient: { $in: recipients } })
            .select('recipient').lean();
    } catch { /* best effort: at worst a second recap */ }
    const skip = new Set((already || []).map((n) => idOf(n.recipient)));
    const to = recipients.filter((id) => !skip.has(id));
    if (!to.length) return [];
    const conversation = conversationOf(m);
    return lazy.notifications().createMany(io, to, {
        workspaceId: idOf(m.workspaceId),
        type: 'meeting_recap',
        title: `${m.title || 'Meeting'} ended`,
        body: 'View the recap: notes, action items and summary.',
        link: `/meetings/${meetingId}`,
        meta: {
            kind: 'meeting_recap',
            meetingId,
            meetingKind: m.kind || 'scheduled',
            channelId: conversation.kind === 'channel' ? conversation.id : null,
            dmSessionId: conversation.kind === 'dm' ? conversation.id : null,
        },
    });
}

/**
 * Mark a meeting completed (once: a meeting that is already over is left alone), work out
 * its length, and tell people: 'meeting:ended' to everyone's user room and the meeting room,
 * a 'meeting_recap' notification (not for short, empty ad-hoc calls), 'schedule:updated'
 * to the workspace for scheduled meetings, and "meeting.completed" for automations.
 * Returns the completed (lean) meeting or null.
 */
async function completeMeeting(meetingId, { io = null, endedBy = null, reason = 'ended', now = new Date() } = {}) {
    const M = lazy.Meeting();
    const before = await M.findOneAndUpdate(
        { _id: meetingId, status: { $in: ['live', 'scheduled'] } },
        { $set: { status: 'completed', endedAt: now } },
        { new: false },
    ).select(LIGHT).lean();
    if (!before) return null;

    const durationSec = before.startedAt ? Math.max(0, Math.round((now.getTime() - new Date(before.startedAt).getTime()) / 1000)) : null;
    let hasTranscript = !!(before.hasTranscript || before.transcript);
    if (!hasTranscript && M.exists) {
        hasTranscript = !!(await Promise.resolve(M.exists({ _id: before._id, 'transcriptSegments.0': { $exists: true } })).catch(() => null));
    }
    const hasContent = !!(before.hasContent || (before.actionItems || []).length || before.summary || before.recording?.path
        || hasTranscript || (await noteHasContent(before.noteId)));
    await M.updateOne({ _id: before._id }, { $set: { durationSec, hasContent, hasTranscript } });
    const m = { ...before, status: 'completed', endedAt: now, durationSec, hasContent, hasTranscript };
    const kind = m.kind || 'scheduled';
    const meetingId_ = idOf(m._id);

    const recipients = recapAudience(m);
    const conversation = conversationOf(m);
    emitTo(io, [...recipients.map((id) => `user:${id}`), `meeting:${meetingId_}`], 'meeting:ended', {
        meetingId: meetingId_,
        title: m.title || '',
        kind,
        conversation,
        huddleId: m.huddleId || (kind === 'scheduled' ? `${HUDDLE_PREFIX}${meetingId_}` : null),
        endedAt: now,
        durationSec,
        endedBy: endedBy ? String(endedBy) : null,
        reason,
        timestamp: now,
    });

    if (kind === 'scheduled') {
        emitTo(io, [`workspace:${idOf(m.workspaceId)}`], 'schedule:updated', { meeting: present(m) });
        lazy.emitMeetingCompleted(m, io, { huddleId: m.huddleId || null });
    }

    const worthARecap = kind === 'scheduled' || hasContent || (durationSec ?? 0) > SHORT_CALL_SEC;
    if (worthARecap) {
        await sendRecapNotifications(m, recipients, io)
            .catch((err) => logger.warn(`[meetings] recap notifications failed: ${err.message}`));
    }
    return m;
}

/**
 * "End meeting" from the meeting page: completes the meeting and ends its live huddle
 * for everyone in it. Returns the completed meeting view, or the current one when it was
 * already over; null when missing.
 */
async function endMeeting(meetingId, { io = null, endedBy = null } = {}) {
    const M = lazy.Meeting();
    const exists = await M.findById(meetingId).select('_id huddleId kind').lean();
    if (!exists) return null;
    const done = await completeMeeting(meetingId, { io, endedBy, reason: 'ended' });
    const huddleId = exists.huddleId || ((exists.kind || 'scheduled') === 'scheduled' ? `${HUDDLE_PREFIX}${idOf(exists._id)}` : null);
    if (huddleId && io) {
        try {
            lazy.huddles().endHuddle(io, huddleId, 'meeting_ended');
        } catch (err) {
            logger.warn(`[meetings] could not end the huddle of ${meetingId}: ${err.message}`);
        }
    }
    return { meeting: await getMeetingView(meetingId), completed: !!done };
}

/**
 * A huddle ended: its meeting record(s) are over. That is the meeting with this huddle id
 * ("meeting-<id>" or an ad-hoc huddle's record) and, as before, live scheduled meetings of
 * the huddle's channel or DM. Returns the ids of the *scheduled* meetings completed (they
 * report "meeting.completed" themselves; a plain huddle is reported by huddleMedia).
 */
async function completeForHuddle(huddle, io) {
    if (!huddle) return [];
    const hid = String(huddle.huddleId || '');
    const or = [];
    if (hid) or.push({ huddleId: hid });
    const own = meetingIdFromHuddleId(hid);
    if (own) or.push({ _id: own });
    if (huddle.meetingId && isValidId(huddle.meetingId)) or.push({ _id: String(huddle.meetingId) });
    if (huddle.channelId) or.push({ channelId: huddle.channelId, kind: { $ne: 'huddle' } });
    if (huddle.dmId) or.push({ dmSessionId: huddle.dmId, kind: { $ne: 'huddle' } });
    if (!or.length) return [];
    const live = await lazy.Meeting().find({ status: 'live', $or: or }).select('_id kind').lean();
    const scheduled = [];
    for (const m of live || []) {
        const done = await completeMeeting(m._id, { io, reason: 'huddle_ended' })
            .catch((err) => { logger.warn(`[meetings] could not complete ${m._id}: ${err.message}`); return null; });
        if (done && (done.kind || 'scheduled') === 'scheduled') scheduled.push(idOf(done._id));
    }
    return scheduled;
}

// ── Lists ───────────────────────────────────────────────────────────────────

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Mongo conditions for "meetings this user may open" inside one workspace. */
async function accessConditions(userId, workspaceId) {
    const [channels, dms] = await Promise.all([
        lazy.Channel().find({ workspace: workspaceId, 'members.user': userId }).select('_id').lean(),
        lazy.DMSession().find({ participants: userId }).select('_id').lean(),
    ]);
    return [
        { channelId: null, dmSessionId: null },
        { channelId: { $in: (channels || []).map((c) => c._id) } },
        { dmSessionId: { $in: (dms || []).map((d) => d._id) } },
        { createdBy: userId },
        { participants: userId },
        { invitees: userId },
    ];
}

/** "<ISO date>" or "<ISO date>|<id>" -> { at, id } (null when unusable). */
function parseCursor(value) {
    if (!value) return null;
    const [date, id] = String(value).split('|');
    const at = new Date(date);
    if (Number.isNaN(at.getTime())) return null;
    return { at, id: id && isValidId(id) ? id : null };
}

const cursorOf = (m) => `${new Date(m.startTime).toISOString()}|${idOf(m._id)}`;

const STATUSES = ['upcoming', 'live', 'past'];

/**
 * GET /api/v2/meetings?status=upcoming|live|past. Returns
 * { meetings, hasMore, nextBefore (live/past) | nextAfter (upcoming) }.
 */
async function listMeetings(userId, {
    workspaceId, status, kind, q, before, after, limit, includeShort = false, now = new Date(),
} = {}) {
    await assertWorkspaceMember(workspaceId, userId);
    if (!STATUSES.includes(status)) throw new HttpError(400, `status must be one of ${STATUSES.join(', ')}`);
    if (kind !== undefined && kind !== '' && !['scheduled', 'huddle'].includes(kind)) throw new HttpError(400, 'kind must be scheduled or huddle');
    const cap = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const and = [{ $or: await accessConditions(userId, workspaceId) }];
    const query = { workspaceId };
    if (kind === 'huddle') query.kind = 'huddle';
    else if (kind === 'scheduled') query.kind = { $ne: 'huddle' };
    if (q && String(q).trim()) query.title = { $regex: escapeRegex(String(q).trim().slice(0, 100)), $options: 'i' };

    let sort;
    if (status === 'upcoming') {
        query.status = 'scheduled';
        and.push({ startTime: { $gte: new Date(now.getTime() - 8 * 3600e3) } });
        const c = parseCursor(after);
        if (c) and.push(c.id ? { $or: [{ startTime: { $gt: c.at } }, { startTime: c.at, _id: { $gt: c.id } }] } : { startTime: { $gt: c.at } });
        sort = { startTime: 1, _id: 1 };
    } else {
        query.status = status === 'live' ? 'live' : 'completed';
        if (status === 'past' && !includeShort) {
            and.push({ $or: [{ kind: { $ne: 'huddle' } }, { hasContent: true }, { durationSec: { $gt: SHORT_CALL_SEC } }] });
        }
        const c = parseCursor(before);
        if (c) and.push(c.id ? { $or: [{ startTime: { $lt: c.at } }, { startTime: c.at, _id: { $lt: c.id } }] } : { startTime: { $lt: c.at } });
        sort = { startTime: -1, _id: -1 };
    }
    query.$and = and;

    // Upcoming drops meetings whose time has passed, so read a little more than asked.
    const fetch = status === 'upcoming' ? cap + 21 : cap + 1;
    let rows = await lazy.Meeting().find(query).select(LIGHT).sort(sort).limit(fetch).lean();
    if (status === 'upcoming') {
        rows = rows.filter((m) => new Date(m.startTime).getTime() + (m.duration || 30) * 60e3 > now.getTime());
    }
    const hasMore = rows.length > cap;
    const page = rows.slice(0, cap);
    await lazy.hydrate()(page, { createdBy: PERSON });
    const channelNames = await channelNamesFor(page);
    const meetings = page.map((m) => present(m, { channelNames, viewerId: userId }));
    const last = page[page.length - 1];
    const next = hasMore && last ? cursorOf(last) : null;
    return status === 'upcoming'
        ? { meetings, hasMore, nextAfter: next }
        : { meetings, hasMore, nextBefore: next };
}

module.exports = {
    HUDDLE_PREFIX,
    REOPEN_WINDOW_MS,
    SHORT_CALL_SEC,
    meetingIdFromHuddleId,
    present,
    presentActionItem,
    presentSummary,
    conversationOf,
    getMeetingView,
    findOrCreateForHuddle,
    addAttendee,
    findByHuddle,
    ensureNote,
    noteText,
    isEmptyNoteContent,
    initialNoteBlocks,
    actionItemChanges,
    addActionItem,
    updateActionItem,
    toggleActionItem,
    removeActionItem,
    convertActionItem,
    addActionItemsDeduped,
    applyHuddleActionOp,
    linkTask,
    unlinkTask,
    summarySource,
    setSummary,
    summarize,
    completeMeeting,
    endMeeting,
    completeForHuddle,
    listMeetings,
    _lazy: lazy,
};
