const logger = require('../../../utils/logger');
const employeeService = require("./employee.service");

const { assignRoleError, assertCompanyDepartments } = require('../../shared/roleCeiling');

/** The company in the URL must be the caller's own (set by requireCompanyMember). */
function ownCompanyOr403(req, res) {
    if (String(req.params.id) !== String(req.companyId)) {
        res.status(403).json({ message: 'Access denied: that company is not yours' });
        return false;
    }
    return true;
}

exports.inviteEmployee = async (req, res) => {
    try {
        if (!ownCompanyOr403(req, res)) return;
        const companyId = req.companyId;
        const userId = req.user.sub;
        const { email, role = "member", departmentId = null, departmentIds, jobTitle, firstName, lastName } = req.body;

        if (!email || typeof email !== 'string') {
            return res.status(400).json({ message: "Email is required" });
        }

        const roleError = assignRoleError({ companyRole: req.companyRole }, role);
        if (roleError) {
            return res.status(roleError.includes('Invalid') ? 400 : 403).json({ message: roleError });
        }

        const depts = await assertCompanyDepartments(companyId, departmentIds || (departmentId ? [departmentId] : []));

        const result = await employeeService.inviteEmployee({
            companyId,
            email,
            role,
            firstName,
            lastName,
            jobTitle,
            departmentIds: depts,
            invitedBy: userId,
            req
        });

        return res.json({
            message: "Invitation sent successfully",
            inviteId: result.inviteId,
            emailSent: result.emailSent
        });

    } catch (err) {
        if (err.status && err.status < 500) {
            return res.status(err.status).json({ message: err.message });
        }
        logger.error("INVITE EMPLOYEE ERROR:", err);
        if (err.message.includes('not found')) {
            return res.status(404).json({ message: err.message });
        }
        return res.status(500).json({ message: "Server error" });
    }
};

// Bulk invite and direct account creation were never implemented in the
// service. Bulk onboarding lives at /api/company/onboarding; invites at /:id/invite.
exports.bulkInviteEmployees = async (req, res) => {
    if (!ownCompanyOr403(req, res)) return;
    return res.status(501).json({ message: 'Bulk invite is not available here. Use Onboard → bulk upload (/api/company/onboarding).' });
};

exports.directCreateEmployee = async (req, res) => {
    if (!ownCompanyOr403(req, res)) return;
    return res.status(501).json({ message: 'Direct account creation is not available. Invite the employee instead.' });
};

exports.acceptInvite = async (req, res) => {
    try {
        const { token, username, password } = req.body;

        if (!token) {
            return res.status(400).json({ message: "Invitation token is required" });
        }

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required" });
        }

        
        const Invite = require("../../../models/Invite");
        const User = require("../../../models/User");
        const Company = require("../../../models/Company");
        const bcrypt = require("bcryptjs");

        
        const invite = await Invite.findOne({ token, status: "pending" });
        if (!invite) {
            return res.status(404).json({ message: "Invalid or expired invitation" });
        }

        
        if (invite.expiresAt && new Date() > invite.expiresAt) {
            invite.status = "expired";
            await invite.save();
            return res.status(400).json({ message: "Invitation has expired" });
        }

        
        const existingUser = await User.findOne({ email: invite.email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists with this email" });
        }

        
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            email: invite.email.toLowerCase(),
            passwordHash,
            userType: "company",
            companyId: invite.company,
            // Ownership is never granted through an invite.
            companyRole: invite.role && invite.role !== "owner" ? invite.role : "member",
            departments: invite.department ? [invite.department] : [],
            accountStatus: "active",
            verified: true
        });

        await newUser.save();

        
        invite.status = "accepted";
        invite.acceptedAt = new Date();
        await invite.save();

        
        const company = await Company.findById(invite.company);
        if (company && !company.members.includes(newUser._id)) {
            company.members.push(newUser._id);
            await company.save();
        }

        return res.json({
            message: "Account created successfully",
            userId: newUser._id,
            redirectTo: "/login"
        });

    } catch (err) {
        logger.error("ACCEPT INVITE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.checkEligibility = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const Company = require("../../../models/Company");

        
        const emailDomain = email.split("@")[1];
        if (!emailDomain) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        
        const company = await Company.findOne({
            domain: emailDomain.toLowerCase(),
            domainVerified: true,
            autoJoinByDomain: true
        });

        if (company) {
            return res.json({
                eligible: true,
                companyId: company._id,
                companyName: company.name,
                message: `You are eligible to auto-join ${company.name}`
            });
        }

        return res.json({
            eligible: false,
            message: "No auto-join company found for this email domain"
        });

    } catch (err) {
        logger.error("CHECK ELIGIBILITY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
