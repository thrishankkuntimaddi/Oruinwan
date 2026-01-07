// server/routes/platformSupport.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const platformSupportController = require('../controllers/platformSupportController');

/**
 * @route   GET /api/platform/support/messages/:companyId
 * @desc    Get all support messages for a company
 * @access  Private (company admin)
 */
router.get('/messages/:companyId', requireAuth, platformSupportController.getMessages);

/**
 * @route   POST /api/platform/support/messages
 * @desc    Send a message to platform admin
 * @access  Private (company admin)
 */
router.post('/messages', requireAuth, platformSupportController.sendMessage);

/**
 * @route   GET /api/platform/support/tickets/:companyId
 * @desc    Get all support tickets for a company
 * @access  Private (company admin)
 */
router.get('/tickets/:companyId', requireAuth, platformSupportController.getTickets);

/**
 * @route   POST /api/platform/support/tickets
 * @desc    Create a new support ticket
 * @access  Private (company admin)
 */
router.post('/tickets', requireAuth, platformSupportController.createTicket);

/**
 * @route   PUT /api/platform/support/tickets/:ticketId
 * @desc    Update ticket status or add response
 * @access  Private (company admin or platform admin)
 */
router.put('/tickets/:ticketId', requireAuth, platformSupportController.updateTicket);

module.exports = router;
