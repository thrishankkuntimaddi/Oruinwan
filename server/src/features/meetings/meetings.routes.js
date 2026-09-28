'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const ctrl = require('./meetings.controller');
const { requireMeetingAccess } = require('./meetingAccess');

router.use(requireAuth);

router.get('/', ctrl.getMeetings);                          
router.post('/suggest-time', ctrl.suggestTime);

// Everything below: valid id (400), meeting exists (404), caller is an active
// member of the meeting's workspace (403).
router.use('/:id', requireMeetingAccess('id'));

router.get('/:id', ctrl.getMeeting);                        
router.post('/:id/join', ctrl.joinMeeting);                 
router.patch('/:id/end', ctrl.endMeeting);                  
router.patch('/:id/agenda', ctrl.updateAgenda);             
router.patch('/:id/transcript', ctrl.updateTranscript);     
router.post('/:id/summarize', ctrl.summarizeMeeting);       
router.post('/:id/action-items', ctrl.addActionItem);       
router.patch('/:id/action-items/:aid', ctrl.updateActionItem); 

module.exports = router;
