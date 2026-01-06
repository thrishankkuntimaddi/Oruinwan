
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const sendEmail = require('../utils/sendEmail');
const adminController = require('../controllers/adminController');
const platformController = require('../controllers/platformController');
const AuditLog = require('../models/AuditLog');
const requireAuth = require('../middleware/auth'); // Fixed: Is default export
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

