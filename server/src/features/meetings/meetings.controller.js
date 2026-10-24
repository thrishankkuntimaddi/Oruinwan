'use strict';

const meetingsService = require('./meetings.service');
const records = () => require('./meetingRecords');
const logger = require('../../../utils/logger');
const { assertWorkspaceMember, isValidId, sendAccessError } = require('../../shared/utils/workspaceAccess');
const { loadMeetingForUser } = require('./meetingAccess');

// Every /:id route runs behind requireMeetingAccess('id') (see meetings.routes.js),
// which rejects malformed ids (400), unknown meetings (404) and callers who are
// not active members of the meeting's workspace (403). Meetings are scoped by
// workspace, not company, so personal (company-less) workspaces work too.

const ACTION_STATUSES = ['pending', 'in_progress', 'done'];

function fail(res, err, fallback) {
    if (require('../../shared/plans').sendPlanLimit(res, err)) return res;
    const status = err?.status || err?.statusCode;
    if (status && status < 500) return res.status(status).json({ message: err.message });
    if (err && err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    if (err && err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
    logger.error(`[Meetings] ${fallback}:`, err);
    return res.status(500).json({ message: fallback });
}

async function getMeetings(req, res) {
    try {
        const { workspaceId, limit, includeCompleted, status } = req.query;
        try {
            await assertWorkspaceMember(workspaceId, req.user.sub);
        } catch (err) {
            return sendAccessError(res, err);
        }
        if (status !== undefined) {
            // Unified list: scheduled meetings and ad-hoc huddles the caller can open.
            const q = req.query;
            return res.json(await records().listMeetings(req.user.sub, {
                workspaceId,
                status: String(status),
                kind: q.kind ? String(q.kind) : undefined,
                q: q.q ? String(q.q) : undefined,
                before: q.before ? String(q.before) : undefined,
                after: q.after ? String(q.after) : undefined,
                limit: q.limit,
                includeShort: q.includeShort === '1' || q.includeShort === 'true',
            }));
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
        const meeting = await meetingsService.getMeeting(req.params.id, { viewerId: req.user.sub });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
        res.json({ meeting });
    } catch (err) {
        fail(res, err, 'Failed to fetch meeting');
    }
}

async function getMeetingByHuddle(req, res) {
    try {
        const huddleId = String(req.params.huddleId || '');
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(huddleId)) return res.status(400).json({ message: 'Invalid huddle id' });
        const found = await records().findByHuddle(huddleId);
        if (!found) return res.status(404).json({ message: 'This huddle has no meeting' });
        try {
            await loadMeetingForUser(String(found._id), req.user.sub);
        } catch (err) {
            return sendAccessError(res, err);
        }
        const meeting = await records().getMeetingView(found._id, { viewerId: req.user.sub });
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
        // Completes the meeting ('meeting:ended' + recap notifications) and ends its live huddle.
        const meeting = await meetingsService.endMeeting(req.params.id, { recordingUrl, io: req.io, endedBy: req.user.sub });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

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
        const result = await records().summarize(req.params.id, { userId: req.user.sub, io: req.io });
        if (result === null) return res.status(404).json({ message: 'Meeting not found' });

        // `summary` stays the text for older clients; `meetingSummary` is meeting.summary.
        res.json({ summary: result.text, meetingSummary: result.summary, source: result.source, aiFallback: result.aiFallback });
    } catch (err) {
        fail(res, err, 'Failed to generate summary');
    }
}

async function suggestTime(req, res) {
    try {
        const { participantIds = [], durationMinutes = 30, workspaceId, from, to, limit, stepMinutes, timezone } = req.body || {};
        if (!Array.isArray(participantIds)) return res.status(400).json({ message: 'participantIds must be an array' });
        let ids = [...new Set([...participantIds.map(String), String(req.user.sub)])];
        if (workspaceId) {
            // Only people in the workspace: anyone else's busy time is not the caller's business.
            let access;
            try {
                access = await assertWorkspaceMember(workspaceId, req.user.sub);
            } catch (err) {
                return sendAccessError(res, err);
            }
            const members = new Set((access.workspace?.members || [])
                .filter((m) => (m.status || 'active') === 'active')
                .map((m) => String(m.user?._id || m.user)));
            ids = ids.filter((id) => members.has(id));
        }
        const suggestion = await meetingsService.suggestTime({
            participantIds: ids, durationMinutes, from, to, limit, stepMinutes,
            timezone: typeof timezone === 'string' ? timezone : undefined,
        });
        res.json(suggestion);
    } catch (err) {
        fail(res, err, 'Failed to suggest time');
    }
}

function validateActionItemBody({ assignedTo, assigneeId, status, done, dueDate }) {
    if (assignedTo !== undefined && assignedTo !== null && assignedTo !== '' && !isValidId(assignedTo)) return 'Invalid assignedTo';
    if (assigneeId !== undefined && assigneeId !== null && assigneeId !== '' && !isValidId(assigneeId)) return 'Invalid assigneeId';
    if (status !== undefined && !ACTION_STATUSES.includes(status)) return `status must be one of ${ACTION_STATUSES.join(', ')}`;
    if (done !== undefined && typeof done !== 'boolean') return 'done must be true or false';
    if (dueDate !== undefined && dueDate !== null && dueDate !== '' && Number.isNaN(new Date(dueDate).getTime())) return 'Invalid dueDate';
    return null;
}

// -- Unified meeting record: notes, action items, summary (docs/api/meetings-unified.md) --

const handle = (fn, { status = 200, fallback = 'Request failed' } = {}) => async (req, res) => {
    try {
        res.status(status).json(await fn(req));
    } catch (err) {
        fail(res, err, fallback);
    }
};

const requireItemId = (req) => {
    if (!isValidId(req.params.aid)) throw Object.assign(new Error('Invalid action item id'), { status: 400 });
    return req.params.aid;
};

const ensureNotes = handle((req) => records().ensureNote(req.params.id, req.user.sub, { io: req.io }), { fallback: 'Failed to open the meeting notes' });

const listActionItems = handle(async (req) => {
    const meeting = await records().getMeetingView(req.params.id);
    return { actionItems: meeting?.actionItems || [] };
}, { fallback: 'Failed to load action items' });

const deleteActionItem = handle((req) => records().removeActionItem(req.params.id, requireItemId(req), { io: req.io }), { fallback: 'Failed to delete action item' });

const toggleActionItem = handle((req) => records().toggleActionItem(req.params.id, requireItemId(req), { io: req.io }), { fallback: 'Failed to update action item' });

const convertActionItem = handle((req) => records().convertActionItem(req.params.id, requireItemId(req), req.user.sub, { io: req.io, req, body: req.body || {} }), { fallback: 'Failed to create the task' });

const putSummary = handle(async (req) => {
    const { text } = req.body || {};
    if (typeof text !== 'string') throw Object.assign(new Error('text must be a string'), { status: 400 });
    return { summary: await records().setSummary(req.params.id, { text, by: req.user.sub, source: 'manual' }, { io: req.io }) };
}, { fallback: 'Failed to save the summary' });

async function addActionItem(req, res) {
    try {
        const body = req.body || {};
        if (typeof body.text !== 'string' || !body.text.trim()) return res.status(400).json({ message: 'text is required' });
        const invalid = validateActionItemBody(body);
        if (invalid) return res.status(400).json({ message: invalid });

        const meeting = await meetingsService.addActionItem(req.params.id, body, { userId: req.user.sub, io: req.io });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        const items = meeting.actionItems || [];
        res.status(201).json({ meeting, actionItem: items[items.length - 1] || null, actionItems: items });
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

        const meeting = await meetingsService.updateActionItem(req.params.id, req.params.aid, body, { io: req.io });
        if (!meeting) return res.status(404).json({ message: 'Meeting or action item not found' });

        const actionItem = (meeting.actionItems || []).find((a) => String(a.id) === String(req.params.aid)) || null;
        res.json({ meeting, actionItem, actionItems: meeting.actionItems || [] });
    } catch (err) {
        fail(res, err, 'Failed to update action item');
    }
}

module.exports = {
    getMeetings,
    getMeeting,
    getMeetingByHuddle,
    ensureNotes,
    listActionItems,
    deleteActionItem,
    toggleActionItem,
    convertActionItem,
    putSummary,
    joinMeeting,
    endMeeting,
    updateAgenda,
    updateTranscript,
    summarizeMeeting,
    suggestTime,
    addActionItem,
    updateActionItem,
};
