const _mongoose = require('mongoose');

const SupportMessage = require('../../../models/SupportMessage');
const SupportTicket = require('../../../models/SupportTicket');
const _User = require('../../../models/User');
const _Company = require('../../../models/Company');

exports.getTicketMessages = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { limit = 50, before, after } = req.query;

        
        const ticket = await SupportTicket.findById(ticketId);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        
        const messages = await SupportMessage.getTicketTimeline(ticketId, {
            limit: parseInt(limit),
            before,
            after
        });

        return res.json({
            messages,
            hasMore: messages.length === parseInt(limit)
        });
    } catch (error) {
        console.error('GET TICKET MESSAGES ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { limit = 100 } = req.query;

        const messages = await SupportMessage.find({
            company: companyId,
            deletedAt: null
        })
            .populate('sender', 'username email profilePicture')
            .populate('ticket', 'subject status')
            .sort({ createdAt: 1 })
            .limit(parseInt(limit));

        return res.json({ messages });
    } catch (error) {
        console.error('GET MESSAGES ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.sendTicketMessage = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { content, attachments } = req.body;

        
        if (!req.user || !req.user.sub) {
            console.error('SEND MESSAGE ERROR: User not authenticated', { user: req.user });
            return res.status(401).json({ message: 'Authentication required' });
        }

        
        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Message content is required' });
        }

        
        const ticket = await SupportTicket.findById(ticketId).populate('companyId');
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        console.log('[PLATFORM SUPPORT] Sending message to ticket:', {
            ticketId,
            userId: req.user.sub,
            userRoles: req.user.roles
        });

        
        const isPlatformAdmin = req.user.roles && req.user.roles.includes('platform-admin');
        const senderRole = isPlatformAdmin ? 'platform' : 'company';

        const message = await SupportMessage.create({
            ticket: ticketId,
            company: ticket.companyId._id,
            sender: req.user.sub,
            senderRole,
            content: content.trim(),
            attachments: attachments || []
        });

        await message.populate('sender', 'username email profilePicture');

        console.log('[PLATFORM SUPPORT] Message created successfully:', message._id);

        
        if (ticket.status === 'open' && isPlatformAdmin) {
            ticket.status = 'in-progress';
            await ticket.save();
        }

        
        if (req.app.get('io')) {
            const io = req.app.get('io');

            
            io.to(`company-${ticket.companyId._id}`).emit('support-message', {
                ticketId,
                message
            });

            
            if (!isPlatformAdmin) {
                io.to('platform-admins').emit('support-message', {
                    ticketId,
                    message
                });
            }
        }

        return res.status(201).json({ message });
    } catch (error) {
        console.error('SEND TICKET MESSAGE ERROR:', error);
        return res.status(500).json({
            message: 'Failed to send message',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { companyId, content } = req.body;

        
        if (!req.user || !req.user.sub) {
            console.error('SEND MESSAGE ERROR: User not authenticated', { user: req.user });
            return res.status(401).json({ message: 'Authentication required' });
        }

        
        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Message content is required' });
        }

        
        if (!companyId) {
            return res.status(400).json({ message: 'Company ID is required' });
        }

        console.log('[PLATFORM SUPPORT] Sending message (legacy):', {
            companyId,
            userId: req.user.sub,
            userRoles: req.user.roles
        });

        
        let ticket = await SupportTicket.findOne({
            companyId,
            subject: 'Live Chat Support',
            status: { $in: ['open', 'in-progress'] }
        }).sort({ createdAt: -1 });

        if (!ticket) {
            
            ticket = await SupportTicket.create({
                companyId,
                creatorId: req.user.sub,
                subject: 'Live Chat Support',
                description: 'Ongoing support conversation',
                status: 'open',
                priority: 'medium'
            });
        }

        
        const message = await SupportMessage.create({
            ticket: ticket._id,
            company: companyId,
            sender: req.user.sub,
            senderRole: 'company',
            content: content.trim()
        });

        await message.populate('sender', 'username email profilePicture');

        console.log('[PLATFORM SUPPORT] Message created successfully:', message._id);

        
        if (req.app.get('io')) {
            const io = req.app.get('io');
            
            io.to(`user-support:${req.user.sub}`).emit('platform-message', message);
            
            io.to('platform-admins').emit('platform-message', message);
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

exports.markMessageAsRead = async (req, res) => {
    try {
        const { messageId } = req.params;

        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const _message = await SupportMessage.markAsRead(messageId, req.user.sub);

        return res.json({
            success: true,
            message: 'Message marked as read'
        });
    } catch (error) {
        console.error('MARK MESSAGE AS READ ERROR:', error);
        if (error.message === 'Message not found') {
            return res.status(404).json({ message: error.message });
        }
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.getTickets = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { status, priority, limit = 50, skip = 0 } = req.query;

        const query = { companyId };

        if (status) {
            query.status = status;
        }

        if (priority) {
            query.priority = priority;
        }

        const tickets = await SupportTicket.find(query)
            .populate('creatorId', 'username email profilePicture')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await SupportTicket.countDocuments(query);

        return res.json({
            tickets,
            total,
            hasMore: (parseInt(skip) + tickets.length) < total
        });
    } catch (error) {
        console.error('GET TICKETS ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.createTicket = async (req, res) => {
    try {
        const { companyId, subject, _category, priority, description } = req.body;

        if (!subject || !description) {
            return res.status(400).json({ message: 'Subject and description are required' });
        }

        if (!companyId) {
            return res.status(400).json({ message: 'Company ID is required' });
        }

        const ticket = await SupportTicket.create({
            companyId,
            creatorId: req.user.sub || req.user._id,
            subject,
            priority: priority || 'medium',
            description,
            status: 'open'
        });

        await ticket.populate('creatorId', 'username email profilePicture');

        
        const initialMessage = await SupportMessage.create({
            ticket: ticket._id,
            company: companyId,
            sender: req.user.sub || req.user._id,
            senderRole: 'company',
            content: description
        });

        
        if (req.app.get('io')) {
            req.app.get('io').to('platform-admins').emit('new-support-ticket', {
                ticket,
                message: initialMessage
            });
        }

        return res.status(201).json({ ticket });
    } catch (error) {
        console.error('CREATE TICKET ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.updateTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { status, priority, internalNotes } = req.body;

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

        if (priority) {
            ticket.priority = priority;
        }

        if (internalNotes !== undefined) {
            ticket.internalNotes = internalNotes;
        }

        await ticket.save();
        await ticket.populate('creatorId', 'username email profilePicture');

        return res.json({ ticket });
    } catch (error) {
        console.error('UPDATE TICKET ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = exports;
