const express = require('express');
const router = express.Router();
const pollController = require('./poll.controller');
const authMiddleware = require('../../shared/middleware/auth');

router.use(authMiddleware);

router.post('/', pollController.createPoll);

router.get('/channel/:channelId', pollController.getPollsByChannel);

router.post('/:pollId/vote', pollController.vote);

router.patch('/:pollId/close', pollController.closePoll);

router.delete('/:pollId', pollController.deletePoll);

module.exports = router;
