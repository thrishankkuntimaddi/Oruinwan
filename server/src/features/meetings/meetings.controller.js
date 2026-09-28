'use strict';

const meetingsService = require('./meetings.service');
const logger = require('../../../utils/logger');
const { assertWorkspaceMember, isValidId, sendAccessError } = require('../../shared/utils/workspaceAccess');

// Every /:id route runs behind requireMeetingAccess('id') (see meetings.routes.js),
// which rejects malformed ids (400), unknown meetings (404) and callers who are
// not active members of the meeting's workspace (403). Meetings are scoped by
// workspace, not company, so personal (company-less) workspaces work too.

const ACTION_STATUSES = ['pending', 'in_progress', 'done'];

function fail(res, err, fallback) {
    if (err && err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    if (err && err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
    logger.error(`[Meetings] ${fallback}:`, err);
    return res.status(500).json({ message: fallback });
}

async function getMeetings(req, res) {
    try {
        const { workspaceId, limit, includeCompleted } = req.query;
        try {
            await assertWorkspaceMember(workspaceId, req.user.sub);
        } catch (err) {
            return sendAccessError(res, err);
        }
        const meetings = await meetingsService.getMeetings({
            workspaceId,
            userId: req.user.sub,
            limit: Math.min(Math.max(Number(limit) || 20, 1), 100),
            includeCompleted: includeCompleted !== 'false',
        });
        res.json({ meetings });
    } catch (err) {
        fail(res, err, 'Failed to fetch meetings');
    }
}

async function getMeeting(req, res) {
    try {
        const meeting = await meetingsService.getMeeting(req.params.id);
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
        res.json({ meeting });
    } catch (err) {
        fail(res, err, 'Failed to fetch meeting');
    }
}

async function joinMeeting(req, res) {
    try {
        const meeting = await meetingsService.joinMeeting(req.params.id, req.user.sub);
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        req.io.to(`meeting:${req.params.id}`).emit('meeting:joined', {
            meetingId: req.params.id,
            userId: req.user.sub,
            timestamp: new Date(),
        });

        res.json({ meeting });
    } catch (err) {
        fail(res, err, 'Failed to join meeting');
    }
}

async function endMeeting(req, res) {
    try {
        const { recordingUrl } = req.body || {};
        if (recordingUrl !== undefined && recordingUrl !== null && typeof recordingUrl !== 'string') {
            return res.status(400).json({ message: 'recordingUrl must be a string' });
        }
        const meeting = await meetingsService.endMeeting(req.params.id, { recordingUrl });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        req.io.to(`meeting:${req.params.id}`).emit('meeting:ended', {
            meetingId: req.params.id,
            endedBy: req.user.sub,
            timestamp: new Date(),
        });

        res.json({ meeting });
    } catch (err) {
        fail(res, err, 'Failed to end meeting');
    }
}

async function updateAgenda(req, res) {
    try {
        const { agenda } = req.body || {};
        if (!Array.isArray(agenda)) return res.status(400).json({ message: 'agenda must be an array' });
        if (agenda.some(a => !a || typeof a.title !== 'string' || !a.title.trim())) {
            return res.status(400).json({ message: 'Every agenda item needs a title' });
        }

        const meeting = await meetingsService.updateAgenda(req.params.id, agenda);
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        req.io.to(`meeting:${req.params.id}`).emit('meeting:agenda_updated', {
            meetingId: req.params.id,
            agenda: meeting.agenda,
        });

        res.json({ meeting });
    } catch (err) {
        fail(res, err, 'Failed to update agenda');
    }
}

async function updateTranscript(req, res) {
    try {
        const { transcript } = req.body || {};
        if (typeof transcript !== 'string') return res.status(400).json({ message: 'transcript must be a string' });

        const meeting = await meetingsService.updateTranscript(req.params.id, transcript);
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        res.json({ meeting });
    } catch (err) {
        fail(res, err, 'Failed to update transcript');
    }
}

async function summarizeMeeting(req, res) {
    try {
        const summary = await meetingsService.summarizeMeeting(req.params.id);
        if (summary === null) return res.status(404).json({ message: 'Meeting not found' });

        res.json({ summary });
    } catch (err) {
        fail(res, err, 'Failed to generate summary');
    }
}

async function suggestTime(req, res) {
    try {
        const { participantIds = [], durationMinutes = 30 } = req.body || {};
        const suggestion = await meetingsService.suggestTime({ participantIds, durationMinutes });
        res.json(suggestion);
    } catch (err) {
        fail(res, err, 'Failed to suggest time');
    }
}

function validateActionItemBody({ assignedTo, status }) {
    if (assignedTo !== undefined && assignedTo !== null && assignedTo !== '' && !isValidId(assignedTo)) return 'Invalid assignedTo';
    if (status !== undefined && !ACTION_STATUSES.includes(status)) return `status must be one of ${ACTION_STATUSES.join(', ')}`;
    return null;
}

async function addActionItem(req, res) {
    try {
        const { text, assignedTo, status } = req.body || {};
        if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ message: 'text is required' });
        const invalid = validateActionItemBody({ assignedTo, status });
        if (invalid) return res.status(400).json({ message: invalid });

        const meeting = await meetingsService.addActionItem(req.params.id, { text, assignedTo: assignedTo || null, status });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        res.status(201).json({ meeting });
    } catch (err) {
        fail(res, err, 'Failed to add action item');
    }
}

async function updateActionItem(req, res) {
    try {
        if (!isValidId(req.params.aid)) return res.status(400).json({ message: 'Invalid action item id' });
        const body = req.body || {};
        const invalid = validateActionItemBody(body);
        if (invalid) return res.status(400).json({ message: invalid });
        if (body.taskId !== undefined && body.taskId !== null && !isValidId(body.taskId)) {
            return res.status(400).json({ message: 'Invalid taskId' });
        }

        const meeting = await meetingsService.updateActionItem(req.params.id, req.params.aid, body);
        if (!meeting) return res.status(404).json({ message: 'Meeting or action item not found' });

        res.json({ meeting });
    } catch (err) {
        fail(res, err, 'Failed to update action item');
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
