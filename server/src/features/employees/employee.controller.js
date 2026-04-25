const employeeService = require("./employee.service");

exports.inviteEmployee = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;
        const { email, role = "member", workspaceId = null, departmentId = null, managerId = null } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        
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

exports.bulkInviteEmployees = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;
        const { employees } = req.body;

        if (!employees || !Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({ message: "Employees array is required" });
        }

        
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
            companyRole: invite.role || "member",
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
        console.error("ACCEPT INVITE ERROR:", err);
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
        console.error("CHECK ELIGIBILITY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
