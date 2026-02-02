const express = require('express');
const router = express.Router();
const SupportTicket = require('../../../models/SupportTicket');
const logger = require('../../../utils/logger');

// Middleware to ensure user is logged in
const requireAuth = require('../../../middleware/auth');

router.use(requireAuth);

/**
 * @route   POST /api/support/tickets
 * @desc    Create a new support ticket
 * @access  Company Owner/Admin
 */
router.post('/tickets', async (req, res) => {
    try {
        const { subject, description, priority } = req.body;
        const userId = req.user.sub;
        const companyId = req.user.companyId;

        if (!subject || !description) {
            return res.status(400).json({ message: "Subject and description are required" });
        }

        const ticket = new SupportTicket({
            companyId,
            creatorId: userId,
            subject,
            description,
            priority: priority || 'medium',
            messages: []
        });

        await ticket.save();
        logger.info(`Support Ticket Created: ${ticket._id} by ${userId}`);

        res.status(201).json({ message: "Ticket created successfully", ticket });
    } catch (err) {
        console.error("CREATE TICKET ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * @route   GET /api/support/tickets
 * @desc    Get all tickets for the company
 * @access  Company Owner/Admin
 */
router.get('/tickets', async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const tickets = await SupportTicket.find({ companyId })
            .sort({ createdAt: -1 })
            .populate('creatorId', 'username email');

        res.json({ tickets });
    } catch (err) {
        console.error("GET TICKETS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * @route   GET /api/support/tickets/:id
 * @desc    Get single ticket details
 * @access  Company Owner/Admin
 */
router.get('/tickets/:id', async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const ticket = await SupportTicket.findOne({ _id: req.params.id, companyId })
            .populate('creatorId', 'username email')
            .populate('messages.sender', 'username email profilePicture');

        if (!ticket) {
            return res.status(404).json({ message: "Ticket not found" });
        }

        res.json({ ticket });
    } catch (err) {
        console.error("GET TICKET ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * @route   POST /api/support/tickets/:id/message
 * @desc    Add a message to the ticket
 * @access  Company Owner/Admin
 */
router.post('/tickets/:id/message', async (req, res) => {
    try {
        const { message } = req.body;
        const companyId = req.user.companyId;
        const userId = req.user.sub;

        if (!message) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }

        const ticket = await SupportTicket.findOne({ _id: req.params.id, companyId });
        if (!ticket) {
            return res.status(404).json({ message: "Ticket not found" });
        }

        ticket.messages.push({
            sender: userId,
            message,
            createdAt: new Date()
        });

        // Re-open if closed ? (Optional logic)
        if (ticket.status === 'resolved' || ticket.status === 'closed') {
            ticket.status = 'in-progress';
        }

        await ticket.save();
        res.json({ message: "Message added", ticket });

    } catch (err) {
        console.error("ADD TICKET MESSAGE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
