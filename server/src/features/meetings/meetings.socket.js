'use strict';

/**
 * Socket handlers for meetings (scheduled meetings and ad-hoc huddle records).
 *
 *   meeting:join   { meetingId } [ack]  -> joins room `meeting:<id>` after the caller is
 *                  verified (meetingAccess: workspace member + the meeting's conversation,
 *                  or involved). ack({ ok, meetingId, workspaceId, noteId, notes })
 *                  / ack({ ok:false, code, message }). `notes` is the deprecated plain-text
 *                  sharedNotes (read-only); live notes are the Note `noteId` (collab docType 'note').
 *   meeting:leave  { meetingId }
 *   meeting:notes_update  DEPRECATED: always refused with code 'DEPRECATED' (and the noteId
 *                  to edit instead). Meeting notes are one Note edited over collab:*.
 * Errors are also emitted as `meeting:error` { meetingId, code, message }.
 *
 * Events the server sends to `meeting:<id>` (docs/api/meetings-unified.md): meeting:ended,
 * meeting:note_ready, meeting:action_items_updated, meeting:summary_updated,
 * meeting:recording_ready / _deleted, meeting:transcript_segments, meeting:agenda_updated.
 */

const logger = require('../../../utils/logger');
const { HttpError } = require('../../shared/utils/workspaceAccess');
const { loadMeetingForUser } = require('./meetingAccess');

const CODES = { 400: 'BAD_REQUEST', 403: 'FORBIDDEN', 404: 'NOT_FOUND' };

async function defaultLoadNotes(meetingId) {
    const ScheduledMeeting = require('../../models/ScheduledMeeting');
    const full = await ScheduledMeeting.findById(meetingId).select('sharedNotes noteId').lean();
    return { notes: full?.sharedNotes || '', noteId: full?.noteId ? String(full.noteId) : null };
}

function registerMeetingHandlers(io, socket, { load = loadMeetingForUser, loadNotes = defaultLoadNotes } = {}) {
    const uid = () => String(socket.user.id);

    const reply = (ack, meetingId, payload) => {
        if (!payload.ok) socket.emit('meeting:error', { meetingId, code: payload.code, message: payload.message });
        if (typeof ack === 'function') ack(payload);
    };

    socket.on('meeting:join', async (data = {}, ack) => {
        const meetingId = data && data.meetingId ? String(data.meetingId) : null;
        try {
            const { meeting } = await load(meetingId, uid());
            socket.join(`meeting:${meetingId}`);
            let extra = { notes: '', noteId: null };
            try {
                extra = await loadNotes(meetingId);
            } catch (_) { /* notes are a convenience; the join itself succeeded */ }
            reply(ack, meetingId, { ok: true, meetingId, workspaceId: String(meeting.workspaceId), noteId: extra.noteId || null, notes: extra.notes || '' });
        } catch (err) {
            if (err instanceof HttpError) {
                return reply(ack, meetingId, { ok: false, code: CODES[err.status] || 'FORBIDDEN', message: err.message });
            }
            logger.error('[meeting:join] failed:', err);
            reply(ack, meetingId, { ok: false, code: 'SERVER_ERROR', message: 'Failed to join meeting' });
        }
    });

    socket.on('meeting:leave', (data = {}) => {
        if (data && data.meetingId) socket.leave(`meeting:${data.meetingId}`);
    });

    // The plain-text shared notes are read-only now: the meeting's notes are one Note.
    socket.on('meeting:notes_update', async (data = {}, ack) => {
        const meetingId = data && data.meetingId ? String(data.meetingId) : null;
        let noteId = null;
        if (meetingId && socket.rooms.has(`meeting:${meetingId}`)) {
            try {
                noteId = (await loadNotes(meetingId)).noteId || null;
            } catch (_) { /* informational */ }
        }
        reply(ack, meetingId, {
            ok: false,
            code: 'DEPRECATED',
            message: 'Shared notes moved to the meeting notes: POST /api/v2/meetings/:id/notes, then edit the note live (collab docType "note").',
            noteId,
        });
    });
}

module.exports = registerMeetingHandlers;
