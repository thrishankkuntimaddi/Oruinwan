
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

        const companies = await Company.find({ verificationStatus: 'pending' })
            .populate({
                path: 'admins.user',
                select: 'username email phone phoneCode jobTitle emails'
            })
            .sort({ createdAt: -1 });

        res.json(companies);
    } catch (err) {

        res.status(500).json({ message: "Server Error" });
    }
});

// POST /api/admin/approve-company/:id
router.post('/approve-company/:id', requireSuperAdmin, async (req, res) => {
    try {
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
                const personalEmail = adminUser.emails && adminUser.emails.length > 0
                    ? adminUser.emails[0].email
                    : adminUser.email;

                const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

                await sendEmail({
                    to: personalEmail,
                    subject: `🎉 Welcome to Chttrix - ${company.name} is Verified!`,
                    html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <style>
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
                            .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 10px 10px; }
                            .success-box { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
                            .credentials { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px; border: 1px solid #dee2e6; }
                            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                            h1 { margin: 0; font-size: 28px; }
                            h2 { color: #667eea; margin-top: 0; }
                            code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
                          </style>
                        </head>
                        <body>
                          <div class="container">
                            <div class="header">
                              <h1>🎉 Congratulations!</h1>
                            </div>
                            <div class="content">
                              <h2>Welcome to Chttrix, ${adminUser.username}!</h2>
                              
                              <div class="success-box">
                                <strong>✅ Your company has been verified!</strong><br/>
                                <strong>${company.name}</strong> is now active on the Chttrix platform.
                              </div>

                              <p>Your workspace has been provisioned and is ready to use. You can now access all features of the Chttrix collaboration platform.</p>
                              
                              <div class="credentials">
                                <strong>Login Details:</strong><br/>
                                <strong>Email:</strong> <code>${adminUser.email}</code><br/>
                                <strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a>
                              </div>

                              <p><strong>What's Next?</strong></p>
                              <ul>
                                <li>Log in to your account</li>
                                <li>Explore your workspace and channels</li>
                                <li>Invite team members to join</li>
                                <li>Start collaborating!</li>
                              </ul>

                              <center>
                                <a href="${loginUrl}" class="button">Access Your Workspace →</a>
                              </center>
                              
                              <p>If you have any questions, our support team is here to help.</p>
                              
                              <p>Best regards,<br/>
                              <strong>The Chttrix Team</strong></p>
                            </div>
                            <div class="footer">
                              © ${new Date().getFullYear()} Chttrix. All rights reserved.<br/>
                              Need help? Contact us at support@chttrix.com
                            </div>
                          </div>
                        </body>
                        </html>
                    `
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
        const { reason } = req.body;
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ message: "Company not found" });

        company.verificationStatus = 'rejected';
        company.rejectionReason = reason;
        await company.save();

        // Notify Admin via email to PERSONAL email
        const adminUser = await User.findOne({ companyId: company._id, companyRole: 'owner' });
        if (adminUser) {
            // Send rejection email to personal email (not company email)
            try {
                const personalEmail = adminUser.emails && adminUser.emails.length > 0
                    ? adminUser.emails[0].email
                    : adminUser.email;

                await sendEmail({
                    to: personalEmail,
                    subject: `Company Registration Rejected - ${company.name}`,
                    html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <style>
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
                            .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 10px 10px; }
                            .reason-box { background: #fff3cd; border-left: 4px solid #ff6b6b; padding: 15px; margin: 20px 0; border-radius: 4px; }
                            h1 { margin: 0; font-size: 28px; }
                            h2 { color: #667eea; margin-top: 0; }
                          </style>
                        </head>
                        <body>
                          <div class="container">
                            <div class="header">
                              <h1>⚠️ Registration Update</h1>
                            </div>
                            <div class="content">
                              <h2>Dear ${adminUser.username},</h2>
                              <p>Thank you for your interest in registering <strong>${company.name}</strong> with Chttrix.</p>
                              <p>After careful review of your application, we regret to inform you that we are unable to approve your company registration at this time.</p>
                              
                              <div class="reason-box">
                                <strong>Reason:</strong><br/>
                                ${reason || "Does not meet our current criteria"}
                              </div>

                              <p>If you believe this was an error or would like to provide additional information, please contact our support team.</p>
                              
                              <p>We appreciate your understanding and hope to work with you in the future.</p>
                              
                              <p>Best regards,<br/>
                              <strong>The Chttrix Team</strong></p>
                            </div>
                            <div class="footer">
                              © ${new Date().getFullYear()} Chttrix. All rights reserved.<br/>
                              Need help? Contact us at support@chttrix.com
                            </div>
                          </div>
                        </body>
                        </html>
                    `
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
            details: { reason },
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

