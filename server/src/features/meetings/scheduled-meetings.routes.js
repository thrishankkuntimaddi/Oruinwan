'use strict';
// server/src/features/meetings/scheduled-meetings.routes.js
//
// Routes for /api/scheduled-meetings.
// Migrated verbatim from server.js (Phase 4 cleanup).
// Auth is applied at the mount point in server.js (requireAuth).

const express = require('express');
const router = express.Router();
const ctrl = require('./scheduled-meetings.controller');

// GET  /api/scheduled-meetings?workspaceId=xxx
router.get('/', ctrl.getScheduledMeetings);

// POST /api/scheduled-meetings
router.post('/', ctrl.createScheduledMeeting);

// PATCH /api/scheduled-meetings/:id
router.patch('/:id', ctrl.updateScheduledMeeting);

// DELETE /api/scheduled-meetings/:id
router.delete('/:id', ctrl.deleteScheduledMeeting);

module.exports = router;
