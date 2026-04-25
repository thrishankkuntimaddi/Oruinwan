'use strict';

const meetingsService = require('./meetings.service');
const logger = require('../../../utils/logger');
const notifEmitter = require('../notifications/notificationEventEmitter');

async function resolveCompanyId(req) {
    const User = require('../../../models/User');
    const dbUser = await User.findById(req.user.sub).select('companyId').lean();
    return dbUser?.companyId || null;
}

async function assertWorkspaceMember(workspaceId, userId, companyId) {
    const Workspace = require('../../../models/Workspace');
    const wsQuery = { _id: workspaceId, 'members.user': userId };
    if (companyId) wsQuery.company = companyId;
    const ws = await Workspace.findOne(wsQuery).select('_id').lean();
    return !!ws;
}

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

async function joinMeeting(req, res) {
    try {
        const companyId = await resolveCompanyId(req);
        const meeting = await meetingsService.joinMeeting(req.params.id, req.user.sub, { companyId });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        
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

async function endMeeting(req, res) {
    try {
        const { recordingUrl } = req.body;
        const companyId = await resolveCompanyId(req);
        const meeting = await meetingsService.endMeeting(req.params.id, { companyId, recordingUrl });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        
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

async function updateAgenda(req, res) {
    try {
        const { agenda } = req.body;
        if (!Array.isArray(agenda)) return res.status(400).json({ message: 'agenda must be an array' });

        const companyId = await resolveCompanyId(req);
        const meeting = await meetingsService.updateAgenda(req.params.id, agenda, { companyId });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        
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
