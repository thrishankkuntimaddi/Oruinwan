// server/src/features/onboarding/onboarding.service.js
//
// Phase 1 — Company Identity Layer
//
// Handles individual employee onboarding:
//   onboardIndividual(params) — creates user with accountStatus:'invited', assigns
//                               departments via department.service.assignMembers(),
//                               sends token invite email

const bcrypt = require('bcryptjs');
const User = require('../../../models/User');
const Company = require('../../../models/Company');
const Department = require('../../../models/Department');
const Workspace = require('../../../models/Workspace');
const { createInviteToken, sendInviteEmail } = require('./invite.service');

// ============================================================================
// ROLE CEILING
// ============================================================================

/**
 * Role hierarchy — lowest to highest privilege.
 * Used for ceiling comparisons.
 */
const ROLE_HIERARCHY = ['guest', 'member', 'manager', 'admin', 'owner'];

/**
 * Roles that can be assigned via onboarding (owner is NEVER assignable via this flow).
 */
const ASSIGNABLE_ROLES = {
    owner: ['admin', 'manager', 'member', 'guest'],
    admin: ['manager', 'member', 'guest'],
    manager: ['member', 'guest'],
    member: [],
    guest: [],
};

/**
 * Check if a requester role can assign a target role.
 * @param {string} requesterRole  — companyRole of the person doing the inviting
 * @param {string} targetRole     — companyRole being assigned to the new user
 * @returns {boolean}
 */
function checkRoleCeiling(requesterRole, targetRole) {
    const allowed = ASSIGNABLE_ROLES[requesterRole] || [];
    return allowed.includes(targetRole);
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Verify all departmentIds exist and belong to this company.
 * Throws 400 if any mismatch is found (cross-company poisoning guard).
 */
async function validateDepartments(departmentIds, companyId) {
    if (!departmentIds || departmentIds.length === 0) return;

    const found = await Department.find({
        _id: { $in: departmentIds },
        company: companyId,
        isActive: true,
    }).select('_id').lean();

    if (found.length !== departmentIds.length) {
        throw Object.assign(
            new Error('One or more departments do not belong to your company or are inactive.'),
            { status: 400 }
        );
    }
}

/**
 * Verify all workspaceIds exist and belong to this company.
 * Throws 400 if any mismatch is found.
 */
async function validateWorkspaces(workspaceIds, companyId) {
    if (!workspaceIds || workspaceIds.length === 0) return;

    const found = await Workspace.find({
        _id: { $in: workspaceIds },
        company: companyId,
    }).select('_id').lean();

    if (found.length !== workspaceIds.length) {
        throw Object.assign(
            new Error('One or more workspaces do not belong to your company.'),
            { status: 400 }
        );
    }
}

// ============================================================================
// ONBOARD INDIVIDUAL
// ============================================================================

/**
 * Onboard a single employee via token invite.
 *
 * Flow:
 *   1. Role ceiling check
 *   2. Cross-company dept/workspace validation
 *   3. Duplicate email check
 *   4. Create User with accountStatus:'invited', passwordHash:null
 *   5. Call department.service.assignMembers() for Phase 4 workspace join
 *   6. Store additionalWorkspaceIds on user.workspaces[]
 *   7. Generate invite token (SHA-256 on User)
 *   8. Send magic-link invite email
 *
 * @param {Object} params
 * @param {string}   params.companyId
 * @param {string}   params.requesterRole   — companyRole of the admin doing the inviting
 * @param {string}   params.invitedBy       — userId of the admin
 * @param {string}   params.email           — personal/invite email (sent the link)
 * @param {string}   params.firstName
 * @param {string}   params.lastName
 * @param {string}   params.companyRole     — role to assign
 * @param {string[]} params.departmentIds   — validated upstream by route OR here
 * @param {string[]} params.additionalWorkspaceIds
 * @param {string}   [params.jobTitle]
 * @param {Date}     [params.joiningDate]
 * @returns {Promise<{ userId, inviteId, emailSent }>}
 */
async function onboardIndividual(params) {
    const {
        companyId,
        requesterRole,
        invitedBy,
        email,
        firstName,
        lastName,
        companyRole = 'member',
        departmentIds = [],
        additionalWorkspaceIds = [],
        jobTitle,
        joiningDate,
    } = params;

    // 1. Role ceiling check
    if (!checkRoleCeiling(requesterRole, companyRole)) {
        throw Object.assign(
            new Error(`Your role '${requesterRole}' cannot assign '${companyRole}'. Role ceiling violated.`),
            { status: 403, code: 'ROLE_CEILING_VIOLATION' }
        );
    }

    // 2. Load company
    const company = await Company.findById(companyId).lean();
    if (!company) throw Object.assign(new Error('Company not found.'), { status: 404 });

    // 3. Cross-company poisoning guards
    await validateDepartments(departmentIds, companyId);
    await validateWorkspaces(additionalWorkspaceIds, companyId);

    // 4. Duplicate check — by email
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
        if (existing.accountStatus === 'active') {
            throw Object.assign(new Error('This email is already registered and active.'), { status: 409 });
        }
        if (existing.companyId && existing.companyId.toString() !== companyId.toString()) {
            throw Object.assign(new Error('This email belongs to a user in another company.'), { status: 409 });
        }
        // If they're in 'invited' state for this same company — resend path (caller handles)
        if (existing.companyId && existing.companyId.toString() === companyId.toString()) {
            throw Object.assign(
                new Error('This user is already invited. Use POST /resend/:id to re-send the invite.'),
                { status: 409, code: 'ALREADY_INVITED' }
            );
        }
    }

    // 5. Build workspace memberships (additional only — dept default handled by assignMembers)
    const workspaceMemberships = additionalWorkspaceIds.map(wsId => ({
        workspace: wsId,
        role: 'member',
        joinedAt: new Date(),
    }));

    // 6. Create User record with accountStatus:'invited', no password
    const user = new User({
        username: `${firstName} ${lastName}`.trim(),
        email: normalizedEmail,
        passwordHash: null,                  // set when invite is accepted
        userType: 'company',
        companyId,
        companyRole,
        jobTitle: jobTitle || null,
        joiningDate: joiningDate || new Date(),
        departments: departmentIds,          // Phase 4 will sync these on accept
        workspaces: workspaceMemberships,
        verified: false,
        accountStatus: 'invited',
    });

    await user.save();

    // 7. Phase 4: call department.service.assignMembers() for each department
    //    This handles:
    //      - Department.members[] ← user._id
    //      - User.departments[]   ← departmentId
    //      - Workspace auto-join  ← department.defaultWorkspaceId (if set)
    if (departmentIds.length > 0) {
        const { assignMembers } = require('../departments/department.service');
        for (const deptId of departmentIds) {
            try {
                await assignMembers(deptId, companyId, [user._id.toString()], 'add');
            } catch (err) {
                // Non-fatal — user is created, department join logged as warning
                console.warn('[ONBOARDING] assignMembers warning:', deptId, err.message);
            }
        }
    }

    // 8. Generate SHA-256 invite token → stored on User
    const rawToken = await createInviteToken(user); // mutates user doc

    // 9. Send magic-link email
    const emailResult = await sendInviteEmail(normalizedEmail, company.name, rawToken, {
        name: `${firstName} ${lastName}`.trim(),
        jobTitle: jobTitle || '',
    });

    // 10. Update email status on user
    user.inviteEmailStatus = emailResult.sent ? 'sent' : 'failed';
    await user.save();

    return {
        userId: user._id,
        emailSent: emailResult.sent,
        // inviteId is the user._id (no separate Invite model in this flow)
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    onboardIndividual,
    checkRoleCeiling,
    validateDepartments,
    validateWorkspaces,
    ROLE_HIERARCHY,
    ASSIGNABLE_ROLES,
};
