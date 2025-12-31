
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const sendEmail = require('../utils/sendEmail');
const adminController = require('../controllers/adminController');
const requireAuth = require('../middleware/auth'); // Fixed: Is default export
const { requireAdmin } = require('../middleware/permissionMiddleware');


// Simple middleware to check for Super Admin
const requireSuperAdmin = async (req, res, next) => {
    try {
        console.log("🔐 [ADMIN AUTH] Checking super admin access...");
        console.log("🔐 [ADMIN AUTH] req.user:", req.user);

        const user = await User.findById(req.user.sub);
        console.log("🔐 [ADMIN AUTH] User found:", user ? user.email : "NULL");
        console.log("🔐 [ADMIN AUTH] User roles:", user ? user.roles : "NULL");

        if (user && user.roles.includes('chttrix_admin')) {
            console.log("✅ [ADMIN AUTH] Super admin access granted");
            next();
        } else {
            console.log("❌ [ADMIN AUTH] Access denied - not a super admin");
            res.status(403).json({ message: "Access denied: Super Admin only" });
        }
    } catch (err) {
        console.error("❌ [ADMIN AUTH] Error:", err);
        res.status(500).json({ message: "Auth Error" });
    }
};

// GET /api/admin/pending-companies
router.get('/pending-companies', requireSuperAdmin, async (req, res) => {
    try {
        console.log("🔍 [ADMIN] Fetching pending companies...");
        const companies = await Company.find({ verificationStatus: 'pending' })
            .populate({
                path: 'admins.user',
                select: 'username email phone phoneCode jobTitle emails'
            })
            .sort({ createdAt: -1 });
        console.log(`✅ [ADMIN] Found ${companies.length} pending companies.`);
        res.json(companies);
    } catch (err) {
        console.error("❌ [ADMIN] Error fetching pending companies:", err);
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

            // Generate Activation Link
            const loginLink = `${process.env.FRONTEND_URL}/login?email=${encodeURIComponent(adminUser.email)}`;

            // LOG ACTIVATION EMAIL TO TERMINAL (DEV MODE)
            console.log("\n" + "=".repeat(80));
            console.log("📧 ACTIVATION EMAIL (Development Mode - No SMTP)");
            console.log("=".repeat(80));
            console.log(`To: ${adminUser.email}`);
            console.log(`Subject: 🎉 Your Company "${company.name}" Has Been Approved!`);
            console.log("-".repeat(80));
            console.log("Email Content:");
            console.log(`\nDear ${adminUser.username},\n`);
            console.log(`Congratulations! Your company registration for "${company.name}" has been`);
            console.log(`approved by our team. You can now login and complete your workspace setup.\n`);
            console.log(`👉 LOGIN HERE: ${loginLink}\n`);
            console.log(`Next Steps:`);
            console.log(`1. Click the login link above`);
            console.log(`2. Complete your company profile setup`);
            console.log(`3. Configure departments and invite your team\n`);
            console.log(`Welcome to Chttrix!`);
            console.log(`- The Chttrix Team`);
            console.log("=".repeat(80) + "\n");

            // In production, replace with: await sendEmail({...})
        }


        res.json({ message: "Company Approved", company });
    } catch (err) {
        console.error(err);
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

        // Notify Admin
        const adminUser = await User.findOne({ companyId: company._id, companyRole: 'owner' });
        if (adminUser) {
            // LOG REJECTION EMAIL TO TERMINAL (DEV MODE)
            console.log("\n" + "=".repeat(80));
            console.log("📧 REJECTION EMAIL (Development Mode - No SMTP)");
            console.log("=".repeat(80));
            console.log(`To: ${adminUser.email}`);
            console.log(`Subject: Registration Update for "${company.name}"`);
            console.log("-".repeat(80));
            console.log("Email Content:");
            console.log(`\nDear ${adminUser.username},\n`);
            console.log(`Thank you for your interest in Chttrix. Unfortunately, we cannot approve`);
            console.log(`your company registration at this time.\n`);
            console.log(`Reason: ${reason || "Not specified"}\n`);
            console.log(`If you believe this is an error or would like to discuss further,`);
            console.log(`please contact our support team.\n`);
            console.log(`Best regards,`);
            console.log(`The Chttrix Team`);
            console.log("=".repeat(80) + "\n");
        }

        res.json({ message: "Company Rejected", company });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
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

