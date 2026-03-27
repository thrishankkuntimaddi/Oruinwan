'use strict';
// server/src/features/meetings/meetings.controller.js

const meetingsService = require('./meetings.service');
const logger = require('../../../utils/logger');
const notifEmitter = require('../notifications/notificationEventEmitter');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve companyId for the requesting user (null for personal accounts).
 * Shared across handlers to enforce S-02 tenant isolation.
 */
async function resolveCompanyId(req) {
    const User = require('../../../models/User');
    const dbUser = await User.findById(req.user.sub).select('companyId').lean();
    return dbUser?.companyId || null;
}

/**
 * Verify the requesting user is a member of the target workspace.
 */
async function assertWorkspaceMember(workspaceId, userId, companyId) {
    const Workspace = require('../../../models/Workspace');
    const wsQuery = { _id: workspaceId, 'members.user': userId };
    if (companyId) wsQuery.company = companyId;
    const ws = await Workspace.findOne(wsQuery).select('_id').lean();
    return !!ws;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/v2/meetings?workspaceId=xxx
 */
async function getMeetings(req, res) {
    try {
        const { workspaceId, limit, includeCompleted } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

        const companyId = await resolveCompanyId(req);
        const allowed = await assertWorkspaceMember(workspaceId, req.user.sub, companyId);
        if (!allowed) return res.status(403).json({ message: 'Access denied' });

        const meetings = await meetingsService.getMeetings({
            workspaceId,
            userId: req.user.sub,
            companyId,
            limit,
            includeCompleted: includeCompleted !== 'false',
        });
        res.json({ meetings });
    } catch (err) {
        logger.error('[Meetings] getMeetings error:', err);
        res.status(500).json({ message: 'Failed to fetch meetings' });
    }
}

/**
 * GET /api/v2/meetings/:id
 */
async function getMeeting(req, res) {
    try {
        const companyId = await resolveCompanyId(req);
        const meeting = await meetingsService.getMeeting(req.params.id, { companyId });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
        res.json({ meeting });
    } catch (err) {
        logger.error('[Meetings] getMeeting error:', err);
        res.status(500).json({ message: 'Failed to fetch meeting' });
    }
}

/**
 * POST /api/v2/meetings/:id/join
 */
async function joinMeeting(req, res) {
    try {
        const companyId = await resolveCompanyId(req);
        const meeting = await meetingsService.joinMeeting(req.params.id, req.user.sub, { companyId });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        // Broadcast join event via socket
        req.io.to(`meeting:${req.params.id}`).emit('meeting:joined', {
            meetingId: req.params.id,
            userId: req.user.sub,
            timestamp: new Date(),
        });

        res.json({ meeting });
    } catch (err) {
        logger.error('[Meetings] joinMeeting error:', err);
        res.status(500).json({ message: 'Failed to join meeting' });
    }
}

/**
 * PATCH /api/v2/meetings/:id/end
 */
async function endMeeting(req, res) {
    try {
        const { recordingUrl } = req.body;
        const companyId = await resolveCompanyId(req);
        const meeting = await meetingsService.endMeeting(req.params.id, { companyId, recordingUrl });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        // Broadcast end event
        req.io.to(`meeting:${req.params.id}`).emit('meeting:ended', {
            meetingId: req.params.id,
            endedBy: req.user.sub,
            timestamp: new Date(),
        });

        res.json({ meeting });
    } catch (err) {
        logger.error('[Meetings] endMeeting error:', err);
        res.status(500).json({ message: 'Failed to end meeting' });
    }
}

/**
 * PATCH /api/v2/meetings/:id/agenda
 * Body: { agenda: [{ title, notes, order }] }
 */
async function updateAgenda(req, res) {
    try {
        const { agenda } = req.body;
        if (!Array.isArray(agenda)) return res.status(400).json({ message: 'agenda must be an array' });

        const companyId = await resolveCompanyId(req);
        const meeting = await meetingsService.updateAgenda(req.params.id, agenda, { companyId });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        // Broadcast agenda update to meeting room
        req.io.to(`meeting:${req.params.id}`).emit('meeting:agenda_updated', {
            meetingId: req.params.id,
            agenda: meeting.agenda,
        });

        res.json({ meeting });
    } catch (err) {
        logger.error('[Meetings] updateAgenda error:', err);
        res.status(500).json({ message: 'Failed to update agenda' });
    }
}

/**
 * PATCH /api/v2/meetings/:id/transcript
 * Body: { transcript: "..." }
 */
async function updateTranscript(req, res) {
    try {
        const { transcript } = req.body;
        if (typeof transcript !== 'string') return res.status(400).json({ message: 'transcript must be a string' });

        const companyId = await resolveCompanyId(req);
        const meeting = await meetingsService.updateTranscript(req.params.id, transcript, { companyId });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        res.json({ meeting });
    } catch (err) {
        logger.error('[Meetings] updateTranscript error:', err);
        res.status(500).json({ message: 'Failed to update transcript' });
    }
}

/**
 * POST /api/v2/meetings/:id/summarize
 * Generates an AI summary from the stored transcript.
 */
async function summarizeMeeting(req, res) {
    try {
        const companyId = await resolveCompanyId(req);
        const summary = await meetingsService.summarizeMeeting(req.params.id, { companyId });
        if (summary === null) return res.status(404).json({ message: 'Meeting not found' });

        res.json({ summary });
    } catch (err) {
        logger.error('[Meetings] summarizeMeeting error:', err);
        res.status(500).json({ message: 'Failed to generate summary' });
    }
}

/**
 * POST /api/v2/meetings/suggest-time
 * Body: { participantIds: [...], durationMinutes: 30 }
 */
async function suggestTime(req, res) {
    try {
        const { participantIds = [], durationMinutes = 30 } = req.body;
        const suggestion = await meetingsService.suggestTime({ participantIds, durationMinutes });
        res.json(suggestion);
    } catch (err) {
        logger.error('[Meetings] suggestTime error:', err);
        res.status(500).json({ message: 'Failed to suggest time' });
    }
}

/**
 * POST /api/v2/meetings/:id/action-items
 * Body: { text, assignedTo?, status? }
 */
async function addActionItem(req, res) {
    try {
        const { text, assignedTo, status } = req.body;
        if (!text) return res.status(400).json({ message: 'text is required' });

        const companyId = await resolveCompanyId(req);
        const meeting = await meetingsService.addActionItem(
            req.params.id,
            { text, assignedTo, status },
            { companyId }
        );
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        res.status(201).json({ meeting });
    } catch (err) {
        logger.error('[Meetings] addActionItem error:', err);
        res.status(500).json({ message: 'Failed to add action item' });
    }
}

/**
 * PATCH /api/v2/meetings/:id/action-items/:aid
 * Body: { text?, status?, assignedTo?, taskId? }
 */
async function updateActionItem(req, res) {
    try {
        const companyId = await resolveCompanyId(req);
        const meeting = await meetingsService.updateActionItem(
            req.params.id,
            req.params.aid,
            req.body,
            { companyId }
        );
        if (!meeting) return res.status(404).json({ message: 'Meeting or action item not found' });

        res.json({ meeting });
    } catch (err) {
        logger.error('[Meetings] updateActionItem error:', err);
        res.status(500).json({ message: 'Failed to update action item' });
    }
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
    addActionItem,
    updateActionItem,
};
