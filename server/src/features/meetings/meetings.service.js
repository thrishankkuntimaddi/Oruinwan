'use strict';

const ScheduledMeeting = require('../../models/ScheduledMeeting');
const availability = require('./availability');
const transcript = require('./transcript');

// Users live in PostgreSQL: attach them with hydrate (Mongoose populate cannot reach them).
const { hydrate } = require('../../identity/hydrate');

const PERSON = { type: 'user', fields: ['username', 'profilePicture', 'profile'] };

// One record per call (scheduled meetings and ad-hoc huddles): see meetingRecords.js.
const records = () => require('./meetingRecords');

// Transcript segments can be large: they are served by GET /:id/transcript only.
const LIGHT = '-transcriptSegments';

async function populateMeeting(meeting) {
    return records().getMeetingView(meeting._id);
}

/**
 * Legacy list (no ?status): scheduled meetings of the workspace, newest first. Ad-hoc
 * huddle records are left out here; GET /api/v2/meetings?status=... lists them.
 */
async function getMeetings({ workspaceId, userId, companyId, limit = 20, includeCompleted = true }) {
    const query = { workspaceId, kind: { $ne: 'huddle' } };
    if (companyId) query.companyId = companyId;
    if (!includeCompleted) {
        query.status = { $in: ['scheduled', 'live'] };
    }
    const meetings = await ScheduledMeeting
        .find(query)
        .select(LIGHT)
        .sort({ startTime: -1 })
        .limit(Number(limit))
        .lean();
    return hydrate(meetings, { createdBy: PERSON });
}

async function getMeeting(meetingId) {
    return records().getMeetingView(meetingId);
}

async function joinMeeting(meetingId, userId, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const current = await ScheduledMeeting.findOne(query).select('status startedAt').lean();
    if (!current) return null;
    const set = {};
    if (current.status !== 'cancelled') set.status = 'live';
    if (current.status === 'completed') set.endedAt = null;
    if (!current.startedAt) set.startedAt = new Date();
    const meeting = await ScheduledMeeting.findOneAndUpdate(
        query,
        { $set: set, $addToSet: { participants: userId } },
        { new: true }
    );
    if (!meeting) return null;
    return populateMeeting(meeting);
}

/**
 * End the meeting: completed (with endedAt / durationSec, 'meeting:ended', recap
 * notifications) and its live huddle is ended for everyone in it.
 */
async function endMeeting(meetingId, { recordingUrl, io = null, endedBy = null } = {}) {
    if (recordingUrl) await ScheduledMeeting.updateOne({ _id: meetingId }, { $set: { recordingUrl } });
    const result = await records().endMeeting(meetingId, { io, endedBy });
    return result ? result.meeting : null;
}

/**
 * Automations / notifications hear "meeting.completed" (metadata only: no transcript, notes or summary).
 */
function emitMeetingCompleted(meeting, io, extra = {}) {
    try {
        require('../../modules/notifications/notificationEventEmitter').emit('meeting.completed', {
            io,
            kind: 'scheduled',
            workspaceId: String(meeting.workspaceId),
            meetingId: String(meeting._id),
            title: meeting.title || '',
            durationMinutes: meeting.durationSec != null ? Math.round(meeting.durationSec / 60) : (meeting.duration || null),
            participantCount: (meeting.participants || []).length,
            actionItemCount: (meeting.actionItems || []).length,
            hasTranscript: !!(meeting.hasTranscript || (meeting.transcriptSegments || []).length || meeting.transcript),
            hasRecording: !!(meeting.recording?.path || meeting.recordingUrl),
            channelId: meeting.channelId ? String(meeting.channelId) : null,
            createdBy: meeting.createdBy ? String(meeting.createdBy) : null,
            ...extra,
        });
    } catch (err) {
        require('../../../utils/logger').warn(`[Meetings] meeting.completed emit failed: ${err.message}`);
    }
}

async function updateAgenda(meetingId, agenda, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const meeting = await ScheduledMeeting.findOneAndUpdate(
        query,
        { $set: { agenda } },
        { new: true }
    );
    if (!meeting) return null;
    return populateMeeting(meeting);
}

async function updateTranscript(meetingId, transcript, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const meeting = await ScheduledMeeting.findOneAndUpdate(
        query,
        { $set: { transcript } },
        { new: true }
    );
    if (!meeting) return null;
    return populateMeeting(meeting);
}

/**
 * The meeting's single summary (transcript + notes + agenda), saved on the meeting.
 * Returns the summary text (older callers) or null when the meeting is missing;
 * meetingRecords.summarize returns the full { summary, text, source, aiFallback }.
 */
async function summarizeMeeting(meetingId, { userId = null, io = null } = {}) {
    const result = await records().summarize(meetingId, { userId, io });
    return result ? result.text : null;
}

/** What a summary is made from: transcript, the meeting's notes, the agenda. */
async function meetingSourceText(meeting) {
    return records().summarySource(meeting);
}

/** speakerId -> username for transcript rendering (users live in PostgreSQL). */
async function speakerNames(segments) {
    const ids = [...new Set(segments.map((s) => s.speakerId && String(s.speakerId)).filter(Boolean))];
    const names = new Map();
    if (!ids.length) return names;
    try {
        const users = await require('../../identity').users.findManyByIds(ids);
        for (const [id, u] of users) if (u?.username) names.set(String(id), u.username);
    } catch {
        // Names are cosmetic: fall back to the stored speakerName.
    }
    return names;
}

// ── Transcript segments ─────────────────────────────────────────────────────

/** Append validated segments. Returns { added } or null (meeting missing); throws 409 at the cap. */
async function appendTranscriptSegments(meetingId, segments) {
    const res = await ScheduledMeeting.updateOne(
        { _id: meetingId, $expr: { $lte: [{ $size: { $ifNull: ['$transcriptSegments', []] } }, transcript.MAX_SEGMENTS_TOTAL - segments.length] } },
        { $push: { transcriptSegments: { $each: segments } }, $set: { hasTranscript: true, hasContent: true } },
    );
    if (!res.matchedCount) {
        const exists = await ScheduledMeeting.findById(meetingId).select('_id').lean();
        if (!exists) return null;
        throw Object.assign(new Error(`This transcript is full (${transcript.MAX_SEGMENTS_TOTAL} segments)`), { status: 409 });
    }
    return { added: segments.length };
}

async function getTranscript(meetingId) {
    const meeting = await ScheduledMeeting.findById(meetingId).select('title startTime transcript transcriptSegments').lean();
    if (!meeting) return null;
    const segments = transcript.sortSegments(meeting.transcriptSegments || []);
    const names = await speakerNames(segments);
    return {
        meetingId: String(meeting._id),
        segments: segments.map((s) => ({
            speakerId: s.speakerId ? String(s.speakerId) : null,
            speakerName: names.get(String(s.speakerId)) || s.speakerName || '',
            text: s.text,
            startedAt: s.startedAt,
            endedAt: s.endedAt,
        })),
        text: segments.length ? transcript.renderTranscript(segments, { origin: meeting.startTime, names }) : (meeting.transcript || ''),
    };
}

/** Lines of free text as pseudo-segments (legacy transcript string / shared notes). */
function textAsSegments(text, at) {
    return String(text || '').split(/\n+/).map((t) => t.trim()).filter(Boolean).map((t) => ({ text: t, startedAt: at, speakerId: null }));
}

/**
 * Action items found in the transcript (rule-based). With apply, new ones (by text) are added
 * to the meeting's action items. Returns { extracted, added, source, meeting } or null.
 */
async function extractActionItems(meetingId, { apply = false, userId = null, io = null } = {}) {
    const meeting = await ScheduledMeeting.findById(meetingId).lean();
    if (!meeting) return null;
    let segments = meeting.transcriptSegments || [];
    let source = 'transcript';
    if (!segments.length) {
        const notes = meeting.transcript ? '' : ((await records().noteText(meeting.noteId).catch(() => '')) || meeting.sharedNotes || '');
        source = meeting.transcript ? 'transcript' : (notes ? 'notes' : 'none');
        segments = textAsSegments(meeting.transcript || notes, meeting.startTime);
    }
    const extracted = transcript.extractActionItems(segments);
    let added = 0;
    if (apply && extracted.length) {
        ({ added } = await records().addActionItemsDeduped(meetingId, extracted, { userId, source: 'ai', io }));
    }
    const updated = added ? await populateMeeting(meeting) : null;
    return { extracted, added, source, meeting: updated };
}

// ── Recording ───────────────────────────────────────────────────────────────

async function loadForRecording(meetingId) {
    return ScheduledMeeting.findById(meetingId).select('workspaceId createdBy participants recording recordingUrl').lean();
}

/** Save the recording; returns the previous document (its old recording object must be deleted). */
async function setRecording(meetingId, recordingDoc) {
    return ScheduledMeeting.findOneAndUpdate(
        { _id: meetingId },
        { $set: { recording: recordingDoc, recordingUrl: `/api/v2/meetings/${meetingId}/recording`, hasContent: true } },
        { new: false },
    ).lean();
}

/** Remove the recording; returns the previous document. */
async function clearRecording(meetingId) {
    return ScheduledMeeting.findOneAndUpdate({ _id: meetingId }, { $set: { recording: null, recordingUrl: null } }, { new: false }).lean();
}


/**
 * A huddle ended: its meeting record(s) are completed (see meetingRecords.completeForHuddle).
 * Returns the ids of the scheduled meetings that completed.
 */
async function completeMeetingsForHuddle(huddle, io) {
    return records().completeForHuddle(huddle, io);
}

/**
 * Real availability: every attendee's scheduled/live meetings (organised or invited) are busy
 * time, and slots must sit inside each attendee's working hours (preferences.workingHours,
 * default 09:00-18:00 Mon-Fri) in their timezone (preferences.region.timezone; the caller's
 * `timezone` when unset/'auto', else UTC). Returns the top `limit` slots; the first one is
 * also given as suggestedStart/suggestedEnd for older clients.
 */
async function suggestTime({ participantIds = [], durationMinutes = 30, from, to, limit = 5, stepMinutes = 30, timezone, now = new Date() } = {}) {
    const duration = Math.min(Math.max(Number(durationMinutes) || 30, 5), 480);
    const ids = [...new Set((participantIds || []).map(String))].filter((id) => /^[a-f0-9]{24}$/i.test(id)).slice(0, 50);
    const validDate = (d) => d && !Number.isNaN(new Date(d).getTime());
    const start = validDate(from) ? new Date(Math.max(new Date(from).getTime(), now.getTime())) : now;
    const maxEnd = start.getTime() + 14 * 24 * 3600e3;
    let end = validDate(to) ? new Date(to) : new Date(start.getTime() + 7 * 24 * 3600e3);
    if (end.getTime() > maxEnd) end = new Date(maxEnd);

    // Busy time: meetings overlapping the window (the 8h look-back covers the longest meeting).
    const meetings = ids.length ? await ScheduledMeeting.find({
        status: { $in: ['scheduled', 'live'] },
        startTime: { $gte: new Date(start.getTime() - 8 * 3600e3), $lt: end },
        $or: [{ participants: { $in: ids } }, { createdBy: { $in: ids } }],
    }).select('startTime duration participants createdBy').lean() : [];

    const busyBy = new Map(ids.map((id) => [id, []]));
    for (const m of meetings) {
        const s = new Date(m.startTime).getTime();
        const interval = { start: s, end: s + (m.duration || 30) * 60e3 };
        const people = new Set([...(m.participants || []).map(String), String(m.createdBy)]);
        for (const id of people) if (busyBy.has(id)) busyBy.get(id).push(interval);
    }

    let users = new Map();
    try {
        if (ids.length) users = await require('../../identity').users.findManyByIds(ids);
    } catch {
        users = new Map();
    }
    const attendees = ids.map((id) => {
        const prefs = users.get(id)?.preferences || {};
        return { userId: id, timezone: prefs.region?.timezone, workingHours: prefs.workingHours, busy: busyBy.get(id) };
    });

    const slots = availability.findSlots({
        attendees, durationMinutes: duration, from: start, to: end, limit, stepMinutes, fallbackTimeZone: timezone,
    });
    const first = slots[0] || null;
    let note;
    if (!first) note = 'No free slot in this window';
    else if (!first.allAvailable) note = 'No time suits everyone; showing the slots most attendees can make';
    return {
        suggestedStart: first ? first.start : null,
        suggestedEnd: first ? first.end : null,
        durationMinutes: duration,
        slots,
        window: { from: start.toISOString(), to: end.toISOString() },
        ...(note ? { note } : {}),
    };
}

/** Add an action item; returns the meeting view (its actionItems include the new one). */
async function addActionItem(meetingId, body, { userId = null, io = null } = {}) {
    await records().addActionItem(meetingId, body, { userId, io });
    return records().getMeetingView(meetingId);
}

/** Patch an action item; returns the meeting view, or null when the item is missing. */
async function updateActionItem(meetingId, actionItemId, updates, { io = null } = {}) {
    try {
        await records().updateActionItem(meetingId, actionItemId, updates, { io });
    } catch (err) {
        if (err.status === 404) return null;
        throw err;
    }
    return records().getMeetingView(meetingId);
}

module.exports = {
    getMeetings,
    getMeeting,
    joinMeeting,
    endMeeting,
    updateAgenda,
    updateTranscript,
    summarizeMeeting,
    suggestTime,
    completeMeetingsForHuddle,
    emitMeetingCompleted,
    meetingSourceText,
    speakerNames,
    appendTranscriptSegments,
    getTranscript,
    extractActionItems,
    loadForRecording,
    setRecording,
    clearRecording,
    addActionItem,
    updateActionItem,
};
