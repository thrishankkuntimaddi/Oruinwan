
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const Ticket = require('../models/Ticket');
const Broadcast = require('../models/Broadcast');
const Billing = require('../models/Billing');
const sendEmail = require('../utils/sendEmail');
const adminController = require('../controllers/adminController');
const platformController = require('../controllers/platformController');
const AuditLog = require('../models/AuditLog');
const requireAuth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/permissionMiddleware');


// Simple middleware to check for Super Admin
const requireSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);

    if (user && user.roles.includes('chttrix_admin')) {
      next();
    } else {
      res.status(403).json({ message: "Access denied: Super Admin only" });
    }
  } catch (err) {
    res.status(500).json({ message: "Auth Error" });
  }
};

// GET /api/admin/overview/stats - Dashboard statistics
router.get('/overview/stats', requireSuperAdmin, async (req, res) => {
  try {
    const totalCompanies = await Company.countDocuments({ verificationStatus: 'verified' });
    const pendingRequests = await Company.countDocuments({ verificationStatus: 'pending' });

    // Get total active users across all companies
    const activeUsers = await User.countDocuments({
      accountStatus: 'active',
      companyId: { $exists: true }
    });

    // Get open tickets count
    const openTickets = await Ticket.countDocuments({
      status: { $in: ['open', 'in-progress'] }
    });

    // Get monthly revenue from billing
    const billings = await Billing.find({ status: 'active' });
    const monthlyRevenue = billings
      .filter(b => b.billingCycle === 'monthly')
      .reduce((sum, b) => sum + b.amount, 0);

    // Calculate growth rates (compare with last month)
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const companiesLastMonth = await Company.countDocuments({
      verificationStatus: 'verified',
      createdAt: { $lte: lastMonth }
    });

    const companiesGrowth = companiesLastMonth > 0
      ? (((totalCompanies - companiesLastMonth) / companiesLastMonth) * 100).toFixed(1)
      : 0;

    res.json({
      totalCompanies,
      activeUsers,
      openTickets,
      monthlyRevenue,
      pendingRequests,
      companiesGrowth: parseFloat(companiesGrowth),
      usersGrowth: 0,
      revenueGrowth: 0
    });
  } catch (err) {
    console.error('Error fetching overview stats:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// GET /api/admin/overview/activities - Recent activity feed
router.get('/overview/activities', requireSuperAdmin, async (req, res) => {
  try {
    const activities = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('userId', 'username')
      .lean();

    const formattedActivities = activities.map(log => ({
      type: log.action,
      description: log.description,
      timestamp: log.createdAt
    }));

    res.json(formattedActivities);
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// GET /api/admin/pending-companies
router.get('/pending-companies', requireSuperAdmin, async (req, res) => {
  try {
    console.log("🔍 Looking for pending companies...");
    const companies = await Company.find({ verificationStatus: 'pending' })
      .populate({
        path: 'admins.user',
        select: 'username name email personalEmail phone phoneCode jobTitle role emails'
      })
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${companies.length} pending companies`);
    if (companies.length > 0) {
      console.log("📋 Companies:", companies.map(c => ({ name: c.name, status: c.verificationStatus })));
    }
    res.json(companies);
  } catch (err) {
    console.error("❌ Error fetching pending companies:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// POST /api/admin/approve-company/:id
router.post('/approve-company/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: "Company not found" });

    company.verificationStatus = 'verified';
    await company.save();

    // Activate the admin user
    const adminUser = await User.findOne({ companyId: company._id, companyRole: 'owner' });
    if (adminUser) {
      adminUser.accountStatus = 'active';
      await adminUser.save();

      // Send approval email to PERSONAL email (not company email)
      try {
        // Use personalEmail field if available, otherwise fall back to email
        const personalEmail = adminUser.personalEmail || adminUser.email;

        const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
        const { companyApprovedTemplate } = require('../utils/emailTemplates');
        const template = companyApprovedTemplate(adminUser.username, company.name, loginUrl, message);

        await sendEmail({
          to: personalEmail,
          subject: template.subject,
          html: template.html,
          text: template.text
        });
        console.log(`📧 Approval email sent to personal email: ${personalEmail}`);
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError.message);
        // Don't fail the request if email fails
      }
    }

    // Audit Log
    const auditUser = await User.findById(req.user.sub);
    await AuditLog.create({
      companyId: company._id,
      userId: req.user.sub,
      action: 'company.approved',
      resource: 'Company',
      resourceId: company._id,
      description: `Company ${company.name} approved by ${auditUser ? auditUser.username : 'Admin'}`
    });


    res.json({ message: "Company Approved", company });
  } catch (err) {

    res.status(500).json({ message: "Server Error" });
  }
});

// POST /api/admin/reject-company/:id
router.post('/reject-company/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { message, reason } = req.body;
    const finalReason = message || reason; // Use message as primary rejection reason

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: "Company not found" });

    company.verificationStatus = 'rejected';
    company.rejectionReason = finalReason;
    await company.save();

    // Notify Admin via email to PERSONAL email
    const adminUser = await User.findOne({ companyId: company._id, companyRole: 'owner' });
    if (adminUser) {
      // Send rejection email to personal email (not company email)
      try {
        // Use personalEmail field if available, otherwise fall back to email
        const personalEmail = adminUser.personalEmail || adminUser.email;

        const { companyRejectedTemplate } = require('../utils/emailTemplates');
        const template = companyRejectedTemplate(adminUser.username, company.name, finalReason, message);

        await sendEmail({
          to: personalEmail,
          subject: template.subject,
          html: template.html,
          text: template.text
        });
        console.log(`📧 Rejection email sent to personal email: ${personalEmail}`);
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError.message);
        // Don't fail the request if email fails
      }
    }

    // Audit Log
    const auditUser = await User.findById(req.user.sub);
    await AuditLog.create({
      companyId: company._id,
      userId: req.user.sub,
      action: 'company.rejected',
      resource: 'Company',
      resourceId: company._id,
      details: { reason: finalReason },
      description: `Company ${company.name} rejected by ${auditUser ? auditUser.username : 'Admin'}`
    });

    res.json({ message: "Company Rejected", company });
  } catch (err) {

    res.status(500).json({ message: "Server Error" });
  }
});

// ============================================================================
// PLATFORM ADMIN FEATURES (Protected by requireSuperAdmin)
// ============================================================================

// Audit Logs
router.get('/audit-logs', requireSuperAdmin, platformController.getAuditLogs);

// Active Companies (Multi-Tenant View)
router.get('/active-companies', requireSuperAdmin, platformController.getActiveCompanies);

// Support Tickets (Platform Admin View)
router.get('/tickets', requireSuperAdmin, platformController.getAllTickets);
router.put('/tickets/:id', requireSuperAdmin, platformController.updateTicket); // Reply/Status

// Platform Chat (Platform Admin View)
router.get('/chat/session/:companyId', requireSuperAdmin, platformController.getPlatformSession);
router.get('/chat/session/:sessionId/messages', requireSuperAdmin, platformController.getSessionMessages);
router.post('/chat/session/:sessionId/messages', requireSuperAdmin, platformController.sendSessionMessage);

// ================================================================================
// SUPPORT TICKETS ROUTES
// ================================================================================

// GET /api/admin/tickets - List all tickets with filters
router.get('/tickets', requireSuperAdmin, async (req, res) => {
  try {
    const { status, priority, companyId } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (companyId) filter.companyId = companyId;

    const tickets = await Ticket.find(filter)
      .populate('companyId', 'name domain')
      .populate('creatorId', 'username email')
      .populate('messages.sender', 'username roles')
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (err) {
    console.error('Error fetching tickets:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// GET /api/admin/tickets/:id - Get single ticket details
router.get('/tickets/:id', requireSuperAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('companyId', 'name domain')
      .populate('creatorId', 'username email')
      .populate('messages.sender', 'username roles');

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (err) {
    console.error('Error fetching ticket:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// PUT /api/admin/tickets/:id - Update ticket (status or add reply)
router.put('/tickets/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { status, message } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Update status if provided
    if (status) {
      ticket.status = status;

      // Log audit
      await AuditLog.create({
        userId: req.user.sub,
        action: 'ticket_status_updated',
        resource: 'Ticket',
        resourceId: ticket._id,
        description: `Ticket ${ticket._id} status updated to ${status}`
      });
    }

    // Add message if provided
    if (message) {
      ticket.messages.push({
        sender: req.user.sub,
        message,
        createdAt: new Date()
      });

      // Log audit
      await AuditLog.create({
        userId: req.user.sub,
        action: 'ticket_reply_added',
        resource: 'Ticket',
        resourceId: ticket._id,
        description: `Reply added to ticket ${ticket._id}`
      });
    }

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('companyId', 'name domain')
      .populate('creatorId', 'username email')
      .populate('messages.sender', 'username roles');

    res.json(updatedTicket);
  } catch (err) {
    console.error('Error updating ticket:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ================================================================================
// BROADCAST ROUTES
// ================================================================================

// POST /api/admin/broadcast/send - Send broadcast
router.post('/broadcast/send', requireSuperAdmin, async (req, res) => {
  try {
    const { subject, message, targetType, targetCompanies } = req.body;

    // Determine recipients based on targetType
    let companies = [];
    switch (targetType) {
      case 'all':
        companies = await Company.find({ verificationStatus: 'verified' });
        break;
      case 'active':
        companies = await Company.find({ verificationStatus: 'verified' });
        break;
      case 'pending':
        companies = await Company.find({ verificationStatus: 'pending' });
        break;
      case 'specific':
        companies = await Company.find({ _id: { $in: targetCompanies } });
        break;
      default:
        return res.status(400).json({ message: 'Invalid target type' });
    }

    // Create broadcast record
    const broadcast = await Broadcast.create({
      subject,
      message,
      targetType,
      targetCompanies: targetType === 'specific' ? targetCompanies : companies.map(c => c._id),
      recipientCount: companies.length,
      sentBy: req.user.sub,
      status: 'sent'
    });

    // TODO: Send emails to companies
    // For now, we'll just create the record
    // In production, you'd send emails here using sendEmail utility

    // Log audit
    await AuditLog.create({
      userId: req.user.sub,
      action: 'broadcast_sent',
      resource: 'Broadcast',
      resourceId: broadcast._id,
      description: `Broadcast sent to ${companies.length} companies: "${subject}"`
    });

    res.json({
      success: true,
      message: `Broadcast sent to ${companies.length} companies`,
      broadcast
    });
  } catch (err) {
    console.error('Error sending broadcast:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// GET /api/admin/broadcast/history - Get broadcast history
router.get('/broadcast/history', requireSuperAdmin, async (req, res) => {
  try {
    const broadcasts = await Broadcast.find()
      .populate('sentBy', 'username')
      .sort({ sentAt: -1 })
      .limit(50);

    res.json(broadcasts);
  } catch (err) {
    console.error('Error fetching broadcast history:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ================================================================================
// DIRECT MESSAGES ROUTES
// ================================================================================

// GET /api/admin/dm/:companyId - Get messages with company
router.get('/dm/:companyId', requireSuperAdmin, async (req, res) => {
  try {
    // TODO: Implement DM message storage
    // For now, return empty array
    // In production, create a Message model for admin-company DMs
    res.json([]);
  } catch (err) {
    console.error('Error fetching DM messages:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// POST /api/admin/dm/:companyId - Send message to company
router.post('/dm/:companyId', requireSuperAdmin, async (req, res) => {
  try {
    const { message } = req.body;

    // TODO: Implement DM message storage
    // For now, just log and return success
    // In production, save to Message collection

    const newMessage = {
      sender: { _id: req.user.sub, username: 'Admin', roles: ['chttrix_admin'] },
      message,
      createdAt: new Date()
    };

    // Log audit
    await AuditLog.create({
      userId: req.user.sub,
      action: 'admin_message_sent',
      resource: 'Company',
      resourceId: req.params.companyId,
      description: `Admin sent message to company`
    });

    res.json(newMessage);
  } catch (err) {
    console.error('Error sending DM:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ================================================================================
// BILLING ROUTES
// ================================================================================

// GET /api/admin/billing/overview - Get billing overview stats
router.get('/billing/overview', requireSuperAdmin, async (req, res) => {
  try {
    const billings = await Billing.find({ status: 'active' });

    const totalRevenue = billings.reduce((sum, b) => sum + b.amount, 0);
    const avgPerCompany = billings.length > 0 ? totalRevenue / billings.length : 0;

    // Calculate monthly revenue (assuming monthly billing for simplicity)
    const monthlyRevenue = billings
      .filter(b => b.billingCycle === 'monthly')
      .reduce((sum, b) => sum + b.amount, 0);

    // Projected revenue (next month, same as current for now)
    const projectedRevenue = monthlyRevenue;

    res.json({
      totalRevenue,
      monthlyRevenue,
      avgPerCompany,
      growthRate: 0, // TODO: Calculate from historical data
      projectedRevenue
    });
  } catch (err) {
    console.error('Error fetching billing overview:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// GET /api/admin/billing/companies - Get company billing data
router.get('/billing/companies', requireSuperAdmin, async (req, res) => {
  try {
    const billings = await Billing.find()
      .populate('companyId', 'name domain')
      .sort({ createdAt: -1 });

    const formattedBillings = billings.map(billing => ({
      _id: billing._id,
      companyName: billing.companyId?.name || 'Unknown',
      companyDomain: billing.companyId?.domain || 'N/A',
      plan: billing.plan,
      amount: billing.amount,
      billingCycle: billing.billingCycle,
      status: billing.status,
      nextPaymentDate: billing.nextPaymentDate
    }));

    res.json(formattedBillings);
  } catch (err) {
    console.error('Error fetching company billing:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ================================================================================
// SYSTEM HEALTH ROUTES
// ================================================================================

// GET /api/admin/health/metrics - Get system health metrics
router.get('/health/metrics', requireSuperAdmin, async (req, res) => {
  try {
    const os = require('os');

    // Server metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = (usedMem / totalMem) * 100;

    const cpus = os.cpus();
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;

    // Database stats (simplified)
    const dbStats = await mongoose.connection.db.stats();

    res.json({
      server: {
        cpuUsage: cpuUsage.toFixed(2),
        memoryUsage: memoryUsage.toFixed(2),
        diskUsage: 45.5, // Mock data - would need additional library for real disk usage
        uptime: Math.floor(process.uptime() / 60) // in minutes
      },
      database: {
        connections: mongoose.connection.readyState === 1 ? 1 : 0,
        size: (dbStats.dataSize / 1024 / 1024).toFixed(2), // MB
        collections: dbStats.collections || 0,
        queryPerformance: 15 // Mock - would need query profiling
      },
      api: {
        responseTime: {
          p50: 45,
          p95: 120,
          p99: 250
        },
        errorRate: 0.5,
        requestsPerMinute: 150
      },
      errors: [] // Would pull from error logging system
    });
  } catch (err) {
    console.error('Error fetching system health:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;

// ============================================================================
// COMPANY ADMIN ROUTES (Protected by requireCompanyAdmin)
// ============================================================================

// GET /api/admin/analytics/stats
router.get('/analytics/stats', requireAuth, requireAdmin, adminController.getAnalyticsStats);

// GET /api/admin/departments
router.get('/departments', requireAuth, requireAdmin, adminController.getDepartments);

// Support Tickets (Company Admin View)
router.post('/tickets', requireAuth, requireAdmin, platformController.createTicket);

// Platform Chat (Company Admin View) - Using same controller but standard auth
// Logic in controller needs to handle ownership check if not Super Admin, OR we use middleware here
// For simplicity, exposing the endpoints. Controller should verify access.
router.get('/support/chat/session/:companyId', requireAuth, requireAdmin, platformController.getPlatformSession);
router.get('/support/chat/session/:sessionId/messages', requireAuth, requireAdmin, platformController.getSessionMessages);
router.post('/support/chat/session/:sessionId/messages', requireAuth, requireAdmin, platformController.sendSessionMessage);

