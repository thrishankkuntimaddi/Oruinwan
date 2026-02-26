const AuditLog = require('../../../models/AuditLog');
const SupportTicket = require('../../../models/SupportTicket');
const PlatformSession = require('../../../models/PlatformSession');
const Message = require("../messages/message.model.js");
const User = require('../../../models/User');
const Company = require('../../../models/Company');

// ============================================================================
// AUDIT LOGS
// ============================================================================

exports.getAuditLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100; // Increased for better UX
        const { action, resource, userId, dateFrom, dateTo } = req.query;

        // Build filter object
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

        // Date range filtering
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

        // If no pagination requested, return all logs
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

// ============================================================================
// ACTIVE COMPANIES (Multi-Tenant View)
// ============================================================================

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

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

// Get all tickets (Platform Admin View)
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

// Create a ticket (Company Admin View)
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

        // Create Audit Log
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

// Update ticket (Reply/Status)
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

        // Populate sender for the new message if returned
        const updatedTicket = await SupportTicket.findById(req.params.id)
            .populate('messages.sender', 'username email profilePicture');

        res.json(updatedTicket);
    } catch (err) {
        console.error("UPDATE TICKET ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ============================================================================
// PLATFORM CHAT
// ============================================================================

// Get or Create Session with a Company Admin
exports.getPlatformSession = async (req, res) => {
    try {
        const { companyId } = req.params; // Target company
        // If Requesting User is Platform Admin: target company is param
        // If Requesting User is Company Admin: target is self (connect to platform admin)

        // Simplified Logic: 
        // 1. Identify participants: Current User + Target (Platform Super Admin or Company Owner)

        // Find the Company Owner
        const company = await Company.findById(companyId).populate('admins.user');
        if (!company) return res.status(404).json({ message: "Company not found" });

        const owner = company.admins.find(a => a.role === 'owner')?.user;
        if (!owner) return res.status(400).json({ message: "Company has no owner" });

        // Find Super Admins (Platform Admins) - For now just pick one or all?
        // Ideally, the session is "Company vs Platform Support", not specific user.
        // But our model uses 'participants'. 
        // Let's find ANY user with 'chttrix_admin' role to add to participants if not present.
        const superAdmins = await User.find({ roles: 'chttrix_admin' });
        const superAdminIds = superAdmins.map(u => u._id);

        // Check if session exists
        let session = await PlatformSession.findOne({ companyId });

        if (!session) {
            // Create new
            session = new PlatformSession({
                companyId,
                participants: [owner._id, ...superAdminIds]
            });
            await session.save();
        }

        // Ensure current user is participant (if logic skipped them)
        if (!session.participants.includes(req.user.sub)) {
            // session.participants.push(req.user.sub);
            // await session.save();
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

        // Update session
        await PlatformSession.findByIdAndUpdate(sessionId, {
            lastMessageAt: new Date(),
            lastMessagePreview: text.substring(0, 50)
        });

        const fullMessage = await Message.findById(message._id).populate('sender', 'username email profilePicture roles');

        // Real-time socket emission would go here
        // req.io.to(`platform_session_${sessionId}`).emit('param_message', fullMessage);

        res.json(fullMessage);
    } catch (err) {
        console.error("SEND MESSAGE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};
