const logger = require('../../../utils/logger');
const { replicaRead } = require('../../shared/db');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const identity = require('../../identity');
const org = require('../../identity/queries/org');
const { userDocs } = require('../../identity/queries/auth');
const { hydrate } = require('../../identity/hydrate');
const supportTickets = require('../support/supportTickets.service');
const Broadcast = require('../../../models/Broadcast');
// Billing accounts live in PostgreSQL (migration 0007_billing_analytics).
const { billing: billingRepo } = require('../billing/billing.repository');
const sendEmail = require('../../../utils/sendEmail');

const AuditLog = require('../../../models/AuditLog');
const Channel = require("../channels/channel.model.js");
const Message = require("../../modules/messages/message.model.js");
const Tasks = require('../tasks/tasks.query');
const Note = require('../../../models/Note');
const requireAuth = require('../../shared/middleware/auth');
const { requireAdmin } = require('../../shared/middleware/permissionMiddleware');
const { toSafeUser } = require('../../shared/utils/safeUser');
const { manageUserError, assignRoleError, syncCompanyAdmins } = require('../../shared/roleCeiling');

// Company of the authenticated admin (requireAdmin may replace req.user with the full doc).
function callerCompanyId(req) {
  const c = req.user && req.user.companyId;
  if (!c) return null;
  return String(c._id || c);
}

// Load an employee only if they belong to the caller's company; 404 otherwise.
async function findCompanyEmployee(req) {
  const companyId = callerCompanyId(req);
  if (!companyId || !mongoose.Types.ObjectId.isValid(req.params.id)) return null;
  // A user document (save() writes back to PostgreSQL) scoped to the caller's company.
  const row = await org.users.findOne({ _id: req.params.id, companyId });
  return row ? userDocs.findById(row._id) : null;
}

const requireSuperAdmin = async (req, res, next) => {
  try {
    const user = await identity.users.findById(req.user.sub);

    if (user && user.roles.includes('chttrix_admin')) {
      next();
    } else {
      res.status(403).json({ message: "Access denied: Super Admin only" });
    }
  } catch (err) {
    res.status(500).json({ message: "Auth Error" });
  }
};

router.get('/overview/stats', requireSuperAdmin, async (req, res) => {
  try {
    const totalCompanies = await org.companies.count({ verificationStatus: 'verified' });
    const pendingRequests = await org.companies.count({ verificationStatus: 'pending' });

    
    const activeUsers = await org.users.count({
      accountStatus: 'active',
      companyId: { $ne: null }
    });

    
    const openTickets = await supportTickets.countOpenTickets();

    
    const billings = await billingRepo.list({ status: 'active' });
    const monthlyRevenue = billings
      .filter(b => b.billingCycle === 'monthly')
      .reduce((sum, b) => sum + b.amount, 0);

    
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const companiesLastMonth = await org.companies.count({
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
    logger.error('Error fetching overview stats:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Platform-wide audit trail for the Oruinwan admin console. Newest first.
router.get('/audit-logs', requireSuperAdmin, async (req, res) => {
  try {
    const AuditLog = require('../../../models/AuditLog');
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 1000);
    const filter = {};
    if (req.query.companyId && mongoose.Types.ObjectId.isValid(req.query.companyId)) filter.companyId = req.query.companyId;
    if (req.query.action) filter.action = String(req.query.action);
    if (req.query.severity) filter.severity = String(req.query.severity);
    const logs = await replicaRead(AuditLog.find(filter))
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    await hydrate(logs, { userId: { type: 'user', fields: ['username', 'email'] }, companyId: { type: 'company', fields: ['name'] } });
    return res.json(logs);
  } catch (err) {
    logger.error('[Admin] audit-logs failed:', err);
    return res.status(500).json({ message: 'Failed to load audit logs' });
  }
});

router.get('/overview/activities', requireSuperAdmin, async (req, res) => {
  try {
    const activities = await replicaRead(AuditLog.find())
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const formattedActivities = activities.map(log => ({
      type: log.action,
      description: log.description,
      timestamp: log.createdAt
    }));

    res.json(formattedActivities);
  } catch (err) {
    logger.error('Error fetching activities:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/pending-companies', requireSuperAdmin, async (req, res) => {
  try {
    const companies = (await org.companies.find({ verificationStatus: 'pending' }, { sort: { createdAt: -1 } }))
      .map((c) => org.publicCompany(c));
    await hydrate(companies, { 'admins.user': { type: 'user', fields: ['username', 'profile', 'email', 'personalEmail', 'phone', 'phoneCode', 'jobTitle'] } });

    res.json(companies);
  } catch (err) {
    logger.error("❌ Error fetching pending companies:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post('/approve-company/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    const company = await org.companies.findOne({ _id: req.params.id });
    if (!company) return res.status(404).json({ message: "Company not found" });

    await org.updateCompany(company._id, { verificationStatus: 'verified' });
    company.verificationStatus = 'verified';

    let emailSent = false;
    let provisioned = false;
    const adminUser = await org.users.findOne({ companyId: company._id, companyRole: 'owner' });
    if (adminUser) {
      // First approval: create the departments / default workspace the company
      // asked for (skipped when it already has a default workspace).
      if (!company.defaultWorkspace) {
        try {
          const { provisionCompanyResources } = require('../company-registration/registration.service');
          await provisionCompanyResources({ company, adminUser });
          provisioned = true;
        } catch (provisionError) {
          logger.error('Company provisioning after approval failed:', provisionError.message);
        }
      }
      await org.updateUser(adminUser._id, { accountStatus: 'active' });

      // Email is best effort: the decision is already saved.
      try {
        const personalEmail = adminUser.personalEmail || adminUser.email;
        const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
        const { companyApprovedTemplate } = require('../../../utils/emailTemplates');
        const template = companyApprovedTemplate(adminUser.username, company.name, loginUrl, message);
        await sendEmail({ to: personalEmail, subject: template.subject, html: template.html, text: template.text });
        emailSent = true;
      } catch (emailError) {
        logger.error('Failed to send approval email:', emailError.message);
      }
    }

    
    const auditUser = await identity.users.findById(req.user.sub);
    await AuditLog.create({
      companyId: company._id,
      userId: req.user.sub,
      action: 'company.approved',
      resource: 'Company',
      resourceId: company._id,
      description: `Company ${company.name} approved by ${auditUser ? auditUser.username : 'Admin'}`
    });

    res.json({ message: "Company Approved", company: org.publicCompany(company), emailSent, provisioned });
  } catch (err) {
    logger.error('Approve company error:', err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post('/reject-company/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { message, reason } = req.body;
    const finalReason = message || reason; 

    const company = await org.companies.findOne({ _id: req.params.id });
    if (!company) return res.status(404).json({ message: "Company not found" });

    await org.updateCompany(company._id, { verificationStatus: 'rejected', rejectionReason: finalReason });
    company.verificationStatus = 'rejected';
    company.rejectionReason = finalReason;

    let emailSent = false;
    const adminUser = await org.users.findOne({ companyId: company._id, companyRole: 'owner' });
    if (adminUser) {
      // Email is best effort: the decision is already saved.
      try {
        
        const personalEmail = adminUser.personalEmail || adminUser.email;

        const { companyRejectedTemplate } = require('../../../utils/emailTemplates');
        const template = companyRejectedTemplate(adminUser.username, company.name, finalReason, message);

        await sendEmail({
          to: personalEmail,
          subject: template.subject,
          html: template.html,
          text: template.text
        });
        emailSent = true;
      } catch (emailError) {
        logger.error('Failed to send rejection email:', emailError.message);
      }
    }

    
    const auditUser = await identity.users.findById(req.user.sub);
    await AuditLog.create({
      companyId: company._id,
      userId: req.user.sub,
      action: 'company.rejected',
      resource: 'Company',
      resourceId: company._id,
      details: { reason: finalReason },
      description: `Company ${company.name} rejected by ${auditUser ? auditUser.username : 'Admin'}`
    });

    res.json({ message: "Company Rejected", company: org.publicCompany(company), emailSent });
  } catch (err) {
    logger.error('Reject company error:', err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.get('/active-companies', requireSuperAdmin, async (req, res) => {
  try {
    const companies = (await org.companies.find({ verificationStatus: 'verified' }, { sort: { createdAt: -1 } }))
      .map((c) => org.publicCompany(c));
    await hydrate(companies, { 'admins.user': { type: 'user', fields: ['username', 'profile', 'email', 'personalEmail', 'jobTitle'] } });
    // Users and workspaces per company in two grouped queries.
    const counts = await org.companyCounts(companies.map((c) => c._id));
    for (const c of companies) Object.assign(c, { stats: counts.get(String(c._id)) || { users: 0, activeUsers: 0, workspaces: 0 } });

    res.json(companies);
  } catch (err) {
    logger.error('❌ Error fetching active companies:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Tickets live in SupportTicket/SupportMessage, the same records company users write
// through /api/platform/support (the old Ticket model was never written to).
router.get('/tickets', requireSuperAdmin, async (req, res) => {
  try {
    const { status, priority, companyId } = req.query;
    res.json(await supportTickets.listTickets({ status, priority, companyId }));
  } catch (err) {
    logger.error('Error fetching tickets:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/tickets/:id', requireSuperAdmin, async (req, res) => {
  try {
    const ticket = await supportTickets.getTicket(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (err) {
    logger.error('Error fetching ticket:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.put('/tickets/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { status, message } = req.body;
    const ticket = await supportTickets.adminUpdate(req.params.id, {
      status,
      message,
      adminId: req.user.sub,
      io: req.app.get('io'),
    });
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (status) {
      await AuditLog.create({
        userId: req.user.sub,
        action: 'ticket_status_updated',
        resource: 'SupportTicket',
        resourceId: ticket._id,
        description: `Ticket ${ticket._id} status updated to ${status}`
      });
    }
    if (typeof message === 'string' && message.trim()) {
      await AuditLog.create({
        userId: req.user.sub,
        action: 'ticket_reply_added',
        resource: 'SupportTicket',
        resourceId: ticket._id,
        description: `Reply added to ticket ${ticket._id}`
      });
    }

    res.json(ticket);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ message: err.message });
    logger.error('Error updating ticket:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.post('/broadcast/send', requireSuperAdmin, async (req, res) => {
  try {
    const { subject, targetType, targetCompanies } = req.body;
    const body = String(req.body.body ?? req.body.message ?? '').trim();
    if (!subject || !String(subject).trim() || !body) {
      return res.status(400).json({ message: 'Subject and message are required' });
    }

    
    let companies = [];
    switch (targetType) {
      case 'all':
        companies = await org.companies.find({ verificationStatus: 'verified' }, { admins: false });
        break;
      case 'active':
        companies = await org.companies.find({ verificationStatus: 'verified' }, { admins: false });
        break;
      case 'pending':
        companies = await org.companies.find({ verificationStatus: 'pending' }, { admins: false });
        break;
      case 'specific':
        if (!Array.isArray(targetCompanies) || !targetCompanies.length || !targetCompanies.every((id) => mongoose.Types.ObjectId.isValid(String(id)))) {
          return res.status(400).json({ message: 'Choose at least one company' });
        }
        companies = await org.companies.find({ _id: { $in: targetCompanies.map(String) } }, { admins: false });
        break;
      default:
        return res.status(400).json({ message: 'Invalid target type' });
    }

    
    // Recorded for the platform history; there is no company-wide in-app
    // channel to deliver it through yet, so counts say who it targets.
    const recipientUsers = await org.users.count({ companyId: { $in: companies.map(c => c._id) }, accountStatus: 'active' });
    const broadcast = await Broadcast.create({
      subject: String(subject).trim(),
      body,
      targetType,
      targetCompanies: companies.map(c => c._id),
      recipientCount: companies.length,
      sentBy: req.user.sub,
      status: 'sent'
    });

    
    
    

    
    await AuditLog.create({
      userId: req.user.sub,
      action: 'broadcast_sent',
      resource: 'Broadcast',
      resourceId: broadcast._id,
      description: `Broadcast sent to ${companies.length} companies: "${subject}"`
    });

    res.json({
      success: true,
      message: `Broadcast recorded for ${companies.length} companies (${recipientUsers} active users)`,
      broadcast,
      recipients: { companies: companies.length, users: recipientUsers },
      delivered: false
    });
  } catch (err) {
    logger.error('Error sending broadcast:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/broadcast/history', requireSuperAdmin, async (req, res) => {
  try {
    const broadcasts = await Broadcast.find()
      .sort({ sentAt: -1 })
      .limit(50)
      .lean();
    await hydrate(broadcasts, { sentBy: { type: 'user', fields: ['username'] } });

    res.json(broadcasts);
  } catch (err) {
    logger.error('Error fetching broadcast history:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

const SupportMessage = require('../../../models/SupportMessage');
const SupportTicket = require('../../../models/SupportTicket');

router.get('/dm-users', requireSuperAdmin, async (req, res) => {
  try {
    
    const users = await org.users.find({
      companyId: { $ne: null },
      companyRole: { $in: ['owner', 'admin'] }
    }, { select: 'username email profilePicture companyRole companyId isOnline' });
    await hydrate(users, { companyId: { type: 'company', fields: ['name'] } });

    
    const enriched = await Promise.all(users.map(async (user) => {
      
      const ticket = await SupportTicket.findOne({
        creatorId: user._id,
        subject: 'Live Chat Support'
      }).sort({ createdAt: -1 }).select('_id').lean();

      let lastMessage = null;
      let unreadCount = 0;

      if (ticket) {
        lastMessage = await SupportMessage.findOne({ ticket: ticket._id, deletedAt: null })
          .sort({ createdAt: -1 })
          .select('content createdAt senderRole')
          .lean();

        unreadCount = await SupportMessage.countDocuments({
          ticket: ticket._id,
          senderRole: 'company',
          deletedAt: null,
          readBy: { $size: 0 }
        });
      }

      return {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        companyRole: user.companyRole,
        companyName: user.companyId?.name || 'Unknown Company',
        isOnline: user.isOnline || false,
        lastMessage: lastMessage ? { content: lastMessage.content, createdAt: lastMessage.createdAt } : null,
        unreadCount
      };
    }));

    
    enriched.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
    });

    res.json(enriched);
  } catch (err) {
    logger.error('Error fetching DM users:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/dm/user/:userId', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    
    const ticket = await SupportTicket.findOne({
      creatorId: userId,
      subject: 'Live Chat Support'
    }).sort({ createdAt: -1 }).lean();

    if (!ticket) {
      return res.json([]);
    }

    const messages = await SupportMessage.find({
      ticket: ticket._id,
      deletedAt: null
    })
      .sort({ createdAt: 1 })
      .lean();
    await hydrate(messages, { sender: { type: 'user', fields: ['username', 'email', 'profilePicture', 'roles', 'companyRole'] } });

    res.json(messages);
  } catch (err) {
    logger.error('Error fetching DM messages for user:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.post('/dm/user/:userId', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    
    const targetUser = await identity.users.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    
    let ticket = await SupportTicket.findOne({
      creatorId: userId,
      subject: 'Live Chat Support',
      status: { $in: ['open', 'in-progress'] }
    }).sort({ createdAt: -1 });

    if (!ticket) {
      ticket = await SupportTicket.create({
        companyId: targetUser.companyId,
        creatorId: userId,
        subject: 'Live Chat Support',
        description: 'Ongoing support conversation',
        status: 'open',
        priority: 'medium'
      });
    }

    const created = await SupportMessage.create({
      ticket: ticket._id,
      company: targetUser.companyId,
      sender: req.user.sub,
      senderRole: 'platform',
      content: message.trim()
    });
    const newMessage = created.toObject();
    await hydrate(newMessage, { sender: { type: 'user', fields: ['username', 'email', 'profilePicture', 'roles'] } });

    
    await AuditLog.create({
      userId: req.user.sub,
      action: 'admin_message_sent',
      resource: 'User',
      resourceId: userId,
      description: `Platform admin sent support message to user`
    });

    
    if (req.app.get('io')) {
      req.app.get('io').to(`user-support:${userId}`).emit('platform-message', newMessage);
    }

    res.json(newMessage);
  } catch (err) {
    logger.error('Error sending DM to user:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/billing/overview', requireSuperAdmin, async (req, res) => {
  try {
    const billings = await billingRepo.list({ status: 'active' });

    const totalRevenue = billings.reduce((sum, b) => sum + b.amount, 0);
    const avgPerCompany = billings.length > 0 ? totalRevenue / billings.length : 0;

    
    const monthlyRevenue = billings
      .filter(b => b.billingCycle === 'monthly')
      .reduce((sum, b) => sum + b.amount, 0);

    
    const projectedRevenue = monthlyRevenue;

    res.json({
      totalRevenue,
      monthlyRevenue,
      avgPerCompany,
      growthRate: 0, 
      projectedRevenue
    });
  } catch (err) {
    logger.error('Error fetching billing overview:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/billing/companies', requireSuperAdmin, async (req, res) => {
  try {
    const billings = await billingRepo.list(); // newest first
    const accountIds = billings.map(b => b.companyId); // one account per company: its id is the company id
    await hydrate(billings, { companyId: { type: 'company', fields: ['name', 'domain'] } });

    const formattedBillings = billings.map((billing, i) => ({
      _id: accountIds[i],
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
    logger.error('Error fetching company billing:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/health/metrics', requireSuperAdmin, async (req, res) => {
  try {
    const os = require('os');

    
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

    
    const dbStats = await mongoose.connection.db.stats();

    
    // Identity counts in one PostgreSQL query; content counts from MongoDB.
    const [
      platform,
      totalChannels,
      totalMessages,
      totalTasks,
      totalNotes
    ] = await Promise.all([
      org.platformStats(),
      Channel.countDocuments(),
      Message.countDocuments(),
      Tasks.countDocuments(),
      Note.countDocuments()
    ]);

    res.json({
      server: {
        cpuUsage: parseFloat(cpuUsage.toFixed(2)),
        memoryUsage: parseFloat(memoryUsage.toFixed(2)),
        diskUsage: 0, 
        uptime: Math.floor(process.uptime() / 60) 
      },
      database: {
        connections: mongoose.connection.readyState === 1 ? 1 : 0,
        size: parseFloat((dbStats.dataSize / 1024 / 1024).toFixed(2)), 
        collections: dbStats.collections || 0,
        queryPerformance: 0 
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
          total: platform.users,
          active: platform.activeUsers
        },
        companies: {
          total: platform.companies,
          verified: platform.verifiedCompanies,
          pending: platform.pendingCompanies
        },
        departments: platform.departments,
        workspaces: platform.workspaces,
        channels: totalChannels,
        messages: totalMessages,
        tasks: totalTasks,
        notes: totalNotes
      },
      errors: [] 
    });
  } catch (err) {
    logger.error('Error fetching system health:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/employees', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.user.sub || req.user._id;
    const user = await identity.users.findById(userId);

    if (!user || !user.companyId) {
      return res.status(403).json({ message: 'User not part of a company' });
    }

    const employees = await org.users.find({
        companyId: user.companyId,
        accountStatus: { $ne: 'removed' },
    }, { org: true, sort: { createdAt: -1 } });
    await hydrate(employees, { departments: { type: 'department', fields: null }, managedDepartments: { type: 'department', fields: null } });

    res.json(employees.map(toSafeUser));
  } catch (error) {
    logger.error('Error fetching employees:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/employees/:id/suspend', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const adminId = req.user.sub || req.user._id;

    const employee = await findCompanyEmployee(req);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const ceiling = manageUserError(req.user, employee);
    if (ceiling) {
      return res.status(403).json({ message: ceiling });
    }

    employee.accountStatus = 'suspended';
    employee.suspendedAt = new Date();
    employee.suspendedBy = adminId;
    employee.suspensionReason = reason || 'No reason provided';

    await employee.save();
    require('../security/security.service').logSecurityEvent({
      companyId: employee.companyId, actorId: adminId, eventType: 'account_suspended',
      metadata: { targetId: String(employee._id), reason: employee.suspensionReason }, req,
    });

    res.json({ message: 'Employee suspended successfully', employee: toSafeUser(employee) });
  } catch (error) {
    logger.error('Error suspending employee:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/employees/:id/activate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const employee = await findCompanyEmployee(req);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    const ceiling = manageUserError(req.user, employee);
    if (ceiling) {
      return res.status(403).json({ message: ceiling });
    }

    employee.accountStatus = 'active';
    employee.suspendedAt = null;
    employee.suspendedBy = null;
    employee.suspensionReason = null;

    await employee.save();

    res.json({ message: 'Employee activated successfully', employee: toSafeUser(employee) });
  } catch (error) {
    logger.error('Error activating employee:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/employees/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const employee = await findCompanyEmployee(req);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const ceiling = manageUserError(req.user, employee);
    if (ceiling) {
      return res.status(403).json({ message: ceiling });
    }

    // Department, team and workspace memberships, sessions and keys go with the
    // row (ON DELETE CASCADE in 0006_identity).
    await identity.users.remove(employee._id);

    res.json({ message: 'Employee permanently removed from company' });
  } catch (error) {
    logger.error('Error removing employee:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/employees/:id/assign-department', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { departmentIds } = req.body;

    if (!Array.isArray(departmentIds)) {
      return res.status(400).json({ message: 'Department IDs must be an array' });
    }

    const employee = await findCompanyEmployee(req);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const validDeptCount = await org.departments.count({ _id: { $in: departmentIds }, company: callerCompanyId(req) });
    if (validDeptCount !== new Set(departmentIds.map(String)).size) {
      return res.status(400).json({ message: 'One or more departments do not belong to your company' });
    }

    await org.setUserDepartments(employee._id, callerCompanyId(req), departmentIds);
    employee.departments = departmentIds.map(String);

    res.json({ message: 'Department assignment updated', employee: toSafeUser(employee) });
  } catch (error) {
    logger.error('Error assigning department:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/employees/:id/change-role', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role, managedDepartments } = req.body;

    const roleError = assignRoleError(req.user, role);
    if (roleError) {
      return res.status(roleError.startsWith('Invalid') ? 400 : 403).json({ message: roleError });
    }

    const employee = await findCompanyEmployee(req);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const ceiling = manageUserError(req.user, employee);
    if (ceiling) {
      return res.status(403).json({ message: ceiling });
    }

    employee.companyRole = role;

    
    if (role === 'manager' && Array.isArray(managedDepartments) && managedDepartments.length) {
      const validManaged = await org.departments.count({ _id: { $in: managedDepartments }, company: callerCompanyId(req) });
      if (validManaged !== new Set(managedDepartments.map(String)).size) {
        return res.status(400).json({ message: 'One or more departments do not belong to your company' });
      }
    }

    await employee.save();
    // Managed departments are the 'manager' rows in department_members.
    if (role === 'manager' && managedDepartments) {
      await org.setUserManagedDepartments(employee._id, managedDepartments, { companyId: callerCompanyId(req) });
      employee.managedDepartments = managedDepartments.map(String);
    } else if (role !== 'manager') {
      await org.setUserManagedDepartments(employee._id, [], { companyId: callerCompanyId(req) });
      employee.managedDepartments = [];
    }
    await syncCompanyAdmins(employee.companyId, employee._id, role);
    require('../security/security.service').logSecurityEvent({
      companyId: employee.companyId, actorId: req.user._id || req.user.sub, eventType: 'role_changed',
      metadata: { targetId: String(employee._id), newRole: role }, req,
    });

    res.json({ message: 'Employee role updated', employee: toSafeUser(employee) });
  } catch (error) {
    logger.error('Error changing role:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/departments/:id/workspaces', requireAuth, requireAdmin, async (req, res) => {
  try {
    const department = await org.departments.findOne({ _id: req.params.id, company: callerCompanyId(req) }, { members: false });
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Workspace.department is the field; also include ones listed on the department.
    const workspaces = (await org.workspaces.find({
      company: callerCompanyId(req),
      $or: [{ department: department._id }, { _id: { $in: department.workspaces || [] } }],
    }, { select: 'name description members createdAt' }))
      .map((w) => ({ ...w, members: (w.members || []).filter((m) => m.status === 'active') }));
    await hydrate(workspaces, { 'members.user': { type: 'user', fields: ['username', 'email'] } });

    res.json(workspaces);
  } catch (error) {
    logger.error('Error fetching workspaces:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/employees/:id/assign-workspace', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { workspaceIds } = req.body;

    if (!Array.isArray(workspaceIds)) {
      return res.status(400).json({ message: 'Workspace IDs must be an array' });
    }

    const employee = await findCompanyEmployee(req);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    
    
    
    const validWsCount = await org.workspaces.count({ _id: { $in: workspaceIds }, company: callerCompanyId(req) });
    if (validWsCount !== new Set(workspaceIds.map(String)).size) {
      return res.status(400).json({ message: 'One or more workspaces do not belong to your company' });
    }

    // The list replaces the employee's workspaces: join the new ones, leave the rest.
    const wanted = new Set(workspaceIds.map(String));
    const existingIds = employee.workspaces.map(w => String(w.workspace));
    for (const id of wanted) if (!existingIds.includes(id)) await identity.workspaces.addMember(id, employee._id, { role: 'member' });
    for (const id of existingIds) if (!wanted.has(id)) await identity.workspaces.removeMember(id, employee._id, { by: req.user.sub || req.user._id });
    employee.workspaces = [
      ...employee.workspaces.filter(w => wanted.has(String(w.workspace))),
      ...[...wanted].filter((id) => !existingIds.includes(id)).map((id) => ({ workspace: id, role: 'member', joinedAt: new Date() })),
    ];

    res.json({ message: 'Workspace assignment updated', employee: toSafeUser(employee) });
  } catch (error) {
    logger.error('Error assigning workspace:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
