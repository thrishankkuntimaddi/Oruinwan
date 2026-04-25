'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./scheduled-meetings.controller');

router.get('/', ctrl.getScheduledMeetings);

router.post('/', ctrl.createScheduledMeeting);

router.patch('/:id', ctrl.updateScheduledMeeting);

router.delete('/:id', ctrl.deleteScheduledMeeting);

module.exports = router;
