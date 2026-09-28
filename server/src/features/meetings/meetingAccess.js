'use strict';

/**
 * Access checks for scheduled meetings (ScheduledMeeting) and everything hung
 * off them (/api/v2/meetings/:id*, /api/v2/collaboration/*, meeting sockets).
 *
 * A caller may touch a meeting only when they are an active member of the
 * meeting's workspace. Errors are HttpError(400 malformed id / 404 / 403).
 */

const {
    isValidId,
    HttpError,
    userIdOf,
    assertWorkspaceMember,
    sendAccessError,
} = require('../../shared/utils/workspaceAccess');

async function loadMeetingForUser(meetingId, userId, { adminOnly = false } = {}) {
    if (!isValidId(meetingId)) throw new HttpError(400, 'Invalid meeting id');
    const ScheduledMeeting = require('../../models/ScheduledMeeting');
    const meeting = await ScheduledMeeting.findById(meetingId).select('workspaceId createdBy status').lean();
    if (!meeting) throw new HttpError(404, 'Meeting not found');
    let access;
    try {
        access = await assertWorkspaceMember(meeting.workspaceId, userId, { adminOnly });
    } catch (err) {
        // The meeting exists but its workspace is gone: treat as not found.
        if (err instanceof HttpError && err.status === 404) throw new HttpError(404, 'Meeting not found');
        throw err;
    }
    return { meeting, access };
}

/** True when the user organised the meeting or is an owner/admin of its workspace. */
function canManageMeeting(meeting, userId, access) {
    return String(meeting.createdBy?._id || meeting.createdBy) === String(userId) || !!access?.isAdmin;
}

/** Express middleware: validates req.params[param] and sets req.meeting / req.meetingAccess. */
function requireMeetingAccess(param = 'id') {
    return async (req, res, next) => {
        try {
            const { meeting, access } = await loadMeetingForUser(req.params[param], userIdOf(req.user));
            req.meeting = meeting;
            req.meetingAccess = access;
            return next();
        } catch (err) {
            return sendAccessError(res, err, next);
        }
    };
}

module.exports = { loadMeetingForUser, canManageMeeting, requireMeetingAccess };
