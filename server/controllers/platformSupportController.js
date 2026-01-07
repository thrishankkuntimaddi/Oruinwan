// server/controllers/platformSupportController.js
const mongoose = require('mongoose');

// Models
const SupportMessage = require('../models/SupportMessage');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const Company = require('../models/Company');

/**
 * Get all support messages for a company
 * GET /api/platform/support/messages/:companyId
 */
exports.getMessages = async (req, res) => {
    try {
        const { companyId } = req.params;

        const messages = await SupportMessage.find({ companyId })
            .populate('sender', 'username email')
            .sort({ createdAt: 1 })
            .limit(100);

        return res.json({ messages });
    } catch (error) {
        console.error('GET MESSAGES ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Send a message to platform admin
 * POST /api/platform/support/messages
 */
exports.sendMessage = async (req, res) => {
    try {
        const { companyId, content } = req.body;

        // Validate user authentication
        if (!req.user || !req.user.sub) {
            console.error('SEND MESSAGE ERROR: User not authenticated', { user: req.user });
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Validate content
        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Message content is required' });
        }

        // Validate companyId
        if (!companyId) {
            return res.status(400).json({ message: 'Company ID is required' });
        }

        console.log('[PLATFORM SUPPORT] Sending message:', {
            companyId,
            userId: req.user.sub,
            userRoles: req.user.roles
        });

        const message = await SupportMessage.create({
            companyId,
            sender: req.user.sub, // Use sub from JWT payload
            content: content.trim(),
            isFromPlatformAdmin: false
        });

        await message.populate('sender', 'username email');

        console.log('[PLATFORM SUPPORT] Message created successfully:', message._id);

        // Emit socket event to platform admins
        if (req.app.get('io')) {
            req.app.get('io').to('platform-admins').emit('platform-message', message);
        }

        return res.status(201).json({ message });
    } catch (error) {
        console.error('SEND MESSAGE ERROR:', error);
        return res.status(500).json({
            message: 'Failed to send message',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get all support tickets for a company
 * GET /api/platform/support/tickets/:companyId
 */
exports.getTickets = async (req, res) => {
    try {
        const { companyId } = req.params;

        const tickets = await SupportTicket.find({ companyId })
            .populate('creatorId', 'username email')
            .sort({ createdAt: -1 });

        return res.json({ tickets });
    } catch (error) {
        console.error('GET TICKETS ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Create a new support ticket
 * POST /api/platform/support/tickets
 */
exports.createTicket = async (req, res) => {
    try {
        const { companyId, subject, category, priority, description } = req.body;

        if (!subject || !description) {
            return res.status(400).json({ message: 'Subject and description are required' });
        }

        const ticket = await SupportTicket.create({
            companyId,
            creatorId: req.user._id,
            subject,
            priority: priority || 'medium',
            description,
            status: 'open'
        });

        await ticket.populate('creatorId', 'username email');

        // TODO: Notify platform admins
        // io.to('platform-admins').emit('new-support-ticket', ticket);

        return res.status(201).json({ ticket });
    } catch (error) {
        console.error('CREATE TICKET ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Update ticket status or add response
 * PUT /api/platform/support/tickets/:ticketId
 */
exports.updateTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { status, response } = req.body;

        const ticket = await SupportTicket.findById(ticketId);

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        if (status) {
            ticket.status = status;
            if (status === 'resolved') {
                ticket.resolvedAt = new Date();
            } else if (status === 'closed') {
                ticket.closedAt = new Date();
            }
        }

        if (response) {
            ticket.messages.push({
                sender: req.user._id,
                message: response
            });
        }

        await ticket.save();
        await ticket.populate('creatorId', 'username email');

        return res.json({ ticket });
    } catch (error) {
        console.error('UPDATE TICKET ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = exports;
