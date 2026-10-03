const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const SupportTicket = require('../../../models/SupportTicket');
const logger = require('../../../utils/logger');

const identity = require('../../identity');
const { hydrate } = require('../../identity/hydrate');

const USER_EMAIL = { type: 'user', fields: ['username', 'email'] };
const plain = (d) => (d && typeof d.toObject === 'function' ? d.toObject() : d);
const requireAuth = require('../../shared/middleware/auth');
const supportTickets = require('./supportTickets.service');

const CATEGORIES = ['question', 'problem', 'feedback', 'billing'];
const PRIORITIES = ['low', 'medium', 'high'];
const LIMITS = { subject: 150, description: 5000, message: 5000, path: 300, appVersion: 60, userAgent: 400 };

router.use(requireAuth);

// Access tokens do not carry the company, so resolve it from the user record.
// Company users share their company's tickets; personal accounts see only their own.
router.use(async (req, res, next) => {
    try {
        const user = await identity.users.findById(req.user.sub);
        if (!user) return res.status(401).json({ message: 'Authentication required' });
        req.supportCompanyId = user.companyId || null;
        next();
    } catch (err) {
        next(err);
    }
});

// New requests per user per hour. Replies to an existing ticket are not counted.
const createLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: Number(process.env.SUPPORT_TICKETS_PER_HOUR || 5),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `support:${req.user.sub}`,
    handler: (_req, res) => res.status(429).json({
        message: 'You have sent several requests in the last hour. Please wait a bit before sending another.',
        code: 'SUPPORT_RATE_LIMITED',
    }),
});

function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function clip(value, max) {
    const v = text(value);
    return v ? v.slice(0, max) : undefined;
}

/** Tickets the caller may see: their company's tickets, or their own when they have no company. */
function visibleTo(req, extra = {}) {
    return req.supportCompanyId
        ? { ...extra, $or: [{ companyId: req.supportCompanyId }, { creatorId: req.user.sub }] }
        : { ...extra, creatorId: req.user.sub };
}

router.post('/tickets', createLimiter, async (req, res) => {
    try {
        const body = req.body || {};
        const subject = text(body.subject);
        const description = text(body.description);
        const category = body.category === undefined ? 'question' : body.category;
        const priority = body.priority === undefined ? 'medium' : body.priority;
        const userId = req.user.sub;

        if (!subject || !description) {
            return res.status(400).json({ message: 'Subject and description are required' });
        }
        if (subject.length > LIMITS.subject) {
            return res.status(400).json({ message: `Subject must be at most ${LIMITS.subject} characters` });
        }
        if (description.length > LIMITS.description) {
            return res.status(400).json({ message: `Description must be at most ${LIMITS.description} characters` });
        }
        if (!CATEGORIES.includes(category)) {
            return res.status(400).json({ message: `Category must be one of: ${CATEGORIES.join(', ')}` });
        }
        if (!PRIORITIES.includes(priority)) {
            return res.status(400).json({ message: `Priority must be one of: ${PRIORITIES.join(', ')}` });
        }

        const ctx = body.context && typeof body.context === 'object' ? body.context : {};
        const context = {
            path: clip(ctx.path, LIMITS.path),
            appVersion: clip(ctx.appVersion, LIMITS.appVersion),
            userAgent: clip(ctx.userAgent || req.get('user-agent'), LIMITS.userAgent),
        };

        const ticket = new SupportTicket({
            companyId: req.supportCompanyId,
            creatorId: userId,
            subject,
            description,
            category,
            priority,
            context,
            messages: []
        });

        await ticket.save();
        logger.info(`Support Ticket Created: ${ticket._id} by ${userId} (${category})`);

        const io = req.app.get('io');
        if (io) io.to('platform-admins').emit('new-support-ticket', { ticket });

        res.status(201).json({ message: 'Ticket created successfully', ticket });
    } catch (err) {
        logger.error('CREATE TICKET ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// The caller's own requests with their status and support's replies (for the in-app Help panel).
router.get('/tickets/mine', async (req, res) => {
    try {
        const tickets = await supportTickets.listTicketsForCreator(req.user.sub);
        res.json({ tickets });
    } catch (err) {
        logger.error('GET MY TICKETS ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/tickets', async (req, res) => {
    try {
        const tickets = (await SupportTicket.find(visibleTo(req))
            .select('-internalNotes')
            .sort({ createdAt: -1 })).map(plain);
        await hydrate(tickets, { creatorId: USER_EMAIL });

        res.json({ tickets });
    } catch (err) {
        logger.error('GET TICKETS ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/tickets/:id', async (req, res) => {
    try {
        const ticket = plain(await SupportTicket.findOne(visibleTo(req, { _id: req.params.id }))
            .select('-internalNotes'));
        if (ticket) await hydrate(ticket, { creatorId: USER_EMAIL, 'messages.sender': { type: 'user', fields: ['username', 'email', 'profilePicture'] } });

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        res.json({ ticket });
    } catch (err) {
        if (err && err.name === 'CastError') return res.status(404).json({ message: 'Ticket not found' });
        logger.error('GET TICKET ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/tickets/:id/message', async (req, res) => {
    try {
        const message = text(req.body && req.body.message);
        const userId = req.user.sub;

        if (!message) {
            return res.status(400).json({ message: 'Message cannot be empty' });
        }
        if (message.length > LIMITS.message) {
            return res.status(400).json({ message: `Message must be at most ${LIMITS.message} characters` });
        }

        const ticket = await SupportTicket.findOne(visibleTo(req, { _id: req.params.id }));
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
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
        res.json({ message: 'Message added', ticket });

    } catch (err) {
        if (err && err.name === 'CastError') return res.status(404).json({ message: 'Ticket not found' });
        logger.error('ADD TICKET MESSAGE ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
