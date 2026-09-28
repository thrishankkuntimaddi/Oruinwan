'use strict';

/**
 * Socket handlers for live scheduled meetings.
 *
 *   meeting:join   { meetingId } [ack]  -> joins room `meeting:<id>` after the
 *                  caller is verified as an active member of the meeting's
 *                  workspace. ack({ ok, meetingId, notes }) / ack({ ok:false, code, message }).
 *   meeting:leave  { meetingId }
 *   meeting:notes_update { meetingId, notes } [ack] -> only from sockets already in
 *                  the meeting room; persists ScheduledMeeting.sharedNotes and
 *                  broadcasts `meeting:notes_update` { meetingId, notes, updatedBy, timestamp }
 *                  to the rest of the room.
 * Errors are also emitted as `meeting:error` { meetingId, code, message }.
 */

const logger = require('../../../utils/logger');
const { HttpError } = require('../../shared/utils/workspaceAccess');
const { loadMeetingForUser } = require('./meetingAccess');

const MAX_NOTES = 200000;

const CODES = { 400: 'BAD_REQUEST', 403: 'FORBIDDEN', 404: 'NOT_FOUND' };

function registerMeetingHandlers(io, socket, { load = loadMeetingForUser, saveNotes } = {}) {
    const uid = () => String(socket.user.id);
    const persistNotes = saveNotes || (async (meetingId, notes) => {
        const ScheduledMeeting = require('../../models/ScheduledMeeting');
        await ScheduledMeeting.updateOne({ _id: meetingId }, { $set: { sharedNotes: notes } });
    });

    const reply = (ack, meetingId, payload) => {
        if (!payload.ok) socket.emit('meeting:error', { meetingId, code: payload.code, message: payload.message });
        if (typeof ack === 'function') ack(payload);
    };

    socket.on('meeting:join', async (data = {}, ack) => {
        const meetingId = data && data.meetingId ? String(data.meetingId) : null;
        try {
            const { meeting } = await load(meetingId, uid());
            socket.join(`meeting:${meetingId}`);
            let notes = '';
            try {
                const ScheduledMeeting = require('../../models/ScheduledMeeting');
                const full = await ScheduledMeeting.findById(meetingId).select('sharedNotes').lean();
                notes = full?.sharedNotes || '';
            } catch (_) { /* notes are a convenience; the join itself succeeded */ }
            reply(ack, meetingId, { ok: true, meetingId, workspaceId: String(meeting.workspaceId), notes });
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

    socket.on('meeting:notes_update', async (data = {}, ack) => {
        const meetingId = data && data.meetingId ? String(data.meetingId) : null;
        const room = `meeting:${meetingId}`;
        if (!meetingId || !socket.rooms.has(room)) {
            return reply(ack, meetingId, { ok: false, code: 'FORBIDDEN', message: 'Join the meeting first' });
        }
        const { notes } = data;
        if (typeof notes !== 'string') return reply(ack, meetingId, { ok: false, code: 'BAD_REQUEST', message: 'notes must be a string' });
        if (notes.length > MAX_NOTES) return reply(ack, meetingId, { ok: false, code: 'BAD_REQUEST', message: 'notes are too long' });
        try {
            await persistNotes(meetingId, notes);
            socket.to(room).emit('meeting:notes_update', { meetingId, notes, updatedBy: uid(), timestamp: new Date() });
            reply(ack, meetingId, { ok: true, meetingId });
        } catch (err) {
            logger.error('[meeting:notes_update] failed:', err);
            reply(ack, meetingId, { ok: false, code: 'SERVER_ERROR', message: 'Failed to save notes' });
        }
    });
}

module.exports = registerMeetingHandlers;
