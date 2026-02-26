/**
 * Employee Service - Employee Management & Onboarding
 * 
 * Handles employee invitations, bulk imports, direct creation, and invite acceptance.
 * Extracted from companyController.js for better organization and reusability.
 * 
 * @module features/employees/employee.service
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../../../models/User');
const Company = require('../../../models/Company');
const Workspace = require('../../../models/Workspace');
const Channel = require("../channels/channel.model.js");
const Invite = require('../../../models/Invite');
const sendEmail = require('../../../utils/sendEmail');
const { sha256 } = require('../../../utils/hashUtils');
const { logAction } = require('../../../utils/historyLogger');

/**
 * Create and send invitation
 * @param {Object} params - Invitation parameters
 * @returns {Promise<Object>} Created invite with link
 */
async function createInvitation({ companyId, email, role, workspaceId, departmentId, managerId, invitedBy }) {
    const company = await Company.findById(companyId);
    if (!company) {
        throw new Error('Company not found');
    }

    // Create invite token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(rawToken);

    const invite = new Invite({
        email: email.toLowerCase(),
        tokenHash,
        company: companyId,
        workspace: workspaceId,
        role,
        invitedBy,
        department: departmentId,
        metadata: { managerId },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    await invite.save();

    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${rawToken}&email=${encodeURIComponent(email)}`;

    return { invite, inviteLink, rawToken, company };
}

/**
 * Send invitation email
 * @param {string} email - Recipient email
 * @param {string} companyName - Company name
 * @param {string} inviteLink - Invitation link
 * @param {string} userName - Optional user name
 */
async function sendInvitationEmail(email, companyName, inviteLink, userName = '') {
    try {
        await sendEmail({
            to: email,
            subject: `You're invited to join ${companyName} on Chttrix`,
            html: `
        <h2>${userName ? `Welcome ${userName}!` : "You've been invited!"}</h2>
        <p>You've been invited to join ${companyName} on Chttrix.</p>
        <p><a href="${inviteLink}">Accept Invitation</a></p>
        <p>This invitation expires in 7 days.</p>
      `
        });
    } catch (err) {
        console.warn('Failed to send invite email:', err.message);
        // Don't throw - invitation created successfully
    }
}

/**
 * Invite single user to company
 * @param {Object} params - Invitation parameters
 * @returns {Promise<Object>} Invitation result
 */
async function inviteEmployee(params) {
    const { companyId, email, role, workspaceId, departmentId, managerId, userId, req } = params;

    const company = await Company.findById(companyId);
    if (!company) {
        throw new Error('Company not found');
    }

    // Check if user is admin
    if (!company.isAdmin(userId)) {
        throw new Error('Only company admins can invite employees');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser && existingUser.companyId) {
        throw new Error('User already belongs to a company');
    }

    // Create invitation
    const { invite, inviteLink, company: companyData } = await createInvitation({
        companyId,
        email,
        role,
        workspaceId,
        departmentId,
        managerId,
        invitedBy: userId
    });

    // Send email
    await sendInvitationEmail(email, companyData.name, inviteLink);

    // Log action
    await logAction({
        userId,
        action: 'user_invited',
        description: `Invited ${email} to company`,
        resourceType: 'invite',
        resourceId: invite._id,
        companyId,
        metadata: { email, role },
        req
    });

    return { inviteId: invite._id, inviteLink };
}

/**
 * Bulk invite employees
 * @param {Object} params - Bulk invitation parameters
 * @returns {Promise<Object>} Results with success/failed arrays
 */
async function bulkInviteEmployees({ companyId, employees, userId }) {
    const company = await Company.findById(companyId);
    if (!company) {
        throw new Error('Company not found');
    }

    if (!company.isAdmin(userId)) {
        throw new Error('Only company admins can invite employees');
    }

    const results = {
        success: [],
        failed: []
    };

    for (const emp of employees) {
        try {
            const { name, email, role = 'member' } = emp;

            if (!email || !name) {
                results.failed.push({ email, error: 'Missing name or email' });
                continue;
            }

            // Check if user exists
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser && existingUser.companyId) {
                results.failed.push({ email, error: 'User already has a company' });
                continue;
            }

            // Create invite
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = sha256(rawToken);

            const invite = new Invite({
                email: email.toLowerCase(),
                tokenHash,
                company: companyId,
                workspace: company.defaultWorkspace,
                role,
                invitedBy: userId,
                expiresAt: new Date(Date.now() + 7 * 86400000)
            });

            await invite.save();

            const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${rawToken}&email=${encodeURIComponent(email)}`;

            // Send email (don't fail on email error)
            await sendInvitationEmail(email, company.name, inviteLink, name);

            results.success.push({ name, email, inviteId: invite._id });

        } catch (err) {
            results.failed.push({ email: emp.email, error: err.message });
        }
    }

    return results;
}

/**
 * Admin creates employee directly (no email confirmation)
 * @param {Object} params - Employee creation parameters
 * @returns {Promise<Object>} Created user info
 */
async function directCreateEmployee(params) {
    const { companyId, username, email, password, role = 'member', department, jobTitle, userId, req } = params;

    const company = await Company.findById(companyId);
    if (!company) {
        throw new Error('Company not found');
    }

    // Only admins can directly create employees
    if (!company.isAdmin(userId)) {
        throw new Error('Only company admins can create employees directly');
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        throw new Error('Email already in use');
    }

    // Create user account
    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = new User({
        username,
        email: email.toLowerCase(),
        passwordHash,
        userType: 'company',
        companyId: company._id,
        companyRole: role,
        verified: true, // Auto-verified since created by admin
        jobTitle,
        departments: department ? [department] : []
    });

    await newUser.save();

    // Add to default workspace
    if (company.defaultWorkspace) {
        const workspace = await Workspace.findById(company.defaultWorkspace);

        if (workspace && !workspace.isMember(newUser._id)) {
            workspace.members.push({
                user: newUser._id,
                role: 'member'
            });
            await workspace.save();

            newUser.workspaces.push({
                workspace: workspace._id,
                role: 'member'
            });

            // Add to default channels
            const defaultChannels = await Channel.find({
                workspace: workspace._id,
                isDefault: true
            });

            for (const channel of defaultChannels) {
                if (!channel.members.some(m => (m.user ? m.user.toString() : m.toString()) === newUser._id.toString())) {
                    // Convert all existing members to new format before adding
                    channel.members = channel.members.map(m => {
                        if (m.user) return m;
                        return {
                            user: m,
                            joinedAt: channel.createdAt || new Date()
                        };
                    });

                    channel.members.push({
                        user: newUser._id,
                        joinedAt: new Date()
                    });
                    await channel.save();
                }
            }

            await newUser.save();
        }
    }

    // Log action
    await logAction({
        userId,
        action: 'employee_created_direct',
        description: `Admin directly created employee: ${username}`,
        resourceType: 'user',
        resourceId: newUser._id,
        companyId: company._id,
        metadata: { email, role },
        req
    });

    return {
        user: {
            id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            companyRole: newUser.companyRole,
            verified: newUser.verified
        },
        temporaryPassword: password
    };
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    createInvitation,
    sendInvitationEmail,
    inviteEmployee,
    bulkInviteEmployees,
    directCreateEmployee
};
