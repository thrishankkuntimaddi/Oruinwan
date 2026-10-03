'use strict';

const ScheduledMeeting = require('../../models/ScheduledMeeting');
const logger = require('../../../utils/logger');
const { assertWorkspaceMember, isValidId, sendAccessError } = require('../../shared/utils/workspaceAccess');
const { loadMeetingForUser, canManageMeeting } = require('./meetingAccess');

// Scheduled meetings are scoped by workspace. companyId is optional (set from
// the workspace's company when it has one) so personal workspaces work too.
// Reading/creating: any active workspace member. Cancelling or deleting: the
// organiser (createdBy) or a workspace owner/admin.

// Users live in PostgreSQL: the organizer is attached with hydrate (populate cannot reach it).
const { hydrate } = require('../../identity/hydrate');
const CREATOR = { type: 'user', fields: ['username', 'profilePicture', 'profile'] };
const withCreator = (m) => hydrate(typeof m.toObject === 'function' ? m.toObject() : m, { createdBy: CREATOR });
const VALID_STATUSES = ['scheduled', 'live', 'completed', 'cancelled'];

function fail(res, err, fallback) {
  if (err && err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err && err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  logger.error(`[scheduled-meetings] ${fallback}:`, err);
  return res.status(500).json({ message: fallback });
}

const activeMemberIds = (ws) => (ws.members || [])
  .filter(m => (m.status || 'active') === 'active')
  .map(m => String(m.user?._id || m.user));

async function getScheduledMeetings(req, res) {
  try {
    const { workspaceId, limit = 10 } = req.query;
    try {
      await assertWorkspaceMember(workspaceId, req.user.sub);
    } catch (err) {
      return sendAccessError(res, err);
    }

    const query = { workspaceId, startTime: { $gte: new Date() }, status: { $in: ['scheduled', 'live'] } };
    const meetings = await ScheduledMeeting.find(query)
      .sort({ startTime: 1 })
      .limit(Math.min(Math.max(Number(limit) || 10, 1), 100))
      .lean();

    await hydrate(meetings, { createdBy: CREATOR });

    res.json({ meetings });
  } catch (err) {
    fail(res, err, 'Failed to fetch meetings');
  }
}

async function createScheduledMeeting(req, res) {
  try {
    const { workspaceId, channelId, dmSessionId, title, startTime, duration, meetingLink, participants } = req.body || {};
    if (!workspaceId || typeof title !== 'string' || !title.trim() || !startTime) {
      return res.status(400).json({ message: 'workspaceId, title, and startTime are required' });
    }
    if (Number.isNaN(new Date(startTime).getTime())) return res.status(400).json({ message: 'Invalid startTime' });
    if (channelId && !isValidId(channelId)) return res.status(400).json({ message: 'Invalid channelId' });
    if (dmSessionId && !isValidId(dmSessionId)) return res.status(400).json({ message: 'Invalid dmSessionId' });
    if (participants !== undefined && !Array.isArray(participants)) {
      return res.status(400).json({ message: 'participants must be an array of user ids' });
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
    // Only active members of this workspace can be invited.
    const participantIds = [...new Set((participants || []).map(String))].filter(id => isValidId(id) && memberSet.has(id));

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
      status: 'scheduled',
    });

    const populated = await withCreator(meeting);

    req.io.to(`workspace:${workspaceId}`).emit('schedule:created', { meeting: populated });

    try {
      const notifService = require('../../modules/notifications/notificationService');
      await notifService.scheduleCreated(req.io, {
        recipientIds: memberIds.filter(id => id !== String(req.user.sub)),
        workspaceId,
        title: meeting.title,
        scheduledMeetingId: meeting._id,
      });
    } catch (notifErr) {
      logger.error('Notification error on schedule create:', notifErr.message);
    }

    res.status(201).json({ meeting: populated });
  } catch (err) {
    fail(res, err, 'Failed to create meeting');
  }
}

async function updateScheduledMeeting(req, res) {
  try {
    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    let loaded;
    try {
      loaded = await loadMeetingForUser(req.params.id, req.user.sub);
    } catch (err) {
      return sendAccessError(res, err);
    }
    if (status === 'cancelled' && !canManageMeeting(loaded.meeting, req.user.sub, loaded.access)) {
      return res.status(403).json({ message: 'Only the organizer or a workspace admin can cancel this meeting' });
    }

    const meeting = await ScheduledMeeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    meeting.status = status;
    await meeting.save();
    const updated = await withCreator(meeting);

    req.io.to(`workspace:${meeting.workspaceId}`).emit('schedule:updated', { meeting: updated });

    res.json({ meeting: updated });
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

    req.io.to(`workspace:${loaded.meeting.workspaceId}`).emit('schedule:deleted', { meetingId: req.params.id });

    res.json({ message: 'Meeting deleted' });
  } catch (err) {
    fail(res, err, 'Failed to delete meeting');
  }
}

module.exports = {
  getScheduledMeetings,
  createScheduledMeeting,
  updateScheduledMeeting,
  deleteScheduledMeeting,
};
