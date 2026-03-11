// server/routes/platformSupport.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../../../middleware/auth');
const platformSupportController = require('./platform-support.controller');

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
 * @route   GET /api/platform/support/messages/me
 * @desc    Get MY support conversation messages (current user's 1:1 with platform admin)
 * @access  Private (company owner/admin)
 */
router.get('/messages/me', requireAuth, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        if (!userId) return res.status(401).json({ message: 'Authentication required' });

        // Find this user's support ticket (scoped by creatorId)
        const ticket = await require('../../../models/SupportTicket').findOne({
            creatorId: userId,
            subject: 'Live Chat Support'
        }).sort({ createdAt: -1 }).lean();

        if (!ticket) {
            return res.json({ messages: [] });
        }

        const messages = await require('../../../models/SupportMessage').find({
            ticket: ticket._id,
            deletedAt: null
        })
            .populate('sender', 'username email profilePicture')
            .sort({ createdAt: 1 })
            .lean();

        return res.json({ messages });
    } catch (error) {
        console.error('GET MY MESSAGES ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   GET /api/platform/support/messages/:companyId
 * @desc    Get all support messages for a company (across all tickets)
 * @access  Private (company admin)
 * @deprecated Use /messages/me instead
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

