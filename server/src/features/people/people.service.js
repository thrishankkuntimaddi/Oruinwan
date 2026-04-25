const User = require('../../../models/User');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const VALID_ROLES = ['owner', 'admin', 'manager', 'member', 'guest'];
const VALID_STATUSES = ['active', 'suspended', 'removed'];

function generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    let pw = '';
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
}

async function sendInviteEmail({ to, name, companyName, tempPassword }) {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.SMTP_USER || process.env.EMAIL_USER,
                pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
            },
        });

        const loginUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        await transporter.sendMail({
            from: `"${companyName} via Chttrix" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
            to,
            subject: `You've been invited to join ${companyName} on Chttrix`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8fafc;">
                    <div style="background: white; border-radius: 16px; padding: 40px; border: 1px solid #e2e8f0;">
                        <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 8px;">Welcome to ${companyName}! 🎉</h1>
                        <p style="color: #64748b; margin-bottom: 24px;">Hi ${name}, you've been invited to collaborate on Chttrix.</p>

                        <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                            <p style="margin: 0 0 8px; font-size: 13px; color: #64748b; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase;">Your Login Details</p>
                            <p style="margin: 4px 0; color: #1e293b;"><strong>Email:</strong> ${to}</p>
                            <p style="margin: 4px 0; color: #1e293b;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-size: 16px; font-weight: bold; letter-spacing: 0.1em;">${tempPassword}</code></p>
                        </div>

                        <p style="color: #64748b; font-size: 14px;">⚠️ Please change your password immediately after your first login.</p>

                        <a href="${loginUrl}/login"
                           style="display: inline-block; margin-top: 20px; background: #4f46e5; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                            Accept Invitation →
                        </a>

                        <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">If you believe this was a mistake, please ignore this email.</p>
                    </div>
                </div>
            `,
        });
    } catch (err) {
        console.error('[PEOPLE SERVICE] Invite email failed for', to, ':', err.message);
        
    }
}

async function inviteEmployee({ companyId, email, firstName, lastName, companyRole, jobTitle, departments, invitedById }) {
    
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
        const err = new Error(`A user with email "${email}" already exists.`);
        err.status = 409;
        throw err;
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const name = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];
    const baseUsername = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
    const username = `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`;

    const role = VALID_ROLES.includes(companyRole) ? companyRole : 'member';

    const newUser = await User.create({
        username,
        email: email.toLowerCase(),
        passwordHash,
        userType: 'company',
        companyId,
        companyRole: role,
        jobTitle: jobTitle || null,
        departments: departments || [],
        managedDepartments: role === 'manager' ? (departments || []) : [],
        accountStatus: 'invited',
        verified: true, 
        lastLoginAt: null,
    });

    
    const Company = require('../../../models/Company');
    const company = await Company.findById(companyId).select('name').lean();
    const companyName = company?.name || 'Your Company';

    await sendInviteEmail({ to: email, name, companyName, tempPassword });

    return {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        companyRole: newUser.companyRole,
        accountStatus: newUser.accountStatus,
        jobTitle: newUser.jobTitle,
    };
}

async function listMembers(companyId, { callerRole, status, role, search } = {}) {
    const filter = { companyId };

    if (status) filter.accountStatus = status;
    if (role) filter.companyRole = role;
    if (search) {
        const regex = new RegExp(search, 'i');
        filter.$or = [{ username: regex }, { email: regex }, { jobTitle: regex }];
    }

    
    if (callerRole === 'guest') {
        filter.companyRole = { $ne: 'guest' };
    }

    const members = await User.find(filter)
        .select('username email profilePicture companyRole jobTitle accountStatus departments managedDepartments joiningDate lastLoginAt isOnline createdAt')
        .populate('departments', 'name')
        .populate('managedDepartments', 'name')
        .sort({ createdAt: -1 })
        .lean();

    return members;
}

async function getMember(memberId, companyId) {
    const member = await User.findOne({ _id: memberId, companyId })
        .select('-passwordHash -refreshTokens -otpCodes -verificationTokenHash -resetPasswordTokenHash')
        .populate('departments', 'name')
        .populate('managedDepartments', 'name')
        .populate('workspaces.workspace', 'name type')
        .lean();

    if (!member) {
        const err = new Error('Member not found in this company.');
        err.status = 404;
        throw err;
    }
    return member;
}

async function changeRole({ companyId, targetId, newRole, managedDepartments, requesterId, requesterRole }) {
    if (!VALID_ROLES.includes(newRole)) {
        const err = new Error(`Invalid role "${newRole}". Must be one of: ${VALID_ROLES.join(', ')}`);
        err.status = 400;
        throw err;
    }

    const target = await User.findOne({ _id: targetId, companyId });
    if (!target) {
        const err = new Error('Member not found in this company.');
        err.status = 404;
        throw err;
    }

    
    if (target.companyRole === 'owner') {
        const err = new Error('The company owner\'s role cannot be changed.');
        err.status = 403;
        throw err;
    }

    
    if (newRole === 'owner' && requesterRole !== 'owner') {
        const err = new Error('Only a company owner can assign the owner role.');
        err.status = 403;
        throw err;
    }

    
    if (targetId.toString() === requesterId.toString() && requesterRole === 'admin' && newRole !== 'admin' && newRole !== 'owner') {
        const err = new Error('Admins cannot demote their own role.');
        err.status = 403;
        throw err;
    }

    target.companyRole = newRole;

    
    if (newRole === 'manager' && managedDepartments) {
        target.managedDepartments = managedDepartments;
    } else if (newRole !== 'manager') {
        target.managedDepartments = [];
    }

    await target.save();

    return {
        _id: target._id,
        username: target.username,
        email: target.email,
        companyRole: target.companyRole,
        managedDepartments: target.managedDepartments,
    };
}

async function updateStatus({ companyId, targetId, newStatus, reason, requesterId, requesterRole }) {
    if (!VALID_STATUSES.includes(newStatus)) {
        const err = new Error(`Invalid status "${newStatus}". Must be one of: ${VALID_STATUSES.join(', ')}`);
        err.status = 400;
        throw err;
    }

    const target = await User.findOne({ _id: targetId, companyId });
    if (!target) {
        const err = new Error('Member not found in this company.');
        err.status = 404;
        throw err;
    }

    
    if (target.companyRole === 'owner') {
        const err = new Error('The company owner\'s status cannot be changed.');
        err.status = 403;
        throw err;
    }

    
    if (target.companyRole === 'admin' && requesterRole !== 'owner') {
        const err = new Error('Only a company owner can suspend or remove another admin.');
        err.status = 403;
        throw err;
    }

    target.accountStatus = newStatus;

    if (newStatus === 'suspended') {
        target.suspendedAt = new Date();
        target.suspendedBy = requesterId;
        target.suspensionReason = reason || 'No reason provided';
    } else if (newStatus === 'active') {
        
        target.suspendedAt = null;
        target.suspendedBy = null;
        target.suspensionReason = null;
    } else if (newStatus === 'removed') {
        target.deactivatedAt = new Date();
    }

    await target.save();

    return {
        _id: target._id,
        username: target.username,
        email: target.email,
        accountStatus: target.accountStatus,
        companyRole: target.companyRole,
    };
}

module.exports = {
    inviteEmployee,
    listMembers,
    getMember,
    changeRole,
    updateStatus,
};
