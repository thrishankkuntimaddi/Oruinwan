const logger = require('../../../utils/logger');
const identity = require('../../identity');
const org = require('../../identity/queries/org');
const { hydrate } = require('../../identity/hydrate');

const DEPT_NAME = { type: 'department', fields: ['name'] };
const bcrypt = require('bcryptjs');
const sendEmail = require('../../../utils/sendEmail');
const { assignRoleError, manageUserError, assertCompanyDepartments, syncCompanyAdmins } = require('../../shared/roleCeiling');

const fail = (message, status) => Object.assign(new Error(message), { status });

const VALID_STATUSES = ['active', 'suspended', 'removed'];

function generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    let pw = '';
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
}

async function sendInviteEmail({ to, name, companyName, tempPassword }) {
    try {
        const loginUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        await sendEmail({
            to,
            subject: `You've been invited to join ${companyName} on Oruinwan`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8fafc;">
                    <div style="background: white; border-radius: 16px; padding: 40px; border: 1px solid #e2e8f0;">
                        <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 8px;">Welcome to ${companyName}! 🎉</h1>
                        <p style="color: #64748b; margin-bottom: 24px;">Hi ${name}, you've been invited to collaborate on Oruinwan.</p>

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
        logger.error('[PEOPLE SERVICE] Invite email failed for', to, ':', err.message);
        
    }
}

async function inviteEmployee({ companyId, email, firstName, lastName, companyRole, jobTitle, departments, invitedById, requesterRole }) {
    const roleError = assignRoleError({ companyRole: requesterRole }, companyRole || 'member');
    if (roleError) throw fail(roleError, roleError.startsWith('Invalid') ? 400 : 403);
    departments = await assertCompanyDepartments(companyId, departments || []);

    const existing = await identity.users.findByEmail(email.toLowerCase());
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

    const role = companyRole || 'member';

    const newUser = await identity.users.create({
        username,
        email: email.toLowerCase(),
        passwordHash,
        userType: 'company',
        companyId: String(companyId),
        companyRole: role,
        jobTitle: jobTitle || null,
        accountStatus: 'invited',
        verified: true,
        lastLoginAt: null,
    });
    // Department membership (and management, for managers) lives in department_members.
    for (const d of departments || []) await org.addDepartmentMembers(d, [newUser._id], role === 'manager' ? 'manager' : 'member');

    const company = await org.companies.findOne({ _id: companyId }, { admins: false });
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
        const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ username: regex }, { email: regex }, { jobTitle: regex }];
    }

    
    if (callerRole === 'guest') {
        filter.companyRole = { $ne: 'guest' };
    }

    const members = await org.users.find(filter, {
        org: true,
        select: 'username email profilePicture companyRole jobTitle accountStatus departments managedDepartments joiningDate lastLoginAt isOnline createdAt',
        sort: { createdAt: -1 },
    });
    await hydrate(members, { departments: DEPT_NAME, managedDepartments: DEPT_NAME });

    return members;
}

async function getMember(memberId, companyId) {
    // Secrets are not returned by the repository unless asked for.
    const member = await org.users.findOne({ _id: memberId, companyId }, { org: true });
    if (member) {
        delete member.tokens; delete member.loginGuard;
        if (member.encryption) member.encryption = { ...member.encryption, encryptedPrivateKey: undefined };
        await hydrate(member, { departments: DEPT_NAME, managedDepartments: DEPT_NAME, 'workspaces.workspace': { type: 'workspace', fields: ['name', 'type'] } });
    }

    if (!member) {
        const err = new Error('Member not found in this company.');
        err.status = 404;
        throw err;
    }
    return member;
}

async function changeRole({ companyId, targetId, newRole, managedDepartments, requesterId, requesterRole }) {
    const roleError = assignRoleError({ companyRole: requesterRole }, newRole);
    if (roleError) throw fail(roleError, roleError.startsWith('Invalid') ? 400 : 403);

    const target = await org.users.findOne({ _id: targetId, companyId }, { org: true });
    if (!target) throw fail('Member not found in this company.', 404);

    const manageError = manageUserError({ _id: requesterId, companyId, companyRole: requesterRole }, target);
    if (manageError) throw fail(manageError, 403);

    if (managedDepartments) managedDepartments = await assertCompanyDepartments(companyId, managedDepartments);

    target.companyRole = newRole;
    await org.updateUser(target._id, { companyRole: newRole });

    // Managed departments are the 'manager' rows in department_members.
    if (newRole === 'manager' && managedDepartments) {
        await org.setUserManagedDepartments(target._id, managedDepartments, { companyId });
        target.managedDepartments = managedDepartments.map(String);
    } else if (newRole !== 'manager') {
        await org.setUserManagedDepartments(target._id, [], { companyId });
        target.managedDepartments = [];
    }

    await syncCompanyAdmins(companyId, target._id, newRole);

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

    const target = await org.users.findOne({ _id: targetId, companyId });
    if (!target) throw fail('Member not found in this company.', 404);

    const manageError = manageUserError({ _id: requesterId, companyId, companyRole: requesterRole }, target);
    if (manageError) throw fail(manageError, 403);

    target.accountStatus = newStatus;
    const patch = { accountStatus: newStatus };

    if (newStatus === 'suspended') {
        Object.assign(patch, { suspendedAt: new Date(), suspendedBy: requesterId, suspensionReason: reason || 'No reason provided' });
    } else if (newStatus === 'active') {
        Object.assign(patch, { suspendedAt: null, suspendedBy: null, suspensionReason: null });
    } else if (newStatus === 'removed') {
        patch.deactivatedAt = new Date();
    }

    await org.updateUser(target._id, patch);

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
