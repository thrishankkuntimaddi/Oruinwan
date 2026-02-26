// src/features/company/company.controller.js

const companyService = require("./company.service");
const Company = require("../../../models/Company");

/**
 * Get company details
 * GET /api/companies/:id
 */
exports.getCompany = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;

        // Use service layer
        const company = await companyService.getCompanyById(companyId);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        // Check access
        const { hasAccess } = await companyService.checkUserAccess(userId, companyId);
        if (!hasAccess) {
            return res.status(403).json({ message: "Access denied" });
        }

        return res.json({ company });

    } catch (err) {
        console.error("GET COMPANY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Update company settings
 * PUT /api/companies/:id
 */
exports.updateCompany = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;
        const updates = req.body;

        // Check if user is admin
        const { isAdmin } = await companyService.checkIsAdmin(userId, companyId);
        if (!isAdmin) {
            return res.status(403).json({ message: "Only admins can update company settings" });
        }

        // Use service layer
        const company = await companyService.updateCompany(companyId, updates);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        return res.json({ company });

    } catch (err) {
        console.error("UPDATE COMPANY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Get company members
 * GET /api/companies/:id/members
 */
exports.getCompanyMembers = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;

        // Check company exists
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        // Check access
        const { hasAccess } = await companyService.checkUserAccess(userId, companyId);
        if (!hasAccess) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Use service layer
        console.log(`[COMPANY] Fetching members for company ${companyId}`);
        const members = await companyService.getCompanyMembers(companyId);
        console.log(`[COMPANY] Found ${members.length} members`);

        return res.json({ members });
    } catch (err) {
        console.error("GET COMPANY MEMBERS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Update user role in company
 * PUT /api/companies/:id/members/:userId/role
 */
exports.updateMemberRole = async (req, res) => {
    try {
        const { id: companyId, userId: targetUserId } = req.params;
        const requesterId = req.user.sub;
        const { role } = req.body;

        // Use service layer
        const result = await companyService.updateMemberRole({
            companyId,
            targetUserId,
            requesterId,
            role,
            req
        });

        return res.json(result);

    } catch (err) {
        console.error("UPDATE MEMBER ROLE ERROR:", err);

        if (err.message.includes('not found') || err.message.includes('Invalid')) {
            return res.status(400).json({ message: err.message });
        }
        if (err.message.includes('Only') || err.message.includes('cannot')) {
            return res.status(403).json({ message: err.message });
        }

        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check if company name is available
 * POST /api/companies/check-name
 */
exports.checkCompanyName = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: "Company name is required" });
        }

        const existingCompany = await Company.findOne({ name: new RegExp(`^${name}$`, 'i') });

        return res.json({
            available: !existingCompany,
            message: existingCompany ? "Company name already taken" : "Company name is available"
        });
    } catch (err) {
        console.error("CHECK COMPANY NAME ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check if company domain is available
 * POST /api/companies/check-domain
 */
exports.checkCompanyDomain = async (req, res) => {
    try {
        const { domain } = req.body;
        if (!domain) {
            return res.status(400).json({ message: "Domain is required" });
        }

        const existingCompany = await Company.findOne({ domain: domain.toLowerCase() });

        return res.json({
            available: !existingCompany,
            message: existingCompany ? "Domain already registered" : "Domain is available"
        });
    } catch (err) {
        console.error("CHECK COMPANY DOMAIN ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check if email exists
 * POST /api/companies/check-email
 */
exports.checkEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const User = require("../../../models/User");
        const existingUser = await User.findOne({ email: email.toLowerCase() });

        return res.json({
            available: !existingUser,
            message: existingUser ? "Email already in use" : "Email is available"
        });
    } catch (err) {
        console.error("CHECK EMAIL ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check if phone exists
 * POST /api/companies/check-phone
 */
exports.checkPhone = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ message: "Phone is required" });
        }

        const User = require("../../../models/User");
        const existingUser = await User.findOne({ phone });
        const existingCompany = await Company.findOne({ ownerPhone: phone });

        return res.json({
            available: !existingUser && !existingCompany,
            message: (existingUser || existingCompany) ? "Phone already registered" : "Phone is available"
        });
    } catch (err) {
        console.error("CHECK PHONE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
