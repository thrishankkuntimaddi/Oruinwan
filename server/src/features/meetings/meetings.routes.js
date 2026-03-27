'use strict';
// server/src/features/meetings/meetings.routes.js

const express = require('express');
const router = express.Router();
const requireAuth = require('../../../middleware/auth');
const ctrl = require('./meetings.controller');

// All meeting routes require authentication
router.use(requireAuth);

// ── Collection / non-param routes (must come before /:id) ─────────────────────
router.get('/', ctrl.getMeetings);                          // GET  /api/v2/meetings?workspaceId=xxx
router.post('/suggest-time', ctrl.suggestTime);             // POST /api/v2/meetings/suggest-time

// ── Single meeting routes ─────────────────────────────────────────────────────
router.get('/:id', ctrl.getMeeting);                        // GET  /api/v2/meetings/:id
router.post('/:id/join', ctrl.joinMeeting);                 // POST /api/v2/meetings/:id/join
router.patch('/:id/end', ctrl.endMeeting);                  // PATCH /api/v2/meetings/:id/end
router.patch('/:id/agenda', ctrl.updateAgenda);             // PATCH /api/v2/meetings/:id/agenda
router.patch('/:id/transcript', ctrl.updateTranscript);     // PATCH /api/v2/meetings/:id/transcript
router.post('/:id/summarize', ctrl.summarizeMeeting);       // POST /api/v2/meetings/:id/summarize
router.post('/:id/action-items', ctrl.addActionItem);       // POST /api/v2/meetings/:id/action-items
router.patch('/:id/action-items/:aid', ctrl.updateActionItem); // PATCH /api/v2/meetings/:id/action-items/:aid

module.exports = router;
