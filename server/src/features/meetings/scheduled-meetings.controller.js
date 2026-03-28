'use strict';
// server/src/features/meetings/scheduled-meetings.controller.js
//
// Controllers for the /api/scheduled-meetings resource.
// Logic migrated verbatim from server.js (Phase 4 cleanup).
// NO behavior change — same inputs → same outputs.

const ScheduledMeeting = require('../../models/ScheduledMeeting');
const logger = require('../../../utils/logger');

// ─── Helpers (local — mirrors what was inlined in server.js) ─────────────────

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

// ─── GET /api/scheduled-meetings?workspaceId=xxx ──────────────────────────────
// S-02 + personal account fix:
// - Company accounts: companyId resolved from DB, workspace ownership validated (cross-tenant guard).
// - Personal accounts: no companyId — query scoped to workspaceId only.
//   Tenant isolation for personal accounts comes from requireWorkspaceMember (caller owns workspace).
async function getScheduledMeetings(req, res) {
  try {
    const { workspaceId, limit = 10 } = req.query;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

    const dbUser = await resolveUser(req.user.sub);
    if (!dbUser) return res.status(401).json({ message: 'User not found' });

    const now = new Date();
    let query = { workspaceId, startTime: { $gte: now }, status: { $in: ['scheduled', 'live'] } };

    // For both company and personal accounts, verify the requesting user is a member of the workspace.
    // 'members.user' is the correct subdocument field (members: [{ user: ObjectId, role, status }]).
    // Company workspaces implicitly enforce tenant isolation since only company members are added.
    const ws = await resolveWorkspace(workspaceId, req.user.sub);
    if (!ws) return res.status(403).json({ message: 'Access denied' });

    // For company accounts: additionally scope the meetings query to their company's tenant
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

// ─── POST /api/scheduled-meetings ────────────────────────────────────────────
// PERSONAL ACCOUNT FIX: companyId is optional — personal accounts don't have one.
// Security is enforced via workspace membership check (must be member of the workspace).
// When companyId is available (company accounts), it is stored for S-02 tenant isolation.
async function createScheduledMeeting(req, res) {
  try {
    const { workspaceId, channelId, dmSessionId, title, startTime, duration, meetingLink, participants } = req.body;
    if (!workspaceId || !title || !startTime) {
      return res.status(400).json({ message: 'workspaceId, title, and startTime are required' });
    }

    // Resolve caller's companyId (may be null for personal accounts)
    const dbUser = await resolveUser(req.user.sub);
    if (!dbUser) return res.status(401).json({ message: 'User not found' });
    const companyId = dbUser.companyId || null;

    // Verify caller is a member of the workspace (primary access control)
    const WorkspaceModel = require('../../../models/Workspace');
    let wsQuery = { _id: workspaceId, 'members.user': req.user.sub };
    // For company accounts: additionally scope to their company to prevent cross-tenant access
    if (companyId) wsQuery.company = companyId;

    const ws = await WorkspaceModel.findOne(wsQuery).select('_id members').lean();
    if (!ws) return res.status(403).json({ message: 'Access denied' });

    const meeting = await ScheduledMeeting.create({
      companyId,          // null for personal accounts, ObjectId for company accounts
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

    // Broadcast to workspace so all HomePanel sidebars refresh
    req.io.to(`workspace:${workspaceId}`).emit('schedule:created', { meeting: populated });

    // Create notifications for all workspace members
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

// ─── PATCH /api/scheduled-meetings/:id ───────────────────────────────────────
// S-02 SECURITY FIX: meeting.companyId checked before allowing update.
async function updateScheduledMeeting(req, res) {
  try {
    const { status } = req.body;
    const VALID_STATUSES = ['scheduled', 'live', 'completed', 'cancelled'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // S-02: Load meeting first to verify tenant ownership
    const meeting = await ScheduledMeeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    // S-02: Check caller's companyId matches meeting's companyId
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

// ─── DELETE /api/scheduled-meetings/:id ──────────────────────────────────────
// S-02 SECURITY FIX: meeting.companyId checked before allowing deletion.
async function deleteScheduledMeeting(req, res) {
  try {
    // S-02: Load meeting first to verify tenant ownership before deleting
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
