// server/routes/platformSupport.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const platformSupportController = require('../controllers/platformSupportController');

/* ===============================
   TICKET-BASED MESSAGING (New)
=============================== */

/**
 * @route   GET /api/platform/support/tickets/:ticketId/messages
 * @desc    Get all messages for a specific ticket
 * @access  Private (company admin or platform admin)
 */
router.get('/tickets/:ticketId/messages', requireAuth, platformSupportController.getTicketMessages);

/**
 * @route   POST /api/platform/support/tickets/:ticketId/messages
 * @desc    Send a message within a ticket
 * @access  Private (company admin or platform admin)
 */
router.post('/tickets/:ticketId/messages', requireAuth, platformSupportController.sendTicketMessage);

/**
 * @route   PATCH /api/platform/support/messages/:messageId/read
 * @desc    Mark a message as read
 * @access  Private
 */
router.patch('/messages/:messageId/read', requireAuth, platformSupportController.markMessageAsRead);

/* ===============================
   LEGACY ROUTES (Backward Compatible)
=============================== */

/**
 * @route   GET /api/platform/support/messages/:companyId
 * @desc    Get all support messages for a company (across all tickets)
 * @access  Private (company admin)
 * @deprecated Use /tickets/:ticketId/messages instead
 */
router.get('/messages/:companyId', requireAuth, platformSupportController.getMessages);

/**
 * @route   POST /api/platform/support/messages
 * @desc    Send a message to platform admin (creates/uses default chat ticket)
 * @access  Private (company admin)
 * @deprecated Use /tickets/:ticketId/messages instead
 */
router.post('/messages', requireAuth, platformSupportController.sendMessage);

/* ===============================
   TICKET ROUTES
=============================== */

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

