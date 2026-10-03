const logger = require('../../../utils/logger');
const _mongoose = require('mongoose');

const SupportMessage = require('../../../models/SupportMessage');
const SupportTicket = require('../../../models/SupportTicket');
const identity = require('../../identity');
const { hydrate } = require('../../identity/hydrate');

const SENDER = { type: 'user', fields: ['username', 'email', 'profilePicture'] };

/** Mongo document(s) → plain objects with user references expanded from PostgreSQL. */
async function expand(docs, paths) {
    const toPlain = (d) => (d && typeof d.toObject === 'function' ? d.toObject() : d);
    const out = Array.isArray(docs) ? docs.map(toPlain) : toPlain(docs);
    await hydrate(out, paths);
    return out;
}

const PLATFORM_ADMIN_ROLES = ['chttrix_admin', 'platform-admin'];

// Resolve the caller from the DB (JWT claims are not trusted for roles/company).
async function getCaller(req) {
    const userId = req.user && (req.user.sub || req.user._id);
    if (!userId) return null;
    const user = await identity.users.findById(userId);
    if (!user) return null;
    return {
        id: String(userId),
        companyId: user.companyId ? String(user.companyId) : null,
        isPlatformAdmin: Array.isArray(user.roles) && user.roles.some(r => PLATFORM_ADMIN_ROLES.includes(r)),
    };
}

function canAccessCompany(caller, companyId) {
    if (!caller) return false;
    if (caller.isPlatformAdmin) return true;
    const cid = companyId && (companyId._id || companyId);
    return !!cid && !!caller.companyId && String(cid) === caller.companyId;
}

exports.getTicketMessages = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { limit = 50, before, after } = req.query;

        
        const ticket = await SupportTicket.findById(ticketId);
        const caller = await getCaller(req);
        if (!ticket || !canAccessCompany(caller, ticket.companyId)) {
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
        logger.error('GET TICKET MESSAGES ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { limit = 100 } = req.query;

        if (!canAccessCompany(await getCaller(req), companyId)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const messages = await expand(await SupportMessage.find({
            company: companyId,
            deletedAt: null
        })
            .populate('ticket', 'subject status')
            .sort({ createdAt: 1 })
            .limit(parseInt(limit)), { sender: SENDER });

        return res.json({ messages });
    } catch (error) {
        logger.error('GET MESSAGES ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.sendTicketMessage = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { content, attachments } = req.body;

        
        if (!req.user || !req.user.sub) {
            logger.error('SEND MESSAGE ERROR: User not authenticated', { user: req.user });
            return res.status(401).json({ message: 'Authentication required' });
        }

        
        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Message content is required' });
        }

        
        const ticket = await SupportTicket.findById(ticketId);
        const caller = await getCaller(req);
        if (!ticket || !canAccessCompany(caller, ticket.companyId)) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        // Personal-account tickets have no company room or SupportMessage company;
        // platform admins reply to them through /api/admin/tickets/:id.
        if (!ticket.companyId) {
            return res.status(400).json({ message: 'Reply to personal-account requests from the Support Tickets console' });
        }

        logger.info('[PLATFORM SUPPORT] Sending message to ticket:', {
            ticketId,
            userId: req.user.sub,
            userRoles: req.user.roles
        });

        
        const isPlatformAdmin = caller.isPlatformAdmin;
        const senderRole = isPlatformAdmin ? 'platform' : 'company';

        const created = await SupportMessage.create({
            ticket: ticketId,
            company: ticket.companyId,
            sender: req.user.sub,
            senderRole,
            content: content.trim(),
            attachments: attachments || []
        });

        const message = await expand(created, { sender: SENDER });

        logger.info('[PLATFORM SUPPORT] Message created successfully:', message._id);

        
        if (ticket.status === 'open' && isPlatformAdmin) {
            ticket.status = 'in-progress';
            await ticket.save();
        }

        
        if (req.app.get('io')) {
            const io = req.app.get('io');

            
            io.to(`company_${ticket.companyId}`).emit('support-message', {
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
        logger.error('SEND TICKET MESSAGE ERROR:', error);
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
            logger.error('SEND MESSAGE ERROR: User not authenticated', { user: req.user });
            return res.status(401).json({ message: 'Authentication required' });
        }

        
        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Message content is required' });
        }

        
        if (!companyId) {
            return res.status(400).json({ message: 'Company ID is required' });
        }

        if (!canAccessCompany(await getCaller(req), companyId)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        logger.info('[PLATFORM SUPPORT] Sending message (legacy):', {
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

        
        const created = await SupportMessage.create({
            ticket: ticket._id,
            company: companyId,
            sender: req.user.sub,
            senderRole: 'company',
            content: content.trim()
        });

        const message = await expand(created, { sender: SENDER });

        logger.info('[PLATFORM SUPPORT] Message created successfully:', message._id);

        
        if (req.app.get('io')) {
            const io = req.app.get('io');
            
            io.to(`user-support:${req.user.sub}`).emit('platform-message', message);
            
            io.to('platform-admins').emit('platform-message', message);
        }

        return res.status(201).json({ message });
    } catch (error) {
        logger.error('SEND MESSAGE ERROR:', error);
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

        const existing = await SupportMessage.findById(messageId).select('company').lean();
        if (!existing || !canAccessCompany(await getCaller(req), existing.company)) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const _message = await SupportMessage.markAsRead(messageId, req.user.sub);

        return res.json({
            success: true,
            message: 'Message marked as read'
        });
    } catch (error) {
        logger.error('MARK MESSAGE AS READ ERROR:', error);
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

        const caller = await getCaller(req);
        if (!canAccessCompany(caller, companyId)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const query = { companyId };
        if (typeof status !== 'undefined' && typeof status !== 'string') {
            return res.status(400).json({ message: 'Invalid status filter' });
        }
        if (typeof priority !== 'undefined' && typeof priority !== 'string') {
            return res.status(400).json({ message: 'Invalid priority filter' });
        }

        if (status) {
            query.status = status;
        }

        if (priority) {
            query.priority = priority;
        }

        const tickets = await expand(await SupportTicket.find(query)
            .select(caller.isPlatformAdmin ? '' : '-internalNotes')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip)), { creatorId: SENDER });

        const total = await SupportTicket.countDocuments(query);

        return res.json({
            tickets,
            total,
            hasMore: (parseInt(skip) + tickets.length) < total
        });
    } catch (error) {
        logger.error('GET TICKETS ERROR:', error);
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

        if (!canAccessCompany(await getCaller(req), companyId)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const ticketDoc = await SupportTicket.create({
            companyId,
            creatorId: req.user.sub || req.user._id,
            subject,
            priority: priority || 'medium',
            description,
            status: 'open'
        });
        const ticket = await expand(ticketDoc, { creatorId: SENDER });

        
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
        logger.error('CREATE TICKET ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.updateTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { status, priority, internalNotes } = req.body;

        const ticket = await SupportTicket.findById(ticketId);
        const caller = await getCaller(req);

        if (!ticket || !canAccessCompany(caller, ticket.companyId)) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        // Internal notes and priority are platform-staff fields.
        if (!caller.isPlatformAdmin && (internalNotes !== undefined || priority)) {
            return res.status(403).json({ message: 'Only platform admins can change priority or internal notes' });
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

        return res.json({ ticket: await expand(ticket, { creatorId: SENDER }) });
    } catch (error) {
        logger.error('UPDATE TICKET ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = exports;
