const identity = require('../../identity');
const org = require('../../identity/queries/org');
const { hydrate } = require('../../identity/hydrate');
const { logAction } = require('../../../utils/historyLogger');
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
                const requester = await org.users.findOne({ _id: userId });
                results = await bulkInviteEmployees(companyId, company.domain, employees, requester?.companyRole || 'admin', userId);
            }

            await org.updateCompany(companyId, { setupStep: 4 });
            return { message: 'Invites processed', results, nextStep: 4 };
        }

        case 4: {
            
            await org.updateCompany(companyId, { isSetupComplete: true, setupStep: 4 });
            const launcher = await org.users.findOne({ _id: userId });
            return {
                message: 'Setup complete! Workspace launched.',
                redirectTo: launcher?.companyRole === 'owner' ? '/owner/dashboard' : '/admin/dashboard',
                nextStep: null
            };
        }

        default:
            throw new Error('Invalid setup step');
    }
}

/**
 * Setup-wizard invites (typed in, or from the spreadsheet). Each person goes through the
 * standard invite flow (onboarding.service onboardIndividual): an account in the "invited"
 * state, an emailed one-time invite link, their real name as display name, department
 * membership, and the role ceiling of the person running setup. No password is ever emailed.
 */
async function bulkInviteEmployees(companyId, companyDomain, employees, requesterRole = 'owner', invitedBy = null) {
    const { onboardIndividual } = require('../onboarding/onboarding.service');
    const results = { created: 0, skipped: 0, errors: [] };

    const departments = await org.departments.find({ company: companyId, isActive: true }, { members: false });
    const deptMap = {};
    departments.forEach(d => { deptMap[d.name.toLowerCase()] = String(d._id); });
    // Everyone invited at setup joins the company-wide workspace, so they land somewhere.
    const company = await org.companies.findOne({ _id: companyId }, { admins: false });
    const defaultWs = company?.defaultWorkspace ? String(company.defaultWorkspace._id || company.defaultWorkspace) : null;

    for (const emp of employees) {
        const email = String(emp.companyEmail || emp.email || '').trim().toLowerCase();
        const label = emp.name || email || 'Unnamed row';
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            results.errors.push({ name: label, error: 'No valid email' });
            continue;
        }
        const fullName = String(emp.name || '').trim() || email.split('@')[0];
        const [firstName, ...rest] = fullName.split(/\s+/);
        const deptId = deptMap[String(emp.department || '').toLowerCase()];
        const role = ['admin', 'manager', 'member', 'guest'].includes(emp.role) ? emp.role : 'member';
        try {
            await onboardIndividual({
                companyId,
                requesterRole,
                invitedBy,
                email,
                personalEmail: emp.personalEmail || '',
                firstName,
                lastName: rest.join(' '),
                companyRole: role,
                departmentIds: deptId ? [deptId] : [],
                additionalWorkspaceIds: defaultWs ? [defaultWs] : [],
                jobTitle: emp.jobTitle || undefined,
            });
            results.created++;
        } catch (err) {
            if (err.status === 409) results.skipped++;
            else results.errors.push({ name: label, error: err.message });
        }
    }

    return results;
}
