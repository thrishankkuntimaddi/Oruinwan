// src/features/employees/employee.controller.js

const employeeService = require("./employee.service");

/**
 * Invite single user to company
 * POST /api/companies/:id/invite
 */
exports.inviteEmployee = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;
        const { email, role = "member", workspaceId = null, departmentId = null, managerId = null } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Use service layer
        const result = await employeeService.inviteEmployee({
            companyId,
            email,
            role,
            workspaceId,
            departmentId,
            managerId,
            userId,
            req
        });

        return res.json({
            message: "Invitation sent successfully",
            inviteId: result.inviteId,
            inviteLink: result.inviteLink
        });

    } catch (err) {
        console.error("INVITE EMPLOYEE ERROR:", err);

        if (err.message.includes('not found')) {
            return res.status(404).json({ message: err.message });
        }
        if (err.message.includes('Only') || err.message.includes('already')) {
            return res.status(403).json({ message: err.message });
        }

        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Bulk invite employees
 * POST /api/companies/:id/invite/bulk
 */
exports.bulkInviteEmployees = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;
        const { employees } = req.body;

        if (!employees || !Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({ message: "Employees array is required" });
        }

        // Use service layer
        const result = await employeeService.bulkInviteEmployees({
            companyId,
            employees,
            userId,
            req
        });

        return res.json({
            message: `Successfully invited ${result.successful} out of ${employees.length} employees`,
            successful: result.successful,
            failed: result.failed,
            results: result.results
        });

    } catch (err) {
        console.error("BULK INVITE ERROR:", err);

        if (err.message.includes('not found')) {
            return res.status(404).json({ message: err.message });
        }
        if (err.message.includes('Only')) {
            return res.status(403).json({ message: err.message });
        }

        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Admin directly creates employee (Method 4 - No email invite)
 * POST /api/companies/:id/employees/create
 */
exports.directCreateEmployee = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;
        const { username, email, password, role = "member", department, jobTitle } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                message: "Username, email, and password are required"
            });
        }

        // Use service layer
        const result = await employeeService.directCreateEmployee({
            companyId,
            username,
            email,
            password,
            role,
            department,
            jobTitle,
            userId,
            req
        });

        return res.json({
            message: "Employee created successfully",
            employee: result.employee
        });

    } catch (err) {
        console.error("DIRECT CREATE EMPLOYEE ERROR:", err);

        if (err.message.includes('not found')) {
            return res.status(404).json({ message: err.message });
        }
        if (err.message.includes('already') || err.message.includes('exists')) {
            return res.status(409).json({ message: err.message });
        }
        if (err.message.includes('Only')) {
            return res.status(403).json({ message: err.message });
        }

        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Accept company invitation
 * POST /api/companies/accept-invite
 */
exports.acceptInvite = async (req, res) => {
    try {
        const { token, username, password } = req.body;

        if (!token) {
            return res.status(400).json({ message: "Invitation token is required" });
        }

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required" });
        }

        // Use service layer (assuming this exists in employee service)
        const Invite = require("../../../models/Invite");
        const User = require("../../../models/User");
        const Company = require("../../../models/Company");
        const bcrypt = require("bcryptjs");

        // Find invite
        const invite = await Invite.findOne({ token, status: "pending" });
        if (!invite) {
            return res.status(404).json({ message: "Invalid or expired invitation" });
        }

        // Check expiration
        if (invite.expiresAt && new Date() > invite.expiresAt) {
            invite.status = "expired";
            await invite.save();
            return res.status(400).json({ message: "Invitation has expired" });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: invite.email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists with this email" });
        }

        // Create user
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            email: invite.email.toLowerCase(),
            passwordHash,
            userType: "company",
            companyId: invite.company,
            companyRole: invite.role || "member",
            departments: invite.department ? [invite.department] : [],
            accountStatus: "active",
            verified: true
        });

        await newUser.save();

        // Update invite
        invite.status = "accepted";
        invite.acceptedAt = new Date();
        await invite.save();

        // Add user to company members (if needed)
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
        console.error("ACCEPT INVITE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check if email can auto-join a company
 * POST /api/companies/check-eligibility
 */
exports.checkEligibility = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const Company = require("../../../models/Company");

        // Extract domain from email
        const emailDomain = email.split("@")[1];
        if (!emailDomain) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        // Find company with matching domain and auto-join enabled
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
        console.error("CHECK ELIGIBILITY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
