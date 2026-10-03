const logger = require('../../../utils/logger');
const identity = require('../../identity');
const org = require('../../identity/queries/org');
const { hydrate } = require('../../identity/hydrate');
const { logAction } = require('../../../utils/historyLogger');
const bcrypt = require('bcryptjs');
const sendEmail = require('../../../utils/sendEmail');
const XLSX = require('xlsx');
const { uploadToGCS } = require('../../modules/uploads/upload.service');

// Never sent to clients: OTPs, verification tokens, SSO secrets, uploaded documents.
const COMPANY_SECRET_FIELDS = '-phoneOTP -phoneOTPExpiresAt -domainVerificationToken -domainVerificationExpires -ssoConfig -documents -metadata';

const ADMIN_USER = { type: 'user', fields: ['username', 'email', 'profilePicture'] };

/** Company for API responses: no secrets, admins / default workspace / departments expanded. */
async function presentCompany(company) {
    if (!company) return null;
    const out = org.publicCompany(company, { documents: false, metadata: false });
    await hydrate(out, { 'admins.user': ADMIN_USER, defaultWorkspace: { type: 'workspace', fields: ['name'] } });
    const depts = await org.departments.find({ company: company._id, isActive: true }, { sort: { name: 1 } });
    await hydrate(depts, { head: { type: 'user', fields: ['username', 'email'] } });
    out.departments = depts.map((d) => ({ _id: d._id, name: d.name, head: d.head, memberCount: (d.members || []).length }));
    return out;
}

async function getCompanyById(companyId) {
    return presentCompany(await org.companies.findOne({ _id: companyId }));
}

async function checkUserAccess(userId, companyId) {
    const user = await identity.users.findById(userId);

    if (!user) {
        return { hasAccess: false, user: null };
    }

    // Only members of this very company (no shortcut for company-less accounts).
    const hasAccess = !!user.companyId && user.companyId.toString() === String(companyId);

    return { hasAccess, user };
}

async function checkIsAdmin(userId, companyId) {
    const user = await identity.users.findById(userId);

    if (!user) {
        return { isAdmin: false, user: null };
    }

    const isCoOwner = user.coOwnerOf && user.companyId && String(user.coOwnerOf) === String(user.companyId);
    const isAdmin = !!user.companyId &&
        user.companyId.toString() === String(companyId) &&
        (user.companyRole === 'owner' || user.companyRole === 'admin' || !!isCoOwner);

    return { isAdmin, user };
}

const PROFILE_FIELDS = ['name', 'displayName', 'logo', 'website', 'industry', 'description'];
const SETTINGS_FIELDS = ['timezone', 'theme', 'logo', 'phone', 'address', 'socialLinks', 'allowMemberWorkspaceCreation', 'allowPersonalWorkspaces'];
const INVITE_POLICY_FIELDS = ['requireInvite', 'allowExternalInvite', 'defaultRole'];
const OWNER_ONLY_FIELDS = ['plan', 'billingEmail'];

/**
 * Turns a PUT /api/companies/:id body into a safe $set. Profile fields and a
 * few settings only; plan/billing need an owner; verification, domain, admins,
 * activation and SSO are never changed through this route (silently dropped).
 * Returns { updates } or { error, status }.
 */
function sanitizeCompanyUpdates(body = {}, requesterRole) {
    const updates = {};
    for (const k of PROFILE_FIELDS) if (body[k] !== undefined) updates[k] = body[k];
    if (body.settings && typeof body.settings === 'object') {
        for (const k of SETTINGS_FIELDS) if (body.settings[k] !== undefined) updates[`settings.${k}`] = body.settings[k];
    }
    if (body.invitePolicy && typeof body.invitePolicy === 'object') {
        for (const k of INVITE_POLICY_FIELDS) if (body.invitePolicy[k] !== undefined) updates[`invitePolicy.${k}`] = body.invitePolicy[k];
    }
    const ownerOnly = OWNER_ONLY_FIELDS.filter((k) => body[k] !== undefined);
    if (ownerOnly.length) {
        if (requesterRole !== 'owner') return { error: `Only the company owner can change: ${ownerOnly.join(', ')}`, status: 403 };
        for (const k of ownerOnly) updates[k] = body[k];
    }
    return { updates };
}

async function updateCompany(companyId, updates) {
    return presentCompany(await org.updateCompany(companyId, updates));
}

const MEMBER_FIELDS = [
    'username', 'email', 'companyEmail',
    'profilePicture', 'companyRole',
    'jobTitle', 'phone', 'corporateId',
    'accountStatus', 'createdAt', 'lastLoginAt', 'isOnline',
    'departments', 'workspaces'
].join(' ');

async function getCompanyMembers(companyId, { callerRole } = {}) {
    const members = await org.users.find(
        { companyId, accountStatus: { $ne: 'removed' } },
        { org: true, select: MEMBER_FIELDS }
    );
    await hydrate(members, {
        departments: { type: 'department', fields: ['name'] },
        'workspaces.workspace': { type: 'workspace', fields: ['name'] },
    });

    if (callerRole === 'guest') {
        return members.map(({ phone, corporateId, ...rest }) => rest); // eslint-disable-line no-unused-vars
    }
    return members;
}

async function getCompanyMetrics(companyId) {
    const stats = await org.companyUserStats(companyId);
    return {
        totalUsers: stats.users.total,
        activeUsers: stats.users.online,
        totalWorkspaces: stats.workspaces.total,
        totalDepartments: stats.departments
    };
}

async function updateMemberRole({ companyId, targetUserId, requesterId, newRole, req }) {
    const { assignRoleError, manageUserError } = require('../../shared/roleCeiling');
    const fail = (message, status) => Object.assign(new Error(message), { status });

    const company = await org.companies.findOne({ _id: companyId });
    if (!company) throw fail('Company not found', 404);

    // Roles come from the database, not the stored admins list (it can be stale).
    const requester = await identity.users.findById(requesterId);
    const roleError = assignRoleError(requester, newRole);
    if (roleError) throw fail(roleError, roleError.startsWith('Invalid') ? 400 : 403);

    const targetUser = await identity.users.findById(targetUserId);
    if (!targetUser || String(targetUser.companyId) !== String(companyId)) throw fail('User not found', 404);

    const manageError = manageUserError(requester, targetUser);
    if (manageError) throw fail(manageError, 403);

    const oldRole = targetUser.companyRole;

    // Role and the company's admin list change together.
    const { withTransaction } = require('../../shared/postgres');
    await withTransaction(async (tx) => {
        await org.users.updateMany({ _id: targetUserId }, { companyRole: newRole }, { tx });
        if (newRole === 'owner' || newRole === 'admin') {
            const existingAdmin = company.admins.find(a => String(a.user) === String(targetUserId));
            if (!existingAdmin) await org.addCompanyAdmin(companyId, targetUserId, newRole, { tx });
        } else {
            await tx.query('DELETE FROM company_admins WHERE company_id = $1 AND user_id = $2', [String(companyId), String(targetUserId)]);
        }
    });
    targetUser.companyRole = newRole;

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

module.exports = {
    sanitizeCompanyUpdates,
    COMPANY_SECRET_FIELDS,
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

async function processSetupStep({ companyId, userId, step, data, files }) {
    const company = await org.companies.findOne({ _id: companyId });
    if (!company) throw new Error('Company not found');

    switch (step) {
        case 1: {
            
            const updates = {};
            if (data.displayName) updates.displayName = data.displayName;
            if (data.timezone) updates['settings.timezone'] = data.timezone;

            
            if (files.logo && files.logo[0]) {
                const logoFile = files.logo[0];
                const gcsResult = await uploadToGCS(logoFile, `company-logos/${companyId}`, { userId, companyId });
                updates['settings.logo'] = gcsResult.url;
                updates.logo = gcsResult.url;
            }

            updates.setupStep = 2;
            await org.updateCompany(companyId, updates);
            return { message: 'Step 1 saved', nextStep: 2 };
        }

        case 2: {
            
            const deptNames = data.departments || [];

            
            // Setup replaces the department list (and their memberships) in one go.
            const { withTransaction } = require('../../shared/postgres');
            const createdDepts = await withTransaction(async (tx) => {
                await tx.query('DELETE FROM departments WHERE company_id = $1', [String(companyId)]);
                const out = [];
                for (const name of deptNames) out.push(await org.insert('departments', { name, company: companyId }, { tx }));
                await org.updateCompany(companyId, { setupStep: 3 }, { tx });
                return out;
            });

            return { message: 'Departments saved', departments: createdDepts, nextStep: 3 };
        }

        case 3: {
            
            let employees = [];

            if (files.employeeFile && files.employeeFile[0]) {
                
                const wb = XLSX.read(files.employeeFile[0].buffer, { type: 'buffer' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
                const dataRows = rows.slice(1).filter(r => r[2] || r[1]); 

                employees = dataRows.map(r => {
                    
                    
                    
                    
                    const isNewFormat = String(r[2] || '').includes('@');
                    if (isNewFormat) {
                        return {
                            name: `${String(r[0] || '').trim()} ${String(r[1] || '').trim()}`.trim(),
                            companyEmail: String(r[2] || '').trim().toLowerCase(),  
                            personalEmail: String(r[3] || '').trim().toLowerCase(), 
                            jobTitle: String(r[4] || '').trim(),
                            joiningDate: String(r[5] || '').trim(),
                            phone: String(r[6] || '').trim(),
                            corporateId: String(r[7] || '').trim(),
                            role: String(r[8] || 'member').trim().toLowerCase(),
                            department: String(r[9] || '').trim(),
                        };
                    }
                    
                    return {
                        name: String(r[0] || '').trim(),
                        companyEmail: String(r[1] || '').trim().toLowerCase(),
                        personalEmail: '',
                        phone: String(r[2] || '').trim(),
                        role: String(r[3] || 'member').trim().toLowerCase(),
                        department: String(r[4] || '').trim(),
                    };
                }).filter(e => e.companyEmail);

                
                if (company?.domain) {
                    employees = employees.map(e => ({
                        ...e,
                        
                        domainMismatch: !e.companyEmail.endsWith(`@${company.domain}`)
                    }));
                }
            } else if (data.invites && Array.isArray(data.invites)) {
                employees = data.invites.filter(i => i.email);
            }

            let results = { created: 0, skipped: 0, errors: [] };
            if (employees.length > 0) {
                results = await bulkInviteEmployees(companyId, company.domain, employees);
            }

            await org.updateCompany(companyId, { setupStep: 4 });
            return { message: 'Invites processed', results, nextStep: 4 };
        }

        case 4: {
            
            await org.updateCompany(companyId, { isSetupComplete: true, setupStep: 4 });
            // (The Mongo-era 'companyStatus' flag never existed on the user schema; nothing to set.)
            void userId;
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

async function bulkInviteEmployees(companyId, companyDomain, employees) {
    const results = { created: 0, skipped: 0, errors: [] };

    const company = await org.companies.findOne({ _id: companyId });
    const departments = await org.departments.find({ company: companyId, isActive: true }, { members: false });

    const deptMap = {};
    departments.forEach(d => {
        deptMap[d.name.toLowerCase()] = d._id;
    });

    for (const emp of employees) {
        try {
            
            
            const companyEmailVal = emp.companyEmail || emp.email || '';
            const loginEmail = (emp.personalEmail || companyEmailVal).toLowerCase();
            const credentialEmail = emp.personalEmail || companyEmailVal; 

            if (!companyEmailVal && !loginEmail) {
                results.errors.push({ name: emp.name, error: 'No email provided' });
                continue;
            }

            
            const existingUser = await org.users.findOne({
                $or: [
                    { companyEmail: companyEmailVal },
                    { email: loginEmail },
                    { email: companyEmailVal }
                ]
            });
            if (existingUser) {
                results.skipped++;
                continue;
            }

            
            const tempPassword = generateTempPassword();
            const hashedPw = await bcrypt.hash(tempPassword, 10);

            
            const deptId = deptMap[emp.department?.toLowerCase()] || null;

            
            const validRoles = ['owner', 'admin', 'manager', 'member', 'guest'];
            const companyRole = validRoles.includes(emp.role) ? emp.role : 'member';

            
            const namePart = (emp.name || companyEmailVal.split('@')[0])
                .toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
            const username = `${namePart}_${Math.random().toString(36).slice(2, 6)}`;

            
            
            
            const newUser = await identity.users.create({
                username,
                email: loginEmail,
                companyEmail: companyEmailVal,
                phone: emp.phone || undefined,
                jobTitle: emp.jobTitle || undefined,
                passwordHash: hashedPw,
                userType: 'company',
                companyId: String(companyId),
                companyRole,
                verified: true,
                accountStatus: 'active',
            });
            if (deptId) await org.addDepartmentMembers(deptId, [newUser._id], 'member');

            
            await sendWelcomeEmail({
                to: credentialEmail,
                name: emp.name || username,
                companyName: company.name,
                companyEmail: companyEmailVal,  
                loginEmail,
                tempPassword
            });

            results.created++;
        } catch (err) {
            results.errors.push({ name: emp.name, error: err.message });
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

async function sendWelcomeEmail({ to, name, companyName, companyEmail, loginEmail, tempPassword }) {
    try {
        await sendEmail({
            to,
            subject: `You're invited to join ${companyName} on Oruinwan`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8fafc;">
                    <div style="background: white; border-radius: 16px; padding: 40px; border: 1px solid #e2e8f0;">
                        <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 8px;">Welcome to ${companyName}! 🎉</h1>
                        <p style="color: #64748b; margin-bottom: 24px;">Hi ${name}, your account has been set up on Oruinwan.</p>

                        <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                            <p style="margin: 0 0 8px; font-size: 13px; color: #64748b; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase;">Your Login Details</p>
                            ${companyEmail ? `<p style="margin: 4px 0; color: #1e293b;"><strong>Work Email:</strong> ${companyEmail}</p>` : ''}
                            <p style="margin: 4px 0; color: #1e293b;"><strong>Login Email:</strong> ${loginEmail || to}</p>
                            <p style="margin: 4px 0; color: #1e293b;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-size: 16px; font-weight: bold; letter-spacing: 0.1em;">${tempPassword}</code></p>
                        </div>

                        <p style="color: #64748b; font-size: 14px;">⚠️ Please change your password immediately after your first login.</p>

                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
                           style="display: inline-block; margin-top: 20px; background: #4f46e5; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                            Login to Oruinwan →
                        </a>

                        <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">This invitation was sent by ${companyName}. If you believe this was a mistake, please ignore this email.</p>
                    </div>
                </div>
            `
        });
    } catch (err) {
        logger.error('[WELCOME EMAIL] Failed to send to', to, ':', err.message);
        
    }
}
