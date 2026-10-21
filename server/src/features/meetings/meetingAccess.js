'use strict';

/**
 * Access checks for scheduled meetings (ScheduledMeeting) and everything hung
 * off them (/api/v2/meetings/:id*, /api/v2/collaboration/*, meeting sockets).
 *
 * A caller must be an active member of the meeting's workspace, and then:
 *   - the organiser, an invitee or someone who joined the call, or
 *   - a member of the meeting's conversation: channel members for a channel meeting,
 *     DM participants for a DM meeting, any workspace member for a workspace meeting.
 * Errors are HttpError(400 malformed id / 404 / 403).
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
    const meeting = await ScheduledMeeting.findById(meetingId)
        .select('workspaceId createdBy status kind channelId dmSessionId participants invitees huddleId title').lean();
    if (!meeting) throw new HttpError(404, 'Meeting not found');
    let access;
    try {
        access = await assertWorkspaceMember(meeting.workspaceId, userId, { adminOnly });
    } catch (err) {
        // The meeting exists but its workspace is gone: treat as not found.
        if (err instanceof HttpError && err.status === 404) throw new HttpError(404, 'Meeting not found');
        throw err;
    }
    if (!(await inConversation(meeting, userId))) {
        throw new HttpError(403, 'You are not in this meeting\'s conversation');
    }
    return { meeting, access };
}

const idOf = (v) => String(v?._id || v || '');

/** Organiser, invitee or attendee of the meeting. */
function isInvolved(meeting, userId) {
    const uid = String(userId);
    return idOf(meeting.createdBy) === uid
        || (meeting.participants || []).some((p) => idOf(p) === uid)
        || (meeting.invitees || []).some((p) => idOf(p) === uid);
}

/** Involved, or a member of the conversation the meeting belongs to. */
async function inConversation(meeting, userId) {
    if (isInvolved(meeting, userId)) return true;
    if (meeting.channelId) {
        const Channel = require('../channels/channel.model');
        const channel = await Channel.findById(meeting.channelId).select('members').lean();
        return !!channel && (channel.members || []).some((m) => idOf(m?.user ?? m) === String(userId));
    }
    if (meeting.dmSessionId) {
        const DMSession = require('../../../models/DMSession');
        const dm = await DMSession.findById(meeting.dmSessionId).select('participants').lean();
        return !!dm && (dm.participants || []).some((p) => idOf(p) === String(userId));
    }
    return true;
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

module.exports = { loadMeetingForUser, canManageMeeting, requireMeetingAccess, inConversation, isInvolved };
