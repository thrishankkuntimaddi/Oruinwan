'use strict';

const ScheduledMeeting = require('../../models/ScheduledMeeting');
const logger = require('../../../utils/logger');

async function resolveUser(userId) {
  const User = require('../../../models/User');
  return User.findById(userId).select('companyId').lean();
}

async function resolveWorkspace(workspaceId, userId) {
  const WorkspaceModel = require('../../../models/Workspace');
  return WorkspaceModel.findOne({
    _id: workspaceId,
    'members.user': userId,
  }).select('_id company').lean();
}

async function getScheduledMeetings(req, res) {
  try {
    const { workspaceId, limit = 10 } = req.query;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

    const dbUser = await resolveUser(req.user.sub);
    if (!dbUser) return res.status(401).json({ message: 'User not found' });

    const now = new Date();
    let query = { workspaceId, startTime: { $gte: now }, status: { $in: ['scheduled', 'live'] } };

    
    
    
    const ws = await resolveWorkspace(workspaceId, req.user.sub);
    if (!ws) return res.status(403).json({ message: 'Access denied' });

    
    if (dbUser.companyId) {
      query.companyId = dbUser.companyId;
    }

    const meetings = await ScheduledMeeting.find(query)
      .sort({ startTime: 1 })
      .limit(Number(limit))
      .populate('createdBy', 'username firstName lastName avatarUrl')
      .lean();

    res.json({ meetings });
  } catch (err) {
    logger.error('GET /api/scheduled-meetings error:', err);
    res.status(500).json({ message: 'Failed to fetch meetings' });
  }
}

async function createScheduledMeeting(req, res) {
  try {
    const { workspaceId, channelId, dmSessionId, title, startTime, duration, meetingLink, participants } = req.body;
    if (!workspaceId || !title || !startTime) {
      return res.status(400).json({ message: 'workspaceId, title, and startTime are required' });
    }

    
    const dbUser = await resolveUser(req.user.sub);
    if (!dbUser) return res.status(401).json({ message: 'User not found' });
    const companyId = dbUser.companyId || null;

    
    const WorkspaceModel = require('../../../models/Workspace');
    let wsQuery = { _id: workspaceId, 'members.user': req.user.sub };
    
    if (companyId) wsQuery.company = companyId;

    const ws = await WorkspaceModel.findOne(wsQuery).select('_id members').lean();
    if (!ws) return res.status(403).json({ message: 'Access denied' });

    const meeting = await ScheduledMeeting.create({
      companyId,          
      workspaceId,
      channelId: channelId || null,
      dmSessionId: dmSessionId || null,
      createdBy: req.user.sub,
      title: title.trim(),
      startTime: new Date(startTime),
      duration: duration || 30,
      meetingLink: meetingLink || null,
      participants: participants || [],
      status: 'scheduled',
    });

    const populated = await meeting.populate('createdBy', 'username firstName lastName avatarUrl');

    
    req.io.to(`workspace:${workspaceId}`).emit('schedule:created', { meeting: populated });

    
    try {
      const notifService = require('../notifications/notificationService');
      if (ws && ws.members) {
        const recipientIds = ws.members
          .map(m => (m.user || m).toString())
          .filter(id => id !== req.user.sub.toString());
        await notifService.scheduleCreated(req.io, {
          recipientIds,
          workspaceId,
          title: meeting.title,
          scheduledMeetingId: meeting._id,
        });
      }
    } catch (notifErr) {
      logger.error('Notification error on schedule create:', notifErr.message);
    }

    res.status(201).json({ meeting: populated });
  } catch (err) {
    logger.error('POST /api/scheduled-meetings error:', err);
    res.status(500).json({ message: 'Failed to create meeting' });
  }
}

async function updateScheduledMeeting(req, res) {
  try {
    const { status } = req.body;
    const VALID_STATUSES = ['scheduled', 'live', 'completed', 'cancelled'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    
    const meeting = await ScheduledMeeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    
    const dbUser = await resolveUser(req.user.sub);
    if (!dbUser || !meeting.companyId || dbUser.companyId.toString() !== meeting.companyId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    meeting.status = status;
    await meeting.save();
    await meeting.populate('createdBy', 'username firstName lastName avatarUrl');

    req.io.to(`workspace:${meeting.workspaceId}`).emit('schedule:updated', { meeting });

    res.json({ meeting });
  } catch (err) {
    logger.error('PATCH /api/scheduled-meetings/:id error:', err);
    res.status(500).json({ message: 'Failed to update meeting' });
  }
}

async function deleteScheduledMeeting(req, res) {
  try {
    
    const meeting = await ScheduledMeeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    const dbUser = await resolveUser(req.user.sub);
    if (!dbUser || !meeting.companyId || dbUser.companyId.toString() !== meeting.companyId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await meeting.deleteOne();

    req.io.to(`workspace:${meeting.workspaceId}`).emit('schedule:deleted', { meetingId: meeting._id });

    res.json({ message: 'Meeting deleted' });
  } catch (err) {
    logger.error('DELETE /api/scheduled-meetings/:id error:', err);
    res.status(500).json({ message: 'Failed to delete meeting' });
  }
}

module.exports = {
  getScheduledMeetings,
  createScheduledMeeting,
  updateScheduledMeeting,
  deleteScheduledMeeting,
};
