// server/controllers/onboardEmployeeController.js
const User = require('../../../models/User');
const _Company = require('../../../models/_Company');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sendEmail = require('../../../utils/sendEmail');
const { employeeCredentialsTemplate } = require('../../../utils/emailTemplates');

/**
 * Generate a secure random password
 */
const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const values = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        password += charset[values[i] % charset.length];
    }
    return password;
};

/**
 * Generate company email from name
 */
const _generateCompanyEmail = (firstName, lastName, companyDomain) => {
    const cleanFirst = firstName.toLowerCase().trim().replace(/[^a-z]/g, '');
    const cleanLast = lastName.toLowerCase().trim().replace(/[^a-z]/g, '');
    return `${cleanFirst}.${cleanLast}@${companyDomain}`;
};

/**
 * POST /api/admin/onboard-employee
 * Admin-only: Create employee account directly
 */
exports.createEmployee = async (req, res) => {
    try {


        const adminId = req.user?.sub || req.user?._id; // Try both for compatibility
        const {
            firstName,
            lastName,
            personalEmail,
            companyEmail, // Admin-provided company email
            phone,
            role, // "member", "guest", "manager"
            departments = [], // Array of department IDs
            workspaces = [], // Array of workspace IDs (optional)
            jobTitle,
            joiningDate,
            employeeCategory
        } = req.body;

        console.log('📝 Onboard employee request:', {
            adminId,
            adminIdSource: req.user?.sub ? 'sub' : req.user?._id ? '_id' : 'none',
            firstName,
            lastName,
            personalEmail,
            role,
            departmentCount: departments.length
        });

        // Validation
        if (!firstName || !lastName || !personalEmail || !companyEmail || !role) {
            console.error('❌ Missing required fields');
            return res.status(400).json({ message: 'First name, last name, personal email, company email, and role are required' });
        }

        if (!['member', 'guest', 'manager'].includes(role)) {
            console.error('❌ Invalid role:', role);
            return res.status(400).json({ message: 'Invalid role. Must be member, guest, or manager' });
        }

        // Get admin's company
        const admin = await User.findById(adminId).populate('companyId');

        console.log('🔍 Admin lookup:', {
            adminId,
            hasAdmin: !!admin,
            hasCompany: !!admin?.companyId,
            companyId: admin?.companyId?._id
        });

        if (!admin || !admin.companyId) {
            console.error('❌ Admin has no company:', { adminId, hasAdmin: !!admin });
            return res.status(403).json({ message: 'You must be part of a company to onboard employees' });
        }

        // Check if admin has permission
        if (!['owner', 'admin'].includes(admin.companyRole)) {
            console.error('❌ Insufficient permissions:', { role: admin.companyRole });
            return res.status(403).json({ message: 'Only company admins can onboard employees' });
        }

        const company = admin.companyId;

        console.log('✅ Company found:', {
            companyId: company._id,
            name: company.name,
            domain: company.domain
        });

        // Check if company has a verified domain
        if (!company.domain) {
            console.error('❌ Company has no domain:', { companyId: company._id });
            return res.status(400).json({ message: 'Company must have a domain configured to onboard employees' });
        }

        // Validate company email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(companyEmail)) {
            return res.status(400).json({ message: 'Invalid company email format' });
        }

        // Check if company email already exists
        const existingUser = await User.findOne({ email: companyEmail.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({
                message: 'This company email is already in use. Please use a different email.',
                providedEmail: companyEmail
            });
        }

        // Generate temporary password
        const temporaryPassword = generatePassword();
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);

        // Create employee user
        const employee = new User({
            username: `${firstName} ${lastName}`,
            email: companyEmail.toLowerCase().trim(),
            personalEmail: personalEmail.toLowerCase().trim(),
            companyEmail: companyEmail.toLowerCase().trim(),
            phone: phone || null,
            passwordHash,
            userType: 'company',
            companyId: company._id,
            companyRole: role,
            jobTitle: jobTitle || null,
            joiningDate: joiningDate || new Date(),
            employeeCategory: employeeCategory || 'Full-time',
            departments: departments,
            managedDepartments: role === 'manager' ? departments : [],
            assignedWorkspaces: workspaces, // Workspaces admin assigned
            verified: true, // Admin-created users are pre-verified
            accountStatus: 'active',
            lastLoginAt: null // Used to detect first login
        });

        await employee.save();

        // Send credentials email to personal email
        const loginUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const emailTemplate = employeeCredentialsTemplate(
            `${firstName} ${lastName}`,
            company.name,
            companyEmail,
            temporaryPassword,
            loginUrl
        );

        try {
            await sendEmail({
                to: personalEmail,
                subject: emailTemplate.subject,
                html: emailTemplate.html,
                text: emailTemplate.text
            });
        } catch (_emailError) {
            console.error('Failed to send credentials email:', emailError);
            // Don't fail the request if email fails, but notify admin
            return res.status(201).json({
                message: 'Employee created successfully, but email delivery failed. Please share credentials manually.',
                employee: {
                    _id: employee._id,
                    username: employee.username,
                    email: employee.email,
                    role: employee.companyRole,
                    jobTitle: employee.jobTitle
                },
                credentials: {
                    email: companyEmail,
                    temporaryPassword // Only return if email fails
                },
                emailError: 'Failed to send credentials email'
            });
        }

        // Success - credentials sent via email
        res.status(201).json({
            message: 'Employee created successfully! Credentials sent to their personal email.',
            employee: {
                _id: employee._id,
                username: employee.username,
                email: employee.email,
                personalEmail: employee.personalEmail,
                role: employee.companyRole,
                jobTitle: employee.jobTitle,
                departments: employee.departments
            }
        });

    } catch (_error) {
        console.error('Error creating employee:', error);
        res.status(500).json({ message: 'Failed to create employee', error: error.message });
    }
};
