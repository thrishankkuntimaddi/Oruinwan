'use strict';

/**
 * Meeting clashes: "Asha is already in Design review 9:00–9:30 (High priority)".
 *
 * Scheduling warns, suggests free times and lets the organiser go ahead anyway, so clashes are
 * advisory. They are worked out three times:
 *   1. POST /api/v2/meetings/conflicts while the organiser picks a time (checkConflicts).
 *   2. Right after the meeting is saved (recordClashes): the check runs again against what is in
 *      the database now, and the clash is written on BOTH meetings with an atomic, idempotent
 *      "push unless already there". Two organisers booking the same person at the same moment
 *      both insert first and check second, so the later check always sees the earlier meeting
 *      and marks both of them: the clash is never lost, whatever the interleaving.
 *   3. Cancelling, deleting or moving a meeting removes it from every other meeting's list
 *      (clearClashes); a move then records its new clashes.
 *
 * Times are stored in UTC and compared as half-open intervals [start, end): a meeting that ends
 * at 9:00 does not clash with one starting at 9:00. Only 'scheduled' and 'live' meetings block
 * time (cancelled and completed ones do not). Every meeting source is a ScheduledMeeting record
 * (scheduled meetings and ad-hoc huddles alike); there is no separate calendar-event store.
 */

const MINUTE = 60 * 1000;
const MAX_MEETING_MS = 480 * MINUTE; // ScheduledMeeting.duration max: bounds the look-back
const MAX_PEOPLE = 50;
const BLOCKING = ['scheduled', 'live'];

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const PRIORITY_LABEL = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };

const Meeting = () => require('../../models/ScheduledMeeting');
const idOf = (v) => String(v?._id || v || '');
const isId = (v) => /^[a-f0-9]{24}$/i.test(String(v || ''));

const isPriority = (v) => PRIORITIES.includes(v);
const normalizePriority = (v) => (isPriority(v) ? v : 'normal');
const priorityLabel = (v) => PRIORITY_LABEL[normalizePriority(v)];

/** [start, end) of a meeting in ms. A live call blocks at least until now. */
function meetingInterval(m, now = Date.now()) {
    const start = new Date(m.startTime).getTime();
    let end = start + (Number(m.duration) || 30) * MINUTE;
    if (m.status === 'live' && end < now) end = now;
    return { start, end };
}

/** Half-open overlap: touching edges do not clash. */
const intervalsOverlap = (a, b) => a.start < b.end && b.start < a.end;

/** Everyone a meeting takes time from: the organiser, the invitees and whoever joined. */
function peopleOf(m) {
    const set = new Set();
    if (m.createdBy) set.add(idOf(m.createdBy));
    for (const p of m.participants || []) set.add(idOf(p));
    for (const p of m.invitees || []) set.add(idOf(p));
    set.delete('');
    return set;
}

/**
 * The scheduled/live meetings of these people that overlap [start, end), excluding some ids.
 * The query is a coarse filter; the overlap, status and people are checked again here.
 */
async function busyMeetings({ userIds, start, end, excludeIds = [], now = Date.now() }) {
    const ids = [...new Set((userIds || []).map(String))].filter(isId);
    if (!ids.length || !(end > start)) return [];
    const exclude = new Set(excludeIds.map(String).filter(Boolean));
    const query = {
        status: { $in: BLOCKING },
        startTime: { $gte: new Date(start - Math.max(MAX_MEETING_MS, 24 * 60 * MINUTE)), $lt: new Date(end) },
        $or: [{ participants: { $in: ids } }, { createdBy: { $in: ids } }, { invitees: { $in: ids } }],
    };
    if (exclude.size) query._id = { $nin: [...exclude] };
    const rows = await Meeting().find(query)
        .select('title startTime duration status priority participants invitees createdBy workspaceId channelId dmSessionId kind')
        .lean();
    const want = { start, end };
    const idSet = new Set(ids);
    return (rows || []).filter((m) => BLOCKING.includes(m.status)
        && !exclude.has(idOf(m._id))
        && intervalsOverlap(meetingInterval(m, now), want)
        && [...peopleOf(m)].some((p) => idSet.has(p)));
}

/** Which meetings the viewer may see the title of (involved, or in its workspace/channel/DM). */
async function visibilityFor(viewerId, workspaceId, meetings) {
    const viewer = String(viewerId);
    const channelIds = [...new Set(meetings.filter((m) => m.channelId).map((m) => idOf(m.channelId)))];
    const dmIds = [...new Set(meetings.filter((m) => m.dmSessionId).map((m) => idOf(m.dmSessionId)))];
    let channels = new Set();
    let dms = new Set();
    try {
        if (channelIds.length) {
            const Channel = require('../channels/channel.model');
            const rows = await Channel.find({ _id: { $in: channelIds }, 'members.user': viewer }).select('_id').lean();
            channels = new Set((rows || []).map((r) => idOf(r._id)));
        }
        if (dmIds.length) {
            const DMSession = require('../../../models/DMSession');
            const rows = await DMSession.find({ _id: { $in: dmIds }, participants: viewer }).select('_id').lean();
            dms = new Set((rows || []).map((r) => idOf(r._id)));
        }
    } catch { /* unknown: those stay "Busy" */ }
    return (m) => {
        if (peopleOf(m).has(viewer)) return true;
        if (workspaceId && idOf(m.workspaceId) !== String(workspaceId)) return false;
        if (m.channelId) return channels.has(idOf(m.channelId));
        if (m.dmSessionId) return dms.has(idOf(m.dmSessionId));
        return true; // a workspace-wide meeting: every member can see it
    };
}

function describe(m, visible, now) {
    const { start, end } = meetingInterval(m, now);
    return {
        meetingId: idOf(m._id),
        title: visible ? (m.title || 'Meeting') : null,
        busy: !visible,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        priority: normalizePriority(m.priority),
        status: m.status,
    };
}

async function namesFor(ids) {
    try {
        const users = await require('../../identity').users.findManyByIds(ids);
        return (id) => {
            const u = users.get(id);
            return u?.profile?.name || u?.username || null;
        };
    } catch {
        return () => null;
    }
}

/**
 * The clash check for a proposed meeting. Returns
 * { start, end, durationMinutes, hasConflicts, conflictCount,
 *   attendees: [{ userId, name, isOrganizer, conflicts: [{ meetingId, title|null, busy, start, end, priority, status }] }],
 *   suggestions: [{ start, end, allAvailable, ... }] }   (free slots, only when something clashes)
 */
async function checkConflicts({
    requesterId, workspaceId = null, start, durationMinutes = 30, attendeeIds = [], excludeMeetingId = null,
    suggest = 3, timezone, now = new Date(), suggestTime = null,
}) {
    const startMs = new Date(start).getTime();
    const duration = Math.min(Math.max(Number(durationMinutes) || 30, 5), 480);
    const endMs = startMs + duration * MINUTE;
    const organizer = String(requesterId);
    const ids = [...new Set([organizer, ...(attendeeIds || []).map(String)])].filter(isId).slice(0, MAX_PEOPLE);
    const exclude = excludeMeetingId && isId(excludeMeetingId) ? [String(excludeMeetingId)] : [];

    const meetings = await busyMeetings({ userIds: ids, start: startMs, end: endMs, excludeIds: exclude, now: now.getTime() });
    const canSee = await visibilityFor(organizer, workspaceId, meetings);
    const name = await namesFor(ids);

    let count = 0;
    const attendees = ids.map((userId) => {
        const mine = meetings
            .filter((m) => peopleOf(m).has(userId))
            .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
            .map((m) => describe(m, canSee(m), now.getTime()));
        count += mine.length;
        return { userId, name: name(userId), isOrganizer: userId === organizer, conflicts: mine };
    });

    let suggestions = [];
    const limit = Math.min(Math.max(Number(suggest) || 0, 0), 10);
    if (count && limit) {
        try {
            const finder = suggestTime || require('./meetings.service').suggestTime;
            // Free slots around the time picked: from a few hours before it (never in the past).
            const from = new Date(Math.max(now.getTime(), startMs - 3 * 60 * MINUTE));
            const found = await finder({
                participantIds: ids, durationMinutes: duration, from, limit: limit + 2, stepMinutes: 15, timezone,
                excludeMeetingIds: exclude, now,
            });
            suggestions = (found?.slots || [])
                .filter((s) => s.allAvailable !== false && new Date(s.start).getTime() !== startMs)
                .slice(0, limit);
        } catch {
            suggestions = [];
        }
    }

    return {
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        durationMinutes: duration,
        hasConflicts: count > 0,
        conflictCount: count,
        attendees,
        suggestions,
    };
}

function emit(io, rooms, event, payload) {
    if (!io || !rooms.length) return;
    try {
        let target = io;
        for (const r of rooms) target = target.to(r);
        target.emit(event, payload);
    } catch { /* sockets are best effort */ }
}

const entryFor = (m, userIds, now) => {
    const { start, end } = meetingInterval(m, now);
    return {
        meetingId: m._id,
        userIds,
        title: m.title || 'Meeting',
        priority: normalizePriority(m.priority),
        start: new Date(start),
        end: new Date(end),
    };
};

/**
 * After a meeting is saved (created or moved): find what it clashes with in the database now
 * and mark the clash on both meetings. Idempotent and safe to run concurrently: each mark is a
 * single-document "$push unless that meeting is already listed". Tells the people involved
 * live ('schedule:conflict' to each, 'schedule:conflicts' to the workspace).
 * Returns this meeting's clashes: [{ meetingId, userIds, title, priority, start, end }].
 */
async function recordClashes(meeting, { io = null, now = Date.now() } = {}) {
    if (!meeting || !BLOCKING.includes(meeting.status || 'scheduled') || meeting.kind === 'huddle') return [];
    const M = Meeting();
    const people = peopleOf(meeting);
    const { start, end } = meetingInterval(meeting, now);
    const others = await busyMeetings({ userIds: [...people], start, end, excludeIds: [idOf(meeting._id)], now });
    const clashes = [];
    for (const other of others) {
        const shared = [...peopleOf(other)].filter((p) => people.has(p));
        if (!shared.length) continue;
        const mine = entryFor(other, shared, now);
        const theirs = entryFor(meeting, shared, now);
        await Promise.all([
            M.updateOne({ _id: meeting._id, 'conflicts.meetingId': { $ne: other._id } }, { $push: { conflicts: mine } }),
            M.updateOne({ _id: other._id, 'conflicts.meetingId': { $ne: meeting._id } }, { $push: { conflicts: theirs } }),
        ]);
        clashes.push(mine);
        for (const userId of shared) {
            emit(io, [`user:${userId}`], 'schedule:conflict', {
                meetingId: idOf(meeting._id),
                title: meeting.title,
                priority: normalizePriority(meeting.priority),
                start: new Date(start).toISOString(),
                end: new Date(end).toISOString(),
                clashesWith: { meetingId: idOf(other._id), title: other.title, priority: normalizePriority(other.priority), start: mine.start.toISOString(), end: mine.end.toISOString() },
            });
        }
    }
    if (clashes.length && meeting.workspaceId) {
        emit(io, [`workspace:${idOf(meeting.workspaceId)}`], 'schedule:conflicts', {
            meetingIds: [idOf(meeting._id), ...clashes.map((c) => idOf(c.meetingId))],
        });
    }
    return clashes;
}

/**
 * The meeting no longer takes that time (cancelled, deleted, moved): drop it from every other
 * meeting's clash list and empty its own. Returns the ids of the meetings that changed.
 */
async function clearClashes(meeting, { io = null } = {}) {
    if (!meeting?._id) return [];
    const M = Meeting();
    const id = meeting._id;
    const affected = await M.find({ 'conflicts.meetingId': id }).select('_id').lean().catch(() => []);
    await Promise.all([
        M.updateMany({ 'conflicts.meetingId': id }, { $pull: { conflicts: { meetingId: id } } }),
        M.updateOne({ _id: id }, { $set: { conflicts: [] } }),
    ]);
    const ids = (affected || []).map((m) => idOf(m._id));
    if ((ids.length || (meeting.conflicts || []).length) && meeting.workspaceId) {
        emit(io, [`workspace:${idOf(meeting.workspaceId)}`], 'schedule:conflicts', { meetingIds: [idOf(id), ...ids], resolved: true });
    }
    return ids;
}

/**
 * A meeting's clash list for one viewer: titles only for clashes the viewer is in (they are in
 * the other meeting too); everyone else's clash shows as "Busy". `mine` marks the viewer's own.
 */
function conflictsForViewer(conflicts, viewerId) {
    const viewer = viewerId ? String(viewerId) : null;
    return (conflicts || []).map((c) => {
        const userIds = (c.userIds || []).map(idOf);
        const mine = !!viewer && userIds.includes(viewer);
        return {
            meetingId: idOf(c.meetingId),
            userIds,
            mine,
            busy: !mine,
            title: mine ? (c.title || 'Meeting') : null,
            priority: normalizePriority(c.priority),
            start: c.start ? new Date(c.start).toISOString() : null,
            end: c.end ? new Date(c.end).toISOString() : null,
        };
    });
}

/** "Clashes with Standup (Normal priority) 09:00–09:30 UTC" for notification text. */
function clashSentence(c) {
    return `Clashes with “${c.title || 'another meeting'}” (${priorityLabel(c.priority)} priority)`;
}

module.exports = {
    PRIORITIES,
    PRIORITY_LABEL,
    BLOCKING,
    isPriority,
    normalizePriority,
    priorityLabel,
    meetingInterval,
    intervalsOverlap,
    peopleOf,
    busyMeetings,
    checkConflicts,
    recordClashes,
    clearClashes,
    conflictsForViewer,
    clashSentence,
};
