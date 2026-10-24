'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const ctrl = require('./meetings.controller');
const media = require('./meetingMedia.controller');
const { uploadRecordingMiddleware } = require('./recordings');
const { requireMeetingAccess } = require('./meetingAccess');

// Signed playback link (media elements cannot send Authorization); the signature names the user
// and access is re-checked inside the handler.
router.get('/:id/recording/stream', media.streamRecording);

router.use(requireAuth);

router.get('/', ctrl.getMeetings);
router.post('/suggest-time', ctrl.suggestTime);
// Who is busy at a proposed time, with free slots (features/meetings/conflicts.js).
router.post('/conflicts', require('./scheduled-meetings.controller').checkConflicts);
// The meeting record of a huddle (ad-hoc huddle or "meeting-<id>"); access is checked inside.
router.get('/by-huddle/:huddleId', ctrl.getMeetingByHuddle);

// Everything below: valid id (400), meeting exists (404), caller is an active
// member of the meeting's workspace (403).
router.use('/:id', requireMeetingAccess('id'));

router.get('/:id', ctrl.getMeeting);
router.post('/:id/join', ctrl.joinMeeting);
router.patch('/:id/end', ctrl.endMeeting);
router.patch('/:id/agenda', ctrl.updateAgenda);
router.patch('/:id/transcript', ctrl.updateTranscript);
router.post('/:id/summarize', ctrl.summarizeMeeting);
router.put('/:id/summary', ctrl.putSummary);

// The meeting's notes (one Note for its whole life): returns { noteId, created } and
// grants the caller edit access; then edit it live with collab:join { docType: 'note' }.
router.post('/:id/notes', ctrl.ensureNotes);

router.get('/:id/action-items', ctrl.listActionItems);
router.post('/:id/action-items', ctrl.addActionItem);
router.post('/:id/action-items/extract', media.extractActionItems);
router.patch('/:id/action-items/:aid', ctrl.updateActionItem);
router.delete('/:id/action-items/:aid', ctrl.deleteActionItem);
router.post('/:id/action-items/:aid/toggle', ctrl.toggleActionItem);
router.post('/:id/action-items/:aid/convert', ctrl.convertActionItem);

router.post('/:id/recording', uploadRecordingMiddleware, media.uploadRecording);
router.get('/:id/recording', media.getRecording);
router.delete('/:id/recording', media.deleteRecording);

router.post('/:id/transcript/segments', media.appendSegments);
router.get('/:id/transcript', media.getTranscript);

module.exports = router;
