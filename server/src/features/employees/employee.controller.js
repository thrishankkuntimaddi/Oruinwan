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

        
        const { invites } = require("../../identity/queries/auth");
        const { sha256 } = require("../../../utils/hashUtils");
        const identity = require("../../identity");
        const org = require("../../identity/queries/org");
        const bcrypt = require("bcryptjs");

        
        const invite = await invites.findByTokenHash(sha256(token));
        if (!invite) {
            // Links from the Onboard page / People "Invite" / setup wizard carry a token on the
            // invited account itself (onboarding/invite.service). Both kinds of link open
            // /accept-invite, so accept that kind here too.
            const { acceptInvite: acceptAccountInvite } = require("../onboarding/invite.service");
            const { userDocs } = require("../../identity/queries/auth");
            try {
                const out = await acceptAccountInvite(token, password);
                const name = String(username).trim().slice(0, 80);
                if (!out.alreadyActive && name) {
                    const doc = await userDocs.findById(out.user._id || out.user.id);
                    if (doc) { doc.username = name; await doc.save(); }
                }
                return res.json({ message: out.alreadyActive ? "Account already active. Sign in to continue." : "Invitation accepted. Sign in to continue." });
            } catch (err) {
                if (err.status === 400) return res.status(404).json({ message: "Invalid or expired invitation" });
                throw err;
            }
        }
        if (invite.status !== "pending") {
            return res.status(404).json({ message: "Invalid or expired invitation" });
        }

        if (invite.expiresAt && new Date() > invite.expiresAt) {
            await invites.update(invite._id, { status: "expired" });
            return res.status(400).json({ message: "Invitation has expired" });
        }

        
        const existingUser = await identity.users.findByEmail(invite.email.toLowerCase());
        if (existingUser) {
            return res.status(409).json({ message: "User already exists with this email" });
        }

        
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await identity.users.create({
            username,
            email: invite.email.toLowerCase(),
            passwordHash,
            userType: "company",
            companyId: invite.company ? String(invite.company) : null,
            // Ownership is never granted through an invite.
            companyRole: invite.role && invite.role !== "owner" ? invite.role : "member",
            accountStatus: "active",
            verified: true
        });
        if (invite.department) await org.addDepartmentMembers(invite.department, [newUser._id], 'member');

        // Join the company's workspace (the one on the invite, else the company default) and its
        // default channels, so the new person lands somewhere instead of an empty app.
        try {
            let workspaceId = invite.workspace || null;
            if (!workspaceId && invite.company) {
                const company = await org.companies.findOne({ _id: invite.company }, { admins: false });
                workspaceId = company?.defaultWorkspace || null;
            }
            if (workspaceId) {
                const { addUserToWorkspace } = require('../workspaces/addToWorkspace');
                await addUserToWorkspace(workspaceId, newUser._id, { role: invite.role });
            }
        } catch (err) {
            logger.error({ err }, 'ACCEPT INVITE: could not add the new member to the workspace');
        }

        
        await invites.update(invite._id, { status: "accepted", used: true, usedBy: newUser._id, usedAt: new Date() });

        // Company membership is the user's companyId; there is no separate member list.

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

        const org = require("../../identity/queries/org");

        const emailDomain = email.split("@")[1];
        if (!emailDomain) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        
        const company = await org.companies.findOne({
            domain: emailDomain.toLowerCase(),
            domainVerified: true,
            autoJoinByDomain: true
        }, { admins: false });

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
