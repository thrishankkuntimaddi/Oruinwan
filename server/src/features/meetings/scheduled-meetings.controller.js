'use strict';

const ScheduledMeeting = require('../../models/ScheduledMeeting');
const logger = require('../../../utils/logger');
const { assertWorkspaceMember, isValidId, sendAccessError } = require('../../shared/utils/workspaceAccess');
const { loadMeetingForUser, canManageMeeting } = require('./meetingAccess');
const conflicts = require('./conflicts');

// Scheduled meetings are scoped by workspace. companyId is optional (set from
// the workspace's company when it has one) so personal workspaces work too.
// Reading/creating: any active workspace member. Cancelling, deleting, moving or
// re-prioritising: the organiser (createdBy) or a workspace owner/admin.
//
// Clashes with other meetings never block (features/meetings/conflicts.js): the schedule
// dialogs ask POST /conflicts while the time is picked, and create/move re-check at save
// time, mark the clash on both meetings and answer with it.

// Users live in PostgreSQL: the organizer is attached with hydrate (populate cannot reach it).
const { hydrate } = require('../../identity/hydrate');
const CREATOR = { type: 'user', fields: ['username', 'profilePicture', 'profile'] };
const VALID_STATUSES = ['scheduled', 'live', 'completed', 'cancelled'];

/** The API shape: organiser attached, priority filled in, clashes as the viewer may see them. */
async function presentFor(m, viewerId) {
  const plain = typeof m.toObject === 'function' ? m.toObject() : { ...m };
  plain.priority = conflicts.normalizePriority(plain.priority);
  plain.conflicts = conflicts.conflictsForViewer(plain.conflicts, viewerId);
  return hydrate(plain, { createdBy: CREATOR });
}

function fail(res, err, fallback) {
  if (err && err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err && err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  logger.error(`[scheduled-meetings] ${fallback}:`, err);
  return res.status(500).json({ message: fallback });
}

const activeMemberIds = (ws) => (ws.members || [])
  .filter(m => (m.status || 'active') === 'active')
  .map(m => String(m.user?._id || m.user));

/**
 * Who a meeting is for. People picked (active workspace members only); with nobody picked, a
 * DM meeting is for the DM's people (a small group: they are invited and their time is held).
 * `conversationMembers` is everyone in the meeting's channel / DM (null for workspace meetings).
 */
async function resolvePeople({ workspaceId, organizerId, memberIds, participants, channelId, dmSessionId }) {
  const memberSet = new Set(memberIds);
  let participantIds = [...new Set((participants || []).map(String))].filter(id => isValidId(id) && memberSet.has(id));
  let conversationMembers = null;
  if (channelId || dmSessionId) {
    const { checkConversationAccess } = require('../../modules/threads/threadAccess');
    const conv = await checkConversationAccess(channelId ? { channel: channelId } : { dm: dmSessionId }, organizerId);
    if (!conv.ok) return { error: [403, 'You are not in that conversation'] };
    if (channelId) {
      const Channel = require('../channels/channel.model');
      const ch = await Channel.findById(channelId).select('members workspace').lean();
      if (!ch || String(ch.workspace) !== String(workspaceId)) return { error: [400, 'That channel is in another workspace'] };
      conversationMembers = (ch.members || []).map(m => String(m?.user?._id || m?.user || m));
    } else {
      const DMSession = require('../../../models/DMSession');
      const dm = await DMSession.findById(dmSessionId).select('participants workspace').lean();
      if (!dm || (dm.workspace && String(dm.workspace) !== String(workspaceId))) return { error: [400, 'That conversation is in another workspace'] };
      conversationMembers = (dm.participants || []).map(String);
      if (!participantIds.length) {
        participantIds = conversationMembers.filter(id => id !== String(organizerId) && memberSet.has(id));
      }
    }
  }
  return { participantIds, conversationMembers };
}

/** Invites (or "time changed" notes) with this recipient's clashes and both priorities. */
async function notifyInvitees(io, { meeting, recipientIds, clashes, moved = false }) {
  const notifService = require('../../modules/notifications/notificationService');
  const base = {
    workspaceId: String(meeting.workspaceId),
    title: meeting.title,
    scheduledMeetingId: meeting._id,
    startTime: meeting.startTime,
    priority: conflicts.normalizePriority(meeting.priority),
    moved,
  };
  const clashOf = (id) => (clashes || []).filter(c => (c.userIds || []).map(String).includes(id));
  const plain = recipientIds.filter(id => !clashOf(id).length);
  if (plain.length) await notifService.scheduleCreated(io, { ...base, recipientIds: plain });
  for (const id of recipientIds.filter(r => clashOf(r).length)) {
    await notifService.scheduleCreated(io, { ...base, recipientIds: [id], conflicts: clashOf(id) });
  }
}

/** Re-check after a save: mark the clash on both meetings, then read this meeting's list back. */
async function settleClashes(meeting, io) {
  try {
    const found = await conflicts.recordClashes(meeting, { io });
    // Another organiser's save running at the same moment may have added to our list too.
    const fresh = await Promise.resolve(ScheduledMeeting.findById(meeting._id)?.select?.('conflicts')?.lean?.()).catch(() => null);
    const list = fresh?.conflicts || found;
    return { found, list };
  } catch (err) {
    logger.error('[scheduled-meetings] clash check failed:', err.message);
    return { found: [], list: [] };
  }
}

async function getScheduledMeetings(req, res) {
  try {
    const { workspaceId, limit = 10 } = req.query;
    try {
      await assertWorkspaceMember(workspaceId, req.user.sub);
    } catch (err) {
      return sendAccessError(res, err);
    }

    // Upcoming, in progress (started but not over yet) and live meetings.
    const now = Date.now();
    // Scheduled meetings only: ad-hoc huddle records are listed by GET /api/v2/meetings?status=.
    const query = {
      workspaceId,
      kind: { $ne: 'huddle' },
      $or: [
        { status: 'live' },
        { status: 'scheduled', startTime: { $gte: new Date(now - 8 * 3600e3) } },
      ],
    };
    const cap = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const meetings = (await ScheduledMeeting.find(query).sort({ startTime: 1 }).limit(cap + 20).lean())
      .filter(m => m.status === 'live' || new Date(m.startTime).getTime() + (m.duration || 30) * 60e3 > now)
      .slice(0, cap)
      .map(m => ({ ...m, priority: conflicts.normalizePriority(m.priority), conflicts: conflicts.conflictsForViewer(m.conflicts, req.user.sub) }));

    await hydrate(meetings, { createdBy: CREATOR });

    res.json({ meetings });
  } catch (err) {
    fail(res, err, 'Failed to fetch meetings');
  }
}

/**
 * POST /conflicts { workspaceId, startTime, duration|durationMinutes, participants|attendeeIds,
 * channelId?, dmSessionId?, excludeMeetingId?, timezone?, suggest? } → see conflicts.checkConflicts.
 */
async function checkConflicts(req, res) {
  try {
    const body = req.body || {};
    const { workspaceId, startTime, channelId, dmSessionId, excludeMeetingId, timezone } = body;
    const people = body.participants ?? body.attendeeIds ?? body.participantIds ?? [];
    if (!workspaceId || !startTime) return res.status(400).json({ message: 'workspaceId and startTime are required' });
    if (Number.isNaN(new Date(startTime).getTime())) return res.status(400).json({ message: 'Invalid startTime' });
    if (!Array.isArray(people)) return res.status(400).json({ message: 'participants must be an array of user ids' });
    if (channelId && !isValidId(channelId)) return res.status(400).json({ message: 'Invalid channelId' });
    if (dmSessionId && !isValidId(dmSessionId)) return res.status(400).json({ message: 'Invalid dmSessionId' });
    if (excludeMeetingId && !isValidId(excludeMeetingId)) return res.status(400).json({ message: 'Invalid excludeMeetingId' });

    let access;
    try {
      access = await assertWorkspaceMember(workspaceId, req.user.sub);
    } catch (err) {
      return sendAccessError(res, err);
    }
    const resolved = await resolvePeople({
      workspaceId, organizerId: req.user.sub, memberIds: activeMemberIds(access.workspace),
      participants: people, channelId, dmSessionId,
    });
    if (resolved.error) return res.status(resolved.error[0]).json({ message: resolved.error[1] });

    const result = await conflicts.checkConflicts({
      requesterId: String(req.user.sub),
      workspaceId,
      start: startTime,
      durationMinutes: body.duration ?? body.durationMinutes,
      attendeeIds: resolved.participantIds,
      excludeMeetingId: excludeMeetingId || null,
      timezone: typeof timezone === 'string' ? timezone : undefined,
      suggest: body.suggest ?? 3,
    });
    res.json(result);
  } catch (err) {
    fail(res, err, 'Failed to check for clashes');
  }
}

async function createScheduledMeeting(req, res) {
  try {
    const { workspaceId, channelId, dmSessionId, title, startTime, duration, meetingLink, participants, priority } = req.body || {};
    if (!workspaceId || typeof title !== 'string' || !title.trim() || !startTime) {
      return res.status(400).json({ message: 'workspaceId, title, and startTime are required' });
    }
    if (Number.isNaN(new Date(startTime).getTime())) return res.status(400).json({ message: 'Invalid startTime' });
    if (channelId && !isValidId(channelId)) return res.status(400).json({ message: 'Invalid channelId' });
    if (dmSessionId && !isValidId(dmSessionId)) return res.status(400).json({ message: 'Invalid dmSessionId' });
    if (participants !== undefined && !Array.isArray(participants)) {
      return res.status(400).json({ message: 'participants must be an array of user ids' });
    }
    if (priority !== undefined && priority !== null && !conflicts.isPriority(priority)) {
      return res.status(400).json({ message: `priority must be one of ${conflicts.PRIORITIES.join(', ')}` });
    }

    let access;
    try {
      access = await assertWorkspaceMember(workspaceId, req.user.sub);
    } catch (err) {
      return sendAccessError(res, err);
    }
    const ws = access.workspace;
    const memberIds = activeMemberIds(ws);
    const memberSet = new Set(memberIds);

    // A meeting placed in a conversation: the organiser must be in it, and its people are invited.
    const resolved = await resolvePeople({ workspaceId, organizerId: req.user.sub, memberIds, participants, channelId, dmSessionId });
    if (resolved.error) return res.status(resolved.error[0]).json({ message: resolved.error[1] });
    const { participantIds, conversationMembers } = resolved;

    const meeting = await ScheduledMeeting.create({
      companyId: ws.company || null,
      workspaceId,
      channelId: channelId || null,
      dmSessionId: dmSessionId || null,
      createdBy: req.user.sub,
      title: title.trim(),
      startTime: new Date(startTime),
      duration: duration || 30,
      meetingLink: meetingLink || null,
      participants: participantIds,
      invitees: participantIds,
      priority: conflicts.normalizePriority(priority),
      kind: 'scheduled',
      status: 'scheduled',
    });

    // Save first, check second: a clash booked by someone else at this very moment is still caught.
    const { found, list } = await settleClashes(meeting, req.io);
    const saved = { ...(typeof meeting.toObject === 'function' ? meeting.toObject() : meeting), conflicts: list };

    req.io.to(`workspace:${workspaceId}`).emit('schedule:created', { meeting: await presentFor(saved, null) });

    try {
      // Invites go to the people picked; otherwise to the conversation's people; otherwise the workspace.
      const invited = participantIds.length ? participantIds
        : conversationMembers ? conversationMembers.filter(id => memberSet.has(id))
          : memberIds;
      await notifyInvitees(req.io, { meeting, recipientIds: invited.filter(id => id !== String(req.user.sub)), clashes: found });
    } catch (notifErr) {
      logger.error('Notification error on schedule create:', notifErr.message);
    }

    const populated = await presentFor(saved, req.user.sub);
    res.status(201).json({ meeting: populated, conflicts: populated.conflicts });
  } catch (err) {
    fail(res, err, 'Failed to create meeting');
  }
}

/**
 * PATCH /:id { status? , startTime?, duration?, title?, priority? }. Status changes as before
 * (cancelling clears the meeting's clashes). Moving / renaming / re-prioritising is for the
 * organiser or an admin, on a meeting that has not started; a move re-checks clashes and tells
 * the invitees.
 */
async function updateScheduledMeeting(req, res) {
  try {
    const body = req.body || {};
    const { status } = body;
    const editing = ['startTime', 'duration', 'title', 'priority'].filter(k => body[k] !== undefined);
    if (status === undefined && !editing.length) return res.status(400).json({ message: 'Nothing to change' });
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    if (body.startTime !== undefined && Number.isNaN(new Date(body.startTime).getTime())) return res.status(400).json({ message: 'Invalid startTime' });
    if (body.duration !== undefined && !(Number(body.duration) >= 5 && Number(body.duration) <= 480)) return res.status(400).json({ message: 'duration must be 5–480 minutes' });
    if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim())) return res.status(400).json({ message: 'title cannot be empty' });
    if (body.priority !== undefined && !conflicts.isPriority(body.priority)) {
      return res.status(400).json({ message: `priority must be one of ${conflicts.PRIORITIES.join(', ')}` });
    }

    let loaded;
    try {
      loaded = await loadMeetingForUser(req.params.id, req.user.sub);
    } catch (err) {
      return sendAccessError(res, err);
    }
    const manager = canManageMeeting(loaded.meeting, req.user.sub, loaded.access);
    if (status === 'cancelled' && !manager) {
      return res.status(403).json({ message: 'Only the organizer or a workspace admin can cancel this meeting' });
    }
    if (editing.length && !manager) {
      return res.status(403).json({ message: 'Only the organizer or a workspace admin can change this meeting' });
    }

    const meeting = await ScheduledMeeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    if (editing.length && (meeting.status !== 'scheduled' || meeting.kind === 'huddle')) {
      return res.status(409).json({ message: 'Only a scheduled meeting that has not started can be changed' });
    }

    const oldStart = new Date(meeting.startTime).getTime();
    const oldDuration = Number(meeting.duration) || 30;
    const changes = {};
    if (body.startTime !== undefined) changes.startTime = new Date(body.startTime);
    if (body.duration !== undefined) changes.duration = Number(body.duration);
    if (body.title !== undefined) changes.title = body.title.trim();
    if (body.priority !== undefined) changes.priority = body.priority;
    if (status !== undefined) changes.status = status;
    await ScheduledMeeting.updateOne({ _id: meeting._id }, { $set: changes });
    Object.assign(meeting, changes);
    const moved = new Date(meeting.startTime).getTime() !== oldStart || (Number(meeting.duration) || 30) !== oldDuration;

    let found = [];
    let list = meeting.conflicts || [];
    if (meeting.status === 'cancelled' || meeting.status === 'completed' || moved) {
      // It no longer holds that time: its clashes go, everywhere.
      try {
        await conflicts.clearClashes(meeting, { io: req.io });
        list = [];
      } catch (err) {
        logger.error('[scheduled-meetings] clearing clashes failed:', err.message);
      }
    } else if (body.title !== undefined || body.priority !== undefined) {
      // Keep other meetings' copies of this one's name and priority current.
      await ScheduledMeeting.updateMany(
        { 'conflicts.meetingId': meeting._id },
        { $set: { 'conflicts.$[c].title': meeting.title, 'conflicts.$[c].priority': conflicts.normalizePriority(meeting.priority) } },
        { arrayFilters: [{ 'c.meetingId': meeting._id }] },
      ).catch(() => {});
    }
    if (moved && meeting.status === 'scheduled') {
      ({ found, list } = await settleClashes(meeting, req.io));
    }

    const saved = { ...(typeof meeting.toObject === 'function' ? meeting.toObject() : meeting), conflicts: list };
    req.io.to(`workspace:${meeting.workspaceId}`).emit('schedule:updated', { meeting: await presentFor(saved, null) });

    if (moved && meeting.status === 'scheduled') {
      try {
        const people = [...conflicts.peopleOf(meeting)].filter(id => id !== String(req.user.sub));
        await notifyInvitees(req.io, { meeting, recipientIds: people, clashes: found, moved: true });
      } catch (notifErr) {
        logger.error('Notification error on schedule move:', notifErr.message);
      }
    }

    const updated = await presentFor(saved, req.user.sub);
    res.json({ meeting: updated, conflicts: updated.conflicts });
  } catch (err) {
    fail(res, err, 'Failed to update meeting');
  }
}

async function deleteScheduledMeeting(req, res) {
  try {
    let loaded;
    try {
      loaded = await loadMeetingForUser(req.params.id, req.user.sub);
    } catch (err) {
      return sendAccessError(res, err);
    }
    if (!canManageMeeting(loaded.meeting, req.user.sub, loaded.access)) {
      return res.status(403).json({ message: 'Only the organizer or a workspace admin can delete this meeting' });
    }

    await ScheduledMeeting.deleteOne({ _id: req.params.id });
    try {
      await conflicts.clearClashes({ ...loaded.meeting, _id: loaded.meeting._id || req.params.id }, { io: req.io });
    } catch (err) {
      logger.error('[scheduled-meetings] clearing clashes failed:', err.message);
    }

    req.io.to(`workspace:${loaded.meeting.workspaceId}`).emit('schedule:deleted', { meetingId: req.params.id });

    res.json({ message: 'Meeting deleted' });
  } catch (err) {
    fail(res, err, 'Failed to delete meeting');
  }
}

module.exports = {
  getScheduledMeetings,
  checkConflicts,
  createScheduledMeeting,
  updateScheduledMeeting,
  deleteScheduledMeeting,
};
