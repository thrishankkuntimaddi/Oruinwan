const AuditLog = require('../../../models/AuditLog');
const SupportTicket = require('../../../models/SupportTicket');
const PlatformSession = require('../../../models/PlatformSession');
const Message = require("../messages/message.model.js");
const User = require('../../../models/User');
const Company = require('../../../models/Company');

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
            .populate('userId', 'username email')
            .populate('companyId', 'name')
            .lean();

        const total = await AuditLog.countDocuments(filter);

        
        if (!req.query.page) {
            const allLogs = await AuditLog.find(filter)
                .sort({ createdAt: -1 })
                .populate('userId', 'username email')
                .populate('companyId', 'name')
                .lean();
            return res.json(allLogs);
        }

        res.json({
            logs,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (err) {
        console.error("AUDIT LOG ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getActiveCompanies = async (req, res) => {
    try {
        const companies = await Company.find({ verificationStatus: 'verified' })
            .select('name domain plan billingEmail createdAt admins logo')
            .populate('admins.user', 'username email')
            .sort({ createdAt: -1 });

        res.json(companies);
    } catch (err) {
        console.error("ACTIVE COMPANIES ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getAllTickets = async (req, res) => {
    try {
        const tickets = await SupportTicket.find()
            .populate('companyId', 'name')
            .populate('creatorId', 'username email')
            .sort({ updatedAt: -1 });

        res.json(tickets);
    } catch (err) {
        console.error("GET TICKETS ERROR:", err);
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
        console.error("CREATE TICKET ERROR:", err);
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

        
        const updatedTicket = await SupportTicket.findById(req.params.id)
            .populate('messages.sender', 'username email profilePicture');

        res.json(updatedTicket);
    } catch (err) {
        console.error("UPDATE TICKET ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getPlatformSession = async (req, res) => {
    try {
        const { companyId } = req.params; 
        
        

        
        

        
        const company = await Company.findById(companyId).populate('admins.user');
        if (!company) return res.status(404).json({ message: "Company not found" });

        const owner = company.admins.find(a => a.role === 'owner')?.user;
        if (!owner) return res.status(400).json({ message: "Company has no owner" });

        
        
        
        
        const superAdmins = await User.find({ roles: 'chttrix_admin' });
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
        console.error("GET SESSION ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getSessionMessages = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const messages = await Message.find({ platformSession: sessionId })
            .populate('sender', 'username email profilePicture roles')
            .sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        console.error("GET MESSAGES ERROR:", err);
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

        const fullMessage = await Message.findById(message._id).populate('sender', 'username email profilePicture roles');

        
        

        res.json(fullMessage);
    } catch (err) {
        console.error("SEND MESSAGE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};
