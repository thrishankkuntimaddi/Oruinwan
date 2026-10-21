'use strict';

const ScheduledMeeting = require('../../models/ScheduledMeeting');
const { summarizeDocument } = require('../ai/ai.summarizer.service');
const availability = require('./availability');
const transcript = require('./transcript');

// Users live in PostgreSQL: attach them with hydrate (Mongoose populate cannot reach them).
const { hydrate } = require('../../identity/hydrate');

const PERSON = { type: 'user', fields: ['username', 'profilePicture', 'profile'] };
const FULL_REFS = { createdBy: PERSON, participants: PERSON, 'actionItems.assignedTo': PERSON };

// Transcript segments can be large: they are served by GET /:id/transcript only.
const LIGHT = '-transcriptSegments';

async function populateMeeting(meeting) {
    const doc = await ScheduledMeeting.findById(meeting._id).select(LIGHT).lean();
    return doc ? hydrate(doc, FULL_REFS) : doc;
}

async function getMeetings({ workspaceId, userId, companyId, limit = 20, includeCompleted = true }) {
    const query = { workspaceId };
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

async function getMeeting(meetingId, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const doc = await ScheduledMeeting.findOne(query).select(LIGHT).lean();
    return doc ? hydrate(doc, FULL_REFS) : doc;
}

async function joinMeeting(meetingId, userId, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const meeting = await ScheduledMeeting.findOneAndUpdate(
        query,
        {
            status: 'live',
            $addToSet: { participants: userId },
        },
        { new: true }
    );
    if (!meeting) return null;
    return populateMeeting(meeting);
}

async function endMeeting(meetingId, { companyId, recordingUrl, io = null } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const update = { status: 'completed' };
    if (recordingUrl) update.recordingUrl = recordingUrl;

    // new: false - the previous status tells whether this call is the one that completed it.
    const before = await ScheduledMeeting.findOneAndUpdate(query, update, { new: false });
    if (!before) return null;
    if (before.status !== 'completed') emitMeetingCompleted(before, io);
    return populateMeeting(before);
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
            durationMinutes: meeting.duration || null,
            participantCount: (meeting.participants || []).length,
            actionItemCount: (meeting.actionItems || []).length,
            hasTranscript: !!((meeting.transcriptSegments || []).length || meeting.transcript),
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

async function updateSharedNotes(meetingId, sharedNotes, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    await ScheduledMeeting.findOneAndUpdate(query, { $set: { sharedNotes } });
}

async function summarizeMeeting(meetingId, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const meeting = await ScheduledMeeting.findOne(query).lean();
    if (!meeting) return null;

    const { text } = await meetingSourceText(meeting);
    const { summary } = await summarizeDocument(text, {
        title: meeting.title,
        type: 'generic',
        noCache: true,
    });

    await ScheduledMeeting.findByIdAndUpdate(meetingId, { $set: { summary } });
    return summary;
}

/** The best text to summarise: transcript segments, then the legacy transcript string, then shared notes. */
async function meetingSourceText(meeting) {
    const segments = meeting.transcriptSegments || [];
    if (segments.length) {
        const names = await speakerNames(segments);
        return { text: transcript.renderTranscript(segments, { origin: meeting.startTime, names }), source: 'transcript' };
    }
    if (meeting.transcript) return { text: meeting.transcript, source: 'transcript' };
    return { text: meeting.sharedNotes || '', source: meeting.sharedNotes ? 'notes' : 'none' };
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
        { $push: { transcriptSegments: { $each: segments } } },
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
async function extractActionItems(meetingId, { apply = false } = {}) {
    const meeting = await ScheduledMeeting.findById(meetingId).lean();
    if (!meeting) return null;
    let segments = meeting.transcriptSegments || [];
    let source = 'transcript';
    if (!segments.length) {
        source = meeting.transcript ? 'transcript' : (meeting.sharedNotes ? 'notes' : 'none');
        segments = textAsSegments(meeting.transcript || meeting.sharedNotes, meeting.startTime);
    }
    const extracted = transcript.extractActionItems(segments);
    let added = [];
    if (apply && extracted.length) {
        const existing = new Set((meeting.actionItems || []).map((a) => String(a.text || '').trim().toLowerCase()));
        added = extracted.filter((a) => !existing.has(a.text.toLowerCase()))
            .map((a) => ({ text: a.text, assignedTo: a.assigneeId || null, status: 'pending' }));
        if (added.length) await ScheduledMeeting.updateOne({ _id: meetingId }, { $push: { actionItems: { $each: added } } });
    }
    const updated = added.length ? await populateMeeting(meeting) : null;
    return { extracted, added: added.length, source, meeting: updated };
}

// ── Recording ───────────────────────────────────────────────────────────────

async function loadForRecording(meetingId) {
    return ScheduledMeeting.findById(meetingId).select('workspaceId createdBy participants recording recordingUrl').lean();
}

/** Save the recording; returns the previous document (its old recording object must be deleted). */
async function setRecording(meetingId, recordingDoc) {
    return ScheduledMeeting.findOneAndUpdate(
        { _id: meetingId },
        { $set: { recording: recordingDoc, recordingUrl: `/api/v2/meetings/${meetingId}/recording` } },
        { new: false },
    ).lean();
}

/** Remove the recording; returns the previous document. */
async function clearRecording(meetingId) {
    return ScheduledMeeting.findOneAndUpdate({ _id: meetingId }, { $set: { recording: null, recordingUrl: null } }, { new: false }).lean();
}


/**
 * A huddle ended: the scheduled meetings that were live in it are over. That is the
 * meeting's own huddle ("meeting-<id>") and live meetings of the huddle's channel or DM.
 */
async function completeMeetingsForHuddle(huddle, io) {
    if (!huddle) return [];
    const or = [];
    const hid = String(huddle.huddleId || '');
    const meetingId = hid.startsWith('meeting-') ? hid.slice('meeting-'.length) : null;
    if (meetingId && /^[a-f0-9]{24}$/i.test(meetingId)) or.push({ _id: meetingId });
    if (huddle.channelId) or.push({ channelId: huddle.channelId });
    if (huddle.dmId) or.push({ dmSessionId: huddle.dmId });
    if (!or.length) return [];
    const live = await ScheduledMeeting.find({ status: 'live', $or: or })
        .select('_id workspaceId title startTime duration participants actionItems channelId createdBy recordingUrl recording.path transcript').lean();
    if (!live.length) return [];
    await ScheduledMeeting.updateMany({ _id: { $in: live.map(m => m._id) } }, { $set: { status: 'completed' } });
    for (const m of live) {
        if (io) io.to(`workspace:${m.workspaceId}`).emit('schedule:updated', { meeting: { ...m, status: 'completed' } });
        emitMeetingCompleted(m, io, { huddleId: hid || null });
    }
    return live.map(m => String(m._id));
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

async function addActionItem(meetingId, { text, assignedTo, status = 'pending' }, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const item = { text, assignedTo: assignedTo || null, status };
    const meeting = await ScheduledMeeting.findOneAndUpdate(
        query,
        { $push: { actionItems: item } },
        { new: true }
    );
    if (!meeting) return null;
    return populateMeeting(meeting);
}

async function updateActionItem(meetingId, actionItemId, updates, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const setPayload = {};
    if (updates.text !== undefined) setPayload['actionItems.$.text'] = updates.text;
    if (updates.status !== undefined) setPayload['actionItems.$.status'] = updates.status;
    if (updates.assignedTo !== undefined) setPayload['actionItems.$.assignedTo'] = updates.assignedTo;
    if (updates.taskId !== undefined) setPayload['actionItems.$.taskId'] = updates.taskId;

    const meeting = await ScheduledMeeting.findOneAndUpdate(
        { ...query, 'actionItems._id': actionItemId },
        { $set: setPayload },
        { new: true }
    );
    if (!meeting) return null;
    return populateMeeting(meeting);
}

module.exports = {
    getMeetings,
    getMeeting,
    joinMeeting,
    endMeeting,
    updateAgenda,
    updateTranscript,
    updateSharedNotes,
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
