const express = require('express');
const router = express.Router();
const pollController = require('../controllers/pollController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Create a new poll
router.post('/', pollController.createPoll);

// Get a single poll by ID
router.get('/:pollId', pollController.getPollById);

// Get all polls for a channel
router.get('/channel/:channelId', pollController.getPollsByChannel);

// Vote on a poll
router.post('/:pollId/vote', pollController.vote);

// Close a poll
router.patch('/:pollId/close', pollController.closePoll);

// Delete a poll
router.delete('/:pollId', pollController.deletePoll);

module.exports = router;
