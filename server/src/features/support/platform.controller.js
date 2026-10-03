const logger = require('../../../utils/logger');
const AuditLog = require('../../../models/AuditLog');
const SupportTicket = require('../../../models/SupportTicket');
const PlatformSession = require('../../../models/PlatformSession');
const Message = require("../../modules/messages/message.model.js");
const org = require('../../identity/queries/org');
const { hydrate, COMPANY_MIN } = require('../../identity/hydrate');

const USER_EMAIL = { type: 'user', fields: ['username', 'email'] };
const USER_FULL = { type: 'user', fields: ['username', 'email', 'profilePicture', 'roles'] };
const COMPANY_NAME = { ...COMPANY_MIN, fields: ['name'] };

/** Mongo document(s) → plain objects with user / company references expanded from PostgreSQL. */
async function expand(docs, paths) {
    const toPlain = (d) => (d && typeof d.toObject === 'function' ? d.toObject() : d);
    const out = Array.isArray(docs) ? docs.map(toPlain) : toPlain(docs);
    await hydrate(out, paths);
    return out;
}

exports.getAuditLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100; 
        const { action, resource, userId, dateFrom, dateTo } = req.query;

        
        const filter = {};

        if (action && action !== 'all') {
            filter.action = action;
        }

        if (resource && resource !== 'all') {
            filter.resource = resource;
        }

        if (userId) {
            filter.userId = userId;
        }

        
        if (dateFrom || dateTo) {
            filter.createdAt = {};
            if (dateFrom) {
                filter.createdAt.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = endDate;
            }
        }

        const logs = await AuditLog.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
            .then((rows) => hydrate(rows, { userId: USER_EMAIL, companyId: COMPANY_NAME }));

        const total = await AuditLog.countDocuments(filter);

        
        if (!req.query.page) {
            const allLogs = await AuditLog.find(filter)
                .sort({ createdAt: -1 })
                .lean()
                .then((rows) => hydrate(rows, { userId: USER_EMAIL, companyId: COMPANY_NAME }));
            return res.json(allLogs);
        }

        res.json({
            logs,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (err) {
        logger.error("AUDIT LOG ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getActiveCompanies = async (req, res) => {
    try {
        const companies = await org.companies.find({ verificationStatus: 'verified' }, {
            select: 'name domain plan billingEmail createdAt admins logo',
            sort: { createdAt: -1 },
        });
        await hydrate(companies, { 'admins.user': USER_EMAIL });

        res.json(companies);
    } catch (err) {
        logger.error("ACTIVE COMPANIES ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getAllTickets = async (req, res) => {
    try {
        const tickets = await expand(await SupportTicket.find().sort({ updatedAt: -1 }), { companyId: COMPANY_NAME, creatorId: USER_EMAIL });

        res.json(tickets);
    } catch (err) {
        logger.error("GET TICKETS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.createTicket = async (req, res) => {
    try {
        const { subject, description, priority } = req.body;
        const companyId = req.user.companyId;

        const ticket = new SupportTicket({
            companyId,
            creatorId: req.user.sub,
            subject,
            description,
            priority: priority || 'medium',
            messages: []
        });

        await ticket.save();

        
        await AuditLog.create({
            companyId,
            userId: req.user.sub,
            action: 'ticket.created',
            details: { ticketId: ticket._id, subject }
        });

        res.status(201).json(ticket);
    } catch (err) {
        logger.error("CREATE TICKET ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.updateTicket = async (req, res) => {
    try {
        const { status, message, internalNotes } = req.body;
        const ticket = await SupportTicket.findById(req.params.id);

        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        if (status) ticket.status = status;
        if (internalNotes) ticket.internalNotes = internalNotes;

        if (message) {
            ticket.messages.push({
                sender: req.user.sub,
                message,
                createdAt: new Date()
            });
        }

        if (status === 'resolved' && !ticket.resolvedAt) {
            ticket.resolvedAt = new Date();
        }
        if (status === 'closed' && !ticket.closedAt) {
            ticket.closedAt = new Date();
        }

        await ticket.save();

        
        const updatedTicket = await expand(await SupportTicket.findById(req.params.id), { 'messages.sender': { type: 'user', fields: ['username', 'email', 'profilePicture'] } });

        res.json(updatedTicket);
    } catch (err) {
        logger.error("UPDATE TICKET ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getPlatformSession = async (req, res) => {
    try {
        const { companyId } = req.params; 
        
        

        
        

        
        const company = await org.companies.findOne({ _id: companyId });
        if (!company) return res.status(404).json({ message: "Company not found" });

        const ownerId = company.admins.find(a => a.role === 'owner')?.user;
        if (!ownerId) return res.status(400).json({ message: "Company has no owner" });
        const owner = { _id: ownerId };

        
        
        
        
        const superAdmins = await org.users.find({ roles: 'chttrix_admin' }, { select: '_id' });
        const superAdminIds = superAdmins.map(u => u._id);

        
        let session = await PlatformSession.findOne({ companyId });

        if (!session) {
            
            session = new PlatformSession({
                companyId,
                participants: [owner._id, ...superAdminIds]
            });
            await session.save();
        }

        
        if (!session.participants.includes(req.user.sub)) {
            
            
        }

        res.json(session);

    } catch (err) {
        logger.error("GET SESSION ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getSessionMessages = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const messages = await expand(await Message.find({ platformSession: sessionId }).sort({ createdAt: 1 }), { sender: USER_FULL });

        res.json(messages);
    } catch (err) {
        logger.error("GET MESSAGES ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.sendSessionMessage = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { text } = req.body;

        const message = new Message({
            platformSession: sessionId,
            sender: req.user.sub,
            text
        });

        await message.save();

        
        await PlatformSession.findByIdAndUpdate(sessionId, {
            lastMessageAt: new Date(),
            lastMessagePreview: text.substring(0, 50)
        });

        const fullMessage = await expand(await Message.findById(message._id), { sender: USER_FULL });

        
        

        res.json(fullMessage);
    } catch (err) {
        logger.error("SEND MESSAGE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};
