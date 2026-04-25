const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../../../models/User');
const Company = require('../../../models/Company');
const Ticket = require('../../../models/Ticket');
const Broadcast = require('../../../models/Broadcast');
const Billing = require('../../../models/Billing');
const sendEmail = require('../../../utils/sendEmail');

const AuditLog = require('../../../models/AuditLog');
const Department = require('../../../models/Department');
const Workspace = require('../../../models/Workspace');
const Channel = require("../channels/channel.model.js");
const Message = require("../messages/message.model.js");
const Task = require('../../../models/Task');
const Note = require('../../../models/Note');
const requireAuth = require('../../shared/middleware/auth');
const { requireAdmin } = require('../../shared/middleware/permissionMiddleware');

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

router.get('/overview/stats', requireSuperAdmin, async (req, res) => {
  try {
    const totalCompanies = await Company.countDocuments({ verificationStatus: 'verified' });
    const pendingRequests = await Company.countDocuments({ verificationStatus: 'pending' });

    
    const activeUsers = await User.countDocuments({
      accountStatus: 'active',
      companyId: { $exists: true }
    });

    
    const openTickets = await Ticket.countDocuments({
      status: { $in: ['open', 'in-progress'] }
    });

    
    const billings = await Billing.find({ status: 'active' });
    const monthlyRevenue = billings
      .filter(b => b.billingCycle === 'monthly')
      .reduce((sum, b) => sum + b.amount, 0);

    
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

router.get('/pending-companies', requireSuperAdmin, async (req, res) => {
  try {
    const companies = await Company.find({ verificationStatus: 'pending' })
      .populate({
        path: 'admins.user',
        select: 'username name email personalEmail phone phoneCode jobTitle role emails'
      })
      .sort({ createdAt: -1 });

    res.json(companies);
  } catch (err) {
    console.error("❌ Error fetching pending companies:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post('/approve-company/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: "Company not found" });

    company.verificationStatus = 'verified';
    await company.save();

    
    const adminUser = await User.findOne({ companyId: company._id, companyRole: 'owner' });
    if (adminUser) {
      adminUser.accountStatus = 'active';
      await adminUser.save();

      
      try {
        
        const personalEmail = adminUser.personalEmail || adminUser.email;

        const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
        const { companyApprovedTemplate } = require('../../../utils/emailTemplates');
        const template = companyApprovedTemplate(adminUser.username, company.name, loginUrl, message);

        await sendEmail({
          to: personalEmail,
          subject: template.subject,
          html: template.html,
          text: template.text
        });
        console.log(`📧 Approval email sent to personal email: ${personalEmail}`);
      } catch (_emailError) {
        console.error('Failed to send approval email:', emailError.message);
        
      }
    }

    
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

router.post('/reject-company/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { message, reason } = req.body;
    const finalReason = message || reason; 

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: "Company not found" });

    company.verificationStatus = 'rejected';
    company.rejectionReason = finalReason;
    await company.save();

    
    const adminUser = await User.findOne({ companyId: company._id, companyRole: 'owner' });
    if (adminUser) {
      
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
      } catch (_emailError) {
        console.error('Failed to send rejection email:', emailError.message);
        
      }
    }

    
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

router.get('/active-companies', requireSuperAdmin, async (req, res) => {
  try {
    const companies = await Company.find({ verificationStatus: 'verified' })
      .populate({
        path: 'admins.user',
        select: 'username name email personalEmail jobTitle'
      })
      .sort({ createdAt: -1 })
      .lean();

    res.json(companies);
  } catch (err) {
    console.error('❌ Error fetching active companies:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

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

router.put('/tickets/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { status, message } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    
    if (status) {
      ticket.status = status;

      
      await AuditLog.create({
        userId: req.user.sub,
        action: 'ticket_status_updated',
        resource: 'Ticket',
        resourceId: ticket._id,
        description: `Ticket ${ticket._id} status updated to ${status}`
      });
    }

    
    if (message) {
      ticket.messages.push({
        sender: req.user.sub,
        message,
        createdAt: new Date()
      });

      
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

router.post('/broadcast/send', requireSuperAdmin, async (req, res) => {
  try {
    const { subject, message, targetType, targetCompanies } = req.body;

    
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

    
    const broadcast = await Broadcast.create({
      subject,
      message,
      targetType,
      targetCompanies: targetType === 'specific' ? targetCompanies : companies.map(c => c._id),
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
      message: `Broadcast sent to ${companies.length} companies`,
      broadcast
    });
  } catch (err) {
    console.error('Error sending broadcast:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

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

const SupportMessage = require('../../../models/SupportMessage');
const SupportTicket = require('../../../models/SupportTicket');
const UserModel = require('../../../models/User');

router.get('/dm-users', requireSuperAdmin, async (req, res) => {
  try {
    
    const users = await UserModel.find({
      companyId: { $exists: true, $ne: null },
      companyRole: { $in: ['owner', 'admin'] }
    })
      .select('username email profilePicture companyRole companyId isOnline')
      .populate('companyId', 'name')
      .lean();

    
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
    console.error('Error fetching DM users:', err);
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
      .populate('sender', 'username email profilePicture roles companyRole')
      .sort({ createdAt: 1 })
      .lean();

    res.json(messages);
  } catch (err) {
    console.error('Error fetching DM messages for user:', err);
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

    
    const targetUser = await UserModel.findById(userId).select('companyId').lean();
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

    const newMessage = await SupportMessage.create({
      ticket: ticket._id,
      company: targetUser.companyId,
      sender: req.user.sub,
      senderRole: 'platform',
      content: message.trim()
    });

    await newMessage.populate('sender', 'username email profilePicture roles');

    
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
    console.error('Error sending DM to user:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/billing/overview', requireSuperAdmin, async (req, res) => {
  try {
    const billings = await Billing.find({ status: 'active' });

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
    console.error('Error fetching billing overview:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

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
      errors: [] 
    });
  } catch (err) {
    console.error('Error fetching system health:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/employees', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.user.sub || req.user._id;
    const user = await User.findById(userId).populate('companyId');

    if (!user || !user.companyId) {
      return res.status(403).json({ message: 'User not part of a company' });
    }

    const employees = await User.find({
        companyId: user.companyId._id,
        accountStatus: { $ne: 'removed' }, 
    })
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

router.put('/employees/:id/suspend', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const adminId = req.user.sub || req.user._id;

    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    
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

router.delete('/employees/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    
    if (employee.companyRole === 'owner') {
      return res.status(403).json({ message: 'Cannot remove company owner' });
    }

    const employeeId = employee._id;
    const Department = require('../../../models/Department');
    const Workspace = require('../../../models/Workspace');

    
    
    await Promise.all([
      Department.updateMany({ members: employeeId }, { $pull: { members: employeeId } }),
      Department.updateMany({ managers: employeeId }, { $pull: { managers: employeeId } }),
      Workspace.updateMany(
        { 'members.user': employeeId },
        { $pull: { members: { user: employeeId } } }
      ),
    ]);

    
    await User.findByIdAndDelete(employeeId);

    res.json({ message: 'Employee permanently removed from company' });
  } catch (error) {
    console.error('Error removing employee:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

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

    
    if (employee.companyRole === 'owner') {
      return res.status(403).json({ message: 'Cannot change owner role' });
    }

    employee.companyRole = role;

    
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

router.get('/departments/:id/workspaces', requireAuth, requireAdmin, async (req, res) => {
  try {
    const Department = require('../../../models/Department');
    const Workspace = require('../../../models/Workspace');

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

    
    
    
    const existingIds = employee.workspaces.map(w => w.workspace.toString());
    const newEntries = workspaceIds
      .filter(id => !existingIds.includes(id.toString()))
      .map(id => ({ workspace: id, role: 'member', joinedAt: new Date() }));
    employee.workspaces = [
      ...employee.workspaces.filter(w => workspaceIds.map(String).includes(w.workspace.toString())),
      ...newEntries
    ];
    await employee.save();

    res.json({ message: 'Workspace assignment updated', employee });
  } catch (error) {
    console.error('Error assigning workspace:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
