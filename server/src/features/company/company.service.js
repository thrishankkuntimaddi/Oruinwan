/**
 * Company Service - Business Logic Layer
 * 
 * Handles company CRUD operations, member management, and metrics.
 * Extracted from companyController.js to separate business logic from HTTP handling.
 * 
 * @module features/company/company.service
 */

const Company = require('../../../models/Company');
const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');
const Department = require('../../../models/Department');
const { logAction } = require('../../../utils/historyLogger');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const { uploadToGCS } = require('../../modules/uploads/upload.service');

/**
 * Get company by ID with populated relationships
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Company document
 */
async function getCompanyById(companyId) {
    const company = await Company.findById(companyId)
        .populate('admins.user', 'username email profilePicture')
        .populate('defaultWorkspace', 'name')
        .populate({
            path: 'departments',
            select: 'name head memberCount',
            populate: {
                path: 'head',
                select: 'username email'
            }
        });

    return company;
}

/**
 * Check if user has access to company
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @returns {Promise<{hasAccess: boolean, user: Object}>}
 */
async function checkUserAccess(userId, companyId) {
    const user = await User.findById(userId);

    if (!user) {
        return { hasAccess: false, user: null };
    }

    // User doesn't belong to any company or belongs to this company
    const hasAccess = !user.companyId || user.companyId.toString() === companyId;

    return { hasAccess, user };
}

/**
 * Check if user is admin (owner or admin role)
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @returns {Promise<{isAdmin: boolean, user: Object}>}
 */
async function checkIsAdmin(userId, companyId) {
    const user = await User.findById(userId);

    if (!user) {
        return { isAdmin: false, user: null };
    }

    const isAdmin = user.companyId &&
        user.companyId.toString() === companyId &&
        (user.companyRole === 'owner' || user.companyRole === 'admin');

    return { isAdmin, user };
}

/**
 * Update company with validation
 * @param {string} companyId - Company ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated company document
 */
async function updateCompany(companyId, updates) {
    const company = await Company.findByIdAndUpdate(
        companyId,
        { $set: updates },
        { new: true, runValidators: true }
    )
        .populate('admins.user', 'username email profilePicture')
        .populate('defaultWorkspace', 'name');

    return company;
}

/**
 * Get all members of a company
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} List of company members
 */
async function getCompanyMembers(companyId) {
    const members = await User.find({ companyId })
        .select('username email profilePicture companyRole createdAt lastLoginAt isOnline departments workspaces')
        .populate('departments', 'name')
        .populate('workspaces.workspace', 'name')
        .lean();

    return members;
}

/**
 * Get company metrics (user counts, workspace counts, etc.)
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Metrics object
 */
async function getCompanyMetrics(companyId) {
    // Parallel fetch for speed
    const [totalUsers, activeUsers, totalWorkspaces, totalDepartments] = await Promise.all([
        User.countDocuments({ companyId }),
        User.countDocuments({ companyId, isOnline: true }),
        Workspace.countDocuments({ company: companyId }),
        Department.countDocuments({ company: companyId })
    ]);

    return {
        totalUsers,
        activeUsers,
        totalWorkspaces,
        totalDepartments
    };
}

/**
 * Update user role in company
 * @param {Object} params - Update parameters
 * @param {string} params.companyId - Company ID
 * @param {string} params.targetUserId - User whose role is being changed
 * @param {string} params.requesterId - User requesting the change
 * @param {string} params.newRole - New role to assign
 * @param {Object} params.req - Express request object (for logging)
 * @returns {Promise<Object>} Updated user info
 */
async function updateMemberRole({ companyId, targetUserId, requesterId, newRole, req }) {
    const validRoles = ['owner', 'admin', 'manager', 'member', 'guest'];

    if (!validRoles.includes(newRole)) {
        throw new Error('Invalid role');
    }

    // Get company
    const company = await Company.findById(companyId);
    if (!company) {
        throw new Error('Company not found');
    }

    // Check if requester is admin
    if (!company.isAdmin(requesterId)) {
        throw new Error('Only company admins can change roles');
    }

    // Get requester and target user
    const requester = await User.findById(requesterId);
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
        throw new Error('User not found');
    }

    if (targetUser.companyId.toString() !== companyId) {
        throw new Error('User does not belong to this company');
    }

    // Prevent non-owners from assigning owner role
    if (newRole === 'owner' && requester.companyRole !== 'owner') {
        throw new Error('Only owners can assign owner role');
    }

    // Store old role for logging
    const oldRole = targetUser.companyRole;

    // Update role
    targetUser.companyRole = newRole;
    await targetUser.save();

    // Update company admins array if needed
    if (newRole === 'owner' || newRole === 'admin') {
        const existingAdmin = company.admins.find(
            a => a.user.toString() === targetUserId
        );
        if (!existingAdmin) {
            company.admins.push({ user: targetUserId, role: newRole });
            await company.save();
        }
    } else {
        // Remove from admins if downgraded
        company.admins = company.admins.filter(
            a => a.user.toString() !== targetUserId
        );
        await company.save();
    }

    // Log role change
    await logAction({
        userId: requesterId,
        action: 'user_role_changed',
        description: `Changed ${targetUser.username}'s role to ${newRole}`,
        resourceType: 'user',
        resourceId: targetUserId,
        companyId,
        metadata: { oldRole, newRole },
        req
    });

    return {
        id: targetUser._id,
        username: targetUser.username,
        email: targetUser.email,
        companyRole: targetUser.companyRole
    };
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    getCompanyById,
    checkUserAccess,
    checkIsAdmin,
    updateCompany,
    getCompanyMembers,
    getCompanyMetrics,
    updateMemberRole,
    processSetupStep,
    bulkInviteEmployees
};

// ============================================================================
// NEW: Setup wizard service functions
// ============================================================================

/**
 * Process a single setup wizard step
 */
async function processSetupStep({ companyId, userId, step, data, files }) {
    const company = await Company.findById(companyId);
    if (!company) throw new Error('Company not found');

    switch (step) {
        case 1: {
            // Identity: company display name, timezone, and optional logo
            const updates = {};
            if (data.displayName) updates.displayName = data.displayName;
            if (data.timezone) updates['settings.timezone'] = data.timezone;

            // Logo upload via GCS if file provided
            if (files.logo && files.logo[0]) {
                const logoFile = files.logo[0];
                const gcsResult = await uploadToGCS(logoFile, `company-logos/${companyId}`);
                updates['settings.logo'] = gcsResult.url;
                updates.logo = gcsResult.url;
            }

            updates.setupStep = 2;
            await Company.findByIdAndUpdate(companyId, { $set: updates });
            return { message: 'Step 1 saved', nextStep: 2 };
        }

        case 2: {
            // Structure: create/replace departments
            const deptNames = data.departments || [];

            // Remove old departments
            await Department.deleteMany({ company: companyId });

            // Create new departments and link to company
            const createdDepts = await Promise.all(
                deptNames.map(name =>
                    Department.create({ name, company: companyId })
                )
            );

            await Company.findByIdAndUpdate(companyId, {
                $set: {
                    departments: createdDepts.map(d => d._id),
                    setupStep: 3
                }
            });

            return { message: 'Departments saved', departments: createdDepts, nextStep: 3 };
        }

        case 3: {
            // People: parse Excel file or use JSON invites array
            let employees = [];

            if (files.employeeFile && files.employeeFile[0]) {
                // Parse Excel/CSV
                const wb = XLSX.read(files.employeeFile[0].buffer, { type: 'buffer' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // Skip header row, map columns
                const dataRows = rows.slice(1).filter(r => r[1]); // require email
                employees = dataRows.map(r => ({
                    name: String(r[0] || '').trim(),
                    email: String(r[1] || '').trim().toLowerCase(),
                    phone: String(r[2] || '').trim(),
                    role: String(r[3] || 'member').trim().toLowerCase(),
                    department: String(r[4] || '').trim()
                }));
            } else if (data.invites && Array.isArray(data.invites)) {
                employees = data.invites.filter(i => i.email);
            }

            let results = { created: 0, skipped: 0, errors: [] };
            if (employees.length > 0) {
                results = await bulkInviteEmployees(companyId, company.domain, employees);
            }

            await Company.findByIdAndUpdate(companyId, { $set: { setupStep: 4 } });
            return { message: 'Invites processed', results, nextStep: 4 };
        }

        case 4: {
            // Launch: mark setup complete
            await Company.findByIdAndUpdate(companyId, {
                $set: { isSetupComplete: true, setupStep: 4 }
            });
            // Update owner user's company status
            await User.findByIdAndUpdate(userId, {
                $set: { 'companyStatus': 'active' }
            });
            return {
                message: 'Setup complete! Workspace launched.',
                redirectTo: '/admin/analytics',
                nextStep: null
            };
        }

        default:
            throw new Error('Invalid setup step');
    }
}

/**
 * Create user accounts from employee list and send welcome emails
 */
async function bulkInviteEmployees(companyId, companyDomain, employees) {
    const results = { created: 0, skipped: 0, errors: [] };

    const company = await Company.findById(companyId).populate('departments', 'name _id');

    // Build dept name→id map
    const deptMap = {};
    (company.departments || []).forEach(d => {
        deptMap[d.name.toLowerCase()] = d._id;
    });

    for (const emp of employees) {
        try {
            // Skip if email already registered
            const existingUser = await User.findOne({ email: emp.email });
            if (existingUser) {
                results.skipped++;
                continue;
            }

            // Generate random 10-char password
            const tempPassword = generateTempPassword();
            const hashedPw = await bcrypt.hash(tempPassword, 10);

            // Resolve department
            const deptId = deptMap[emp.department?.toLowerCase()] || null;

            // Determine role
            const validRoles = ['owner', 'admin', 'manager', 'member', 'guest'];
            const companyRole = validRoles.includes(emp.role) ? emp.role : 'member';

            // Create username from name
            const baseUsername = (emp.name || emp.email.split('@')[0])
                .toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
            const username = `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`;

            // Create the user
            const newUser = await User.create({
                username,
                email: emp.email,
                phone: emp.phone || undefined,
                passwordHash: hashedPw,         // ← correct field name
                userType: 'company',             // ← company employee
                companyId,
                companyRole,
                departments: deptId ? [deptId] : [],
                verified: true,                  // ← pre-verified (they were invited)
                accountStatus: 'active',
            });

            // Send welcome email
            await sendWelcomeEmail({
                to: emp.email,
                name: emp.name || username,
                companyName: company.name,
                tempPassword
            });

            results.created++;
        } catch (err) {
            results.errors.push({ email: emp.email, error: err.message });
        }
    }

    return results;
}

function generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    let pw = '';
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
}

async function sendWelcomeEmail({ to, name, companyName, tempPassword }) {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.SMTP_USER || process.env.EMAIL_USER,
                pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: `"${companyName} via Chttrix" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
            to,
            subject: `You're invited to join ${companyName} on Chttrix`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8fafc;">
                    <div style="background: white; border-radius: 16px; padding: 40px; border: 1px solid #e2e8f0;">
                        <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 8px;">Welcome to ${companyName}! 🎉</h1>
                        <p style="color: #64748b; margin-bottom: 24px;">Hi ${name}, your account has been set up on Chttrix.</p>

                        <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                            <p style="margin: 0 0 8px; font-size: 13px; color: #64748b; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase;">Your Login Details</p>
                            <p style="margin: 4px 0; color: #1e293b;"><strong>Email:</strong> ${to}</p>
                            <p style="margin: 4px 0; color: #1e293b;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-size: 16px; font-weight: bold; letter-spacing: 0.1em;">${tempPassword}</code></p>
                        </div>

                        <p style="color: #64748b; font-size: 14px;">⚠️ Please change your password immediately after your first login.</p>

                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
                           style="display: inline-block; margin-top: 20px; background: #4f46e5; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                            Login to Chttrix →
                        </a>

                        <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">This invitation was sent by ${companyName}. If you believe this was a mistake, please ignore this email.</p>
                    </div>
                </div>
            `
        });
    } catch (err) {
        console.error('[WELCOME EMAIL] Failed to send to', to, ':', err.message);
        // Don't throw — account creation should still succeed even if email fails
    }
}
