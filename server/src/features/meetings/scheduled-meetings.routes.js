'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./scheduled-meetings.controller');

router.get('/', ctrl.getScheduledMeetings);

// Clash check for a proposed time (advisory: create re-checks at save time).
router.post('/conflicts', ctrl.checkConflicts);

router.post('/', ctrl.createScheduledMeeting);

router.patch('/:id', ctrl.updateScheduledMeeting);

router.delete('/:id', ctrl.deleteScheduledMeeting);

module.exports = router;
