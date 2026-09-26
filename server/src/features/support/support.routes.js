const express = require('express');
const router = express.Router();
const SupportTicket = require('../../../models/SupportTicket');
const logger = require('../../../utils/logger');

const User = require('../../../models/User');
const requireAuth = require('../../shared/middleware/auth');

router.use(requireAuth);

// Access tokens do not carry the company, so resolve it from the user record.
// Support tickets belong to a company; personal accounts get a clear 403.
router.use(async (req, res, next) => {
    try {
        const user = await User.findById(req.user.sub).select('companyId').lean();
        if (!user?.companyId) {
            return res.status(403).json({ message: "Support tickets are available to company accounts" });
        }
        req.supportCompanyId = user.companyId;
        next();
    } catch (err) {
        next(err);
    }
});

router.post('/tickets', async (req, res) => {
    try {
        const { subject, description, priority } = req.body;
        const userId = req.user.sub;
        const companyId = req.supportCompanyId;

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
        logger.error("CREATE TICKET ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get('/tickets', async (req, res) => {
    try {
        const companyId = req.supportCompanyId;
        const tickets = await SupportTicket.find({ companyId })
            .sort({ createdAt: -1 })
            .populate('creatorId', 'username email');

        res.json({ tickets });
    } catch (err) {
        logger.error("GET TICKETS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get('/tickets/:id', async (req, res) => {
    try {
        const companyId = req.supportCompanyId;
        const ticket = await SupportTicket.findOne({ _id: req.params.id, companyId })
            .populate('creatorId', 'username email')
            .populate('messages.sender', 'username email profilePicture');

        if (!ticket) {
            return res.status(404).json({ message: "Ticket not found" });
        }

        res.json({ ticket });
    } catch (err) {
        logger.error("GET TICKET ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post('/tickets/:id/message', async (req, res) => {
    try {
        const { message } = req.body;
        const companyId = req.supportCompanyId;
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
            content: message,
            isFromAdmin: false,
            createdAt: new Date()
        });

        
        if (ticket.status === 'resolved' || ticket.status === 'closed') {
            ticket.status = 'in-progress';
        }

        await ticket.save();
        res.json({ message: "Message added", ticket });

    } catch (err) {
        logger.error("ADD TICKET MESSAGE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
