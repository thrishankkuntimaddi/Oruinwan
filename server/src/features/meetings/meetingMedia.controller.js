'use strict';

/**
 * Scheduled meetings: recording upload/playback/delete, transcript segments and
 * transcript-based action items. Every route except the signed stream runs behind
 * requireMeetingAccess('id'), which sets req.meeting / req.meetingAccess.
 */

const logger = require('../../../utils/logger');
const meetingsService = require('./meetings.service');
const recordings = require('./recordings');
const transcript = require('./transcript');
const { loadMeetingForUser, canManageMeeting } = require('./meetingAccess');

const idOf = (v) => String(v?._id || v || '');

function fail(res, err, fallback) {
    const status = err?.status || err?.statusCode;
    if (status && status < 500) return res.status(status).json({ message: err.message });
    if (err && err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
    logger.error(`[Meetings] ${fallback}:`, err);
    return res.status(500).json({ message: fallback });
}

const isAttendee = (meeting, userId) => idOf(meeting.createdBy) === String(userId)
    || (meeting.participants || []).some((p) => idOf(p) === String(userId));

// ── Recording ───────────────────────────────────────────────────────────────

async function uploadRecording(req, res) {
    try {
        if (!req.file) return res.status(400).json({ message: 'Attach the recording as the "file" field' });
        const duration = recordings.parseDuration(req.body?.durationSec);
        if (duration.error) return res.status(400).json({ message: duration.error });

        const meeting = await meetingsService.loadForRecording(req.params.id);
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
        if (!isAttendee(meeting, req.user.sub) && !req.meetingAccess?.isAdmin) {
            return res.status(403).json({ message: 'Only the organizer, invited people or a workspace admin can upload the recording' });
        }

        const doc = await recordings.storeRecording(req.file, {
            workspaceId: idOf(meeting.workspaceId),
            ownerKey: `meeting-${req.params.id}`,
            userId: req.user.sub,
            durationSec: duration.value,
        });
        const before = await meetingsService.setRecording(req.params.id, doc);
        if (before?.recording?.path && before.recording.path !== doc.path) {
            recordings.deleteRecordingObject(before.recording.path).catch((err) => logger.warn(`[Meetings] old recording not deleted: ${err.message}`));
        }

        const recording = recordings.describeRecording(doc);
        const recordingUrl = `/api/v2/meetings/${req.params.id}/recording`;
        if (req.io) req.io.to(`meeting:${req.params.id}`).emit('meeting:recording_ready', { meetingId: req.params.id, recording, recordingUrl });
        return res.status(201).json({ recording, recordingUrl });
    } catch (err) {
        return fail(res, err, 'Failed to upload recording');
    }
}

async function getRecording(req, res) {
    try {
        const meeting = await meetingsService.loadForRecording(req.params.id);
        if (!meeting?.recording?.path) return res.status(404).json({ message: 'This meeting has no recording' });
        const signed = recordings.signedRecordingUrl(`/api/v2/meetings/${req.params.id}/recording/stream`, meeting.recording, req.user.sub);
        return res.json({ recording: recordings.describeRecording(meeting.recording), ...signed });
    } catch (err) {
        return fail(res, err, 'Failed to load recording');
    }
}

/** Signed playback (no Authorization header: <video>/<audio> cannot send one). */
async function streamRecording(req, res) {
    try {
        const meeting = await meetingsService.loadForRecording(req.params.id);
        const userId = recordings.verifyRecordingSignature(meeting?.recording, req.query || {});
        if (!userId) return res.status(403).json({ message: 'Invalid or expired link' });
        // Re-check: someone removed from the workspace loses access at once.
        try {
            await loadMeetingForUser(req.params.id, userId);
        } catch (err) {
            return res.status(err.status || 403).json({ message: err.message || 'Access denied' });
        }
        return await recordings.streamRecording(meeting.recording, req, res);
    } catch (err) {
        if (res.headersSent) return res.destroy();
        if (err?.code === 404) return res.status(404).json({ message: 'Recording not found' });
        return fail(res, err, 'Failed to stream recording');
    }
}

async function deleteRecording(req, res) {
    try {
        const meeting = await meetingsService.loadForRecording(req.params.id);
        if (!meeting?.recording?.path) return res.status(404).json({ message: 'This meeting has no recording' });
        const allowed = idOf(meeting.recording.uploadedBy) === String(req.user.sub)
            || canManageMeeting(meeting, req.user.sub, req.meetingAccess);
        if (!allowed) return res.status(403).json({ message: 'Only the uploader, the organizer or a workspace admin can delete the recording' });

        const before = await meetingsService.clearRecording(req.params.id);
        if (before?.recording?.path) await recordings.deleteRecordingObject(before.recording.path);
        if (req.io) req.io.to(`meeting:${req.params.id}`).emit('meeting:recording_deleted', { meetingId: req.params.id });
        return res.json({ message: 'Recording deleted' });
    } catch (err) {
        return fail(res, err, 'Failed to delete recording');
    }
}

// ── Transcript ──────────────────────────────────────────────────────────────

async function appendSegments(req, res) {
    try {
        const { segments, error } = transcript.validateSegments(req.body, { addedBy: req.user.sub });
        if (error) return res.status(400).json({ message: error });
        const result = await meetingsService.appendTranscriptSegments(req.params.id, segments);
        if (!result) return res.status(404).json({ message: 'Meeting not found' });
        if (req.io) {
            req.io.to(`meeting:${req.params.id}`).emit('meeting:transcript_segments', {
                meetingId: req.params.id,
                segments: segments.map(({ addedBy: _addedBy, ...s }) => s),
            });
        }
        return res.status(201).json(result);
    } catch (err) {
        return fail(res, err, 'Failed to save transcript');
    }
}

async function getTranscript(req, res) {
    try {
        const result = await meetingsService.getTranscript(req.params.id);
        if (!result) return res.status(404).json({ message: 'Meeting not found' });
        return res.json(result);
    } catch (err) {
        return fail(res, err, 'Failed to load transcript');
    }
}

async function extractActionItems(req, res) {
    try {
        const apply = req.body?.apply === true;
        // With apply, new items (deduped by text) join the meeting's one action-item list and
        // 'meeting:action_items_updated' goes out (meetingRecords.addActionItemsDeduped).
        const result = await meetingsService.extractActionItems(req.params.id, { apply, userId: req.user.sub, io: req.io });
        if (!result) return res.status(404).json({ message: 'Meeting not found' });
        return res.json(result);
    } catch (err) {
        return fail(res, err, 'Failed to extract action items');
    }
}

module.exports = {
    uploadRecording,
    getRecording,
    streamRecording,
    deleteRecording,
    appendSegments,
    getTranscript,
    extractActionItems,
};
