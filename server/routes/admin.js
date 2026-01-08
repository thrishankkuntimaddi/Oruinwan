
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

    // Database stats
    const dbStats = await mongoose.connection.db.stats();

    // Get real database entity counts
    const [
      totalUsers,
      activeUsers,
      totalCompanies,
      verifiedCompanies,
      pendingCompanies,
      totalDepartments,
      totalWorkspaces,
      totalChannels,
      totalMessages,
      totalTasks,
      totalNotes
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ accountStatus: 'active' }),
      Company.countDocuments(),
      Company.countDocuments({ verificationStatus: 'verified' }),
      Company.countDocuments({ verificationStatus: 'pending' }),
      Department.countDocuments(),
      Workspace.countDocuments(),
      Channel.countDocuments(),
      Message.countDocuments(),
      Task.countDocuments(),
      Note.countDocuments()
    ]);

    res.json({
      server: {
        cpuUsage: parseFloat(cpuUsage.toFixed(2)),
        memoryUsage: parseFloat(memoryUsage.toFixed(2)),
        diskUsage: 0, // Placeholder - requires additional library for real disk usage
        uptime: Math.floor(process.uptime() / 60) // in minutes
      },
      database: {
        connections: mongoose.connection.readyState === 1 ? 1 : 0,
        size: parseFloat((dbStats.dataSize / 1024 / 1024).toFixed(2)), // MB
        collections: dbStats.collections || 0,
        queryPerformance: 0 // Placeholder - would need query profiling setup
      },
      api: {
        responseTime: {
          p50: 0,
          p95: 0,
          p99: 0
        },
        errorRate: 0,
        requestsPerMinute: 0
      },
      entities: {
        users: {
          total: totalUsers,
          active: activeUsers
        },
        companies: {
          total: totalCompanies,
          verified: verifiedCompanies,
          pending: pendingCompanies
        },
        departments: totalDepartments,
        workspaces: totalWorkspaces,
        channels: totalChannels,
        messages: totalMessages,
        tasks: totalTasks,
        notes: totalNotes
      },
      errors: [] // Would pull from error logging system
    });
  } catch (err) {
    console.error('Error fetching system health:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

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

// ============================================================================
// PEOPLE MANAGEMENT ROUTES
// ============================================================================

// GET /api/admin/employees - Get all employees in company
router.get('/employees', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.user.sub || req.user._id;
    const user = await User.findById(userId).populate('companyId');

    if (!user || !user.companyId) {
      return res.status(403).json({ message: 'User not part of a company' });
    }

    const employees = await User.find({ companyId: user.companyId._id })
      .populate('departments')
      .populate('managedDepartments')
      .select('-passwordHash -refreshTokens')
      .sort({ createdAt: -1 });

    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/employees/:id/suspend - Suspend employee
router.put('/employees/:id/suspend', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const adminId = req.user.sub || req.user._id;

    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Prevent suspending owners
    if (employee.companyRole === 'owner') {
      return res.status(403).json({ message: 'Cannot suspend company owner' });
    }

    employee.accountStatus = 'suspended';
    employee.suspendedAt = new Date();
    employee.suspendedBy = adminId;
    employee.suspensionReason = reason || 'No reason provided';

    await employee.save();

    res.json({ message: 'Employee suspended successfully', employee });
  } catch (error) {
    console.error('Error suspending employee:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/employees/:id/activate - Activate suspended employee
router.put('/employees/:id/activate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.accountStatus = 'active';
    employee.suspendedAt = null;
    employee.suspendedBy = null;
    employee.suspensionReason = null;

    await employee.save();

    res.json({ message: 'Employee activated successfully', employee });
  } catch (error) {
    console.error('Error activating employee:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/admin/employees/:id - Remove employee (soft delete)
router.delete('/employees/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Prevent removing owners
    if (employee.companyRole === 'owner') {
      return res.status(403).json({ message: 'Cannot remove company owner' });
    }

    employee.accountStatus = 'removed';
    employee.deactivatedAt = new Date();

    await employee.save();

    res.json({ message: 'Employee removed successfully' });
  } catch (error) {
    console.error('Error removing employee:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/employees/:id/assign-department - Assign to department
router.put('/employees/:id/assign-department', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { departmentIds } = req.body;

    if (!Array.isArray(departmentIds)) {
      return res.status(400).json({ message: 'Department IDs must be an array' });
    }

    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.departments = departmentIds;
    await employee.save();

    res.json({ message: 'Department assignment updated', employee });
  } catch (error) {
    console.error('Error assigning department:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/employees/:id/change-role - Change employee role
router.put('/employees/:id/change-role', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role, managedDepartments } = req.body;

    if (!['member', 'guest', 'manager', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Prevent changing owner role
    if (employee.companyRole === 'owner') {
      return res.status(403).json({ message: 'Cannot change owner role' });
    }

    employee.companyRole = role;

    // If promoting to manager, set managed departments
    if (role === 'manager' && managedDepartments) {
      employee.managedDepartments = managedDepartments;
    } else if (role !== 'manager') {
      employee.managedDepartments = [];
    }

    await employee.save();

    res.json({ message: 'Employee role updated', employee });
  } catch (error) {
    console.error('Error changing role:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/departments/:id/workspaces - Get workspaces in a department
router.get('/departments/:id/workspaces', requireAuth, requireAdmin, async (req, res) => {
  try {
    const Department = require('../models/Department');
    const Workspace = require('../models/Workspace');

    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const workspaces = await Workspace.find({ departmentId: req.params.id })
      .populate('members', 'username email')
      .select('name description members createdAt');

    res.json(workspaces);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/employees/:id/assign-workspace - Assign employee to workspaces
router.post('/employees/:id/assign-workspace', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { workspaceIds } = req.body;

    if (!Array.isArray(workspaceIds)) {
      return res.status(400).json({ message: 'Workspace IDs must be an array' });
    }

    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.assignedWorkspaces = workspaceIds;
    await employee.save();

    res.json({ message: 'Workspace assignment updated', employee });
  } catch (error) {
    console.error('Error assigning workspace:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
