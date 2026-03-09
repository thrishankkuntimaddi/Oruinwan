// server/src/features/integration/scim.controller.js
//
// Phase 4 — Enterprise Integration Layer
// SCIM 2.0 provisioning endpoints.
//
// Auth: Bearer token (ScimToken model — SHA-256 hash stored, raw token shown once).
// All endpoints are company-scoped via the token's companyId.
//
// SCIM operations map to:
//   POST   /api/scim/users         → create user (accountStatus:'invited', send invite email)
//   PATCH  /api/scim/users/:id     → update user (name, title, dept, role)
//   DELETE /api/scim/users/:id     → deactivate user (accountStatus:'suspended')
//
// Role ceiling: SCIM cannot assign 'owner'. Ceiling checked against ASSIGNABLE_ROLES.
// Department: name (from SCIM schemas) resolved to ObjectId via dept map.
// Cross-company: All lookups include companyId guard.

const crypto = require('crypto');
const User = require('../../../models/User');
const ScimToken = require('../../../models/ScimToken');
const Department = require('../../../models/Department');
const { ASSIGNABLE_ROLES } = require('../onboarding/onboarding.service');
const { logSecurityEvent } = require('../security/security.service');

// ============================================================================
// SCIM AUTH MIDDLEWARE
// ============================================================================

/**
 * Validate SCIM Bearer token on every request.
 * Attaches req.scimCompanyId and req.scimToken on success.
 */
async function scimAuth(req, res, next) {
    const auth = req.headers['authorization'] || '';
    if (!auth.startsWith('Bearer ')) {
        return res.status(401).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], status: 401, detail: 'Unauthorized' });
    }

    const raw = auth.slice(7).trim();
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const token = await ScimToken.findOne({ tokenHash: hash, isActive: true });

    if (!token) {
        return res.status(401).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], status: 401, detail: 'Invalid or revoked SCIM token' });
    }

    if (token.expiresAt && token.expiresAt < new Date()) {
        return res.status(401).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], status: 401, detail: 'SCIM token has expired' });
    }

    // Update last-used timestamp (fire-and-forget)
    ScimToken.findByIdAndUpdate(token._id, { lastUsedAt: new Date() }).catch(() => { });

    req.scimCompanyId = token.companyId;
    req.scimToken = token;
    next();
}

// ============================================================================
// SCIM RESPONSE HELPERS
// ============================================================================

function scimUserResponse(user) {
    return {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: user._id.toString(),
        externalId: user.scimExternalId || null,
        userName: user.email,
        name: {
            formatted: user.username,
            givenName: user.username?.split(' ')[0] || '',
            familyName: user.username?.split(' ').slice(1).join(' ') || '',
        },
        emails: [{ value: user.email, primary: true }],
        active: user.accountStatus === 'active',
        title: user.jobTitle || '',
        meta: {
            resourceType: 'User',
            created: user.createdAt,
            lastModified: user.updatedAt,
            location: `/api/scim/users/${user._id}`,
        },
    };
}

function scimError(res, status, detail) {
    return res.status(status).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status,
        detail,
    });
}

// ============================================================================
// RESOLVE DEPARTMENT
// ============================================================================

async function resolveDeptId(deptName, companyId) {
    if (!deptName) return null;
    const dept = await Department.findOne({
        name: { $regex: new RegExp(`^${deptName}$`, 'i') },
        company: companyId,
        isActive: true,
    }).lean();
    return dept ? dept._id : null;
}

// ============================================================================
// SCIM ROLE NORMALISATION
// ============================================================================

// Map common SCIM titles/groups → companyRoles
// Falls back to 'member' if unmapped
const SCIM_ROLE_MAP = {
    owner: 'admin',   // SCIM cannot assign 'owner'
    admin: 'admin',
    manager: 'manager',
    member: 'member',
    guest: 'guest',
};

function normaliseRole(scimRole) {
    const r = (scimRole || 'member').toLowerCase();
    return SCIM_ROLE_MAP[r] || 'member';
}

// ============================================================================
// POST /api/scim/users — Provision a new user
// ============================================================================

exports.scimAuth = scimAuth;

/**
 * SCIM User Provisioning — Create
 *
 * SCIM payload shape (RFC 7643):
 *   userName        → email
 *   name.givenName  → firstName
 *   name.familyName → lastName
 *   title           → jobTitle
 *   roles[0].value  → companyRole (subject to ceiling)
 *   groups[0].value → department name
 *   externalId      → scimExternalId (IdP user ID)
 */
exports.createUser = async (req, res) => {
    try {
        const companyId = req.scimCompanyId;
        const body = req.body;

        const email = (body.userName || '').toLowerCase().trim();
        const firstName = body.name?.givenName || email.split('@')[0];
        const lastName = body.name?.familyName || '';
        const jobTitle = body.title || '';
        const scimRole = body.roles?.[0]?.value || 'member';
        const deptName = body.groups?.[0]?.display || body['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User']?.department || '';
        const extId = body.externalId || null;

        if (!email) return scimError(res, 400, 'userName (email) is required');

        // Role ceiling — SCIM acts with 'admin' ceiling
        const companyRole = normaliseRole(scimRole);
        if (!ASSIGNABLE_ROLES['admin'].includes(companyRole) && companyRole !== 'admin') {
            return scimError(res, 400, `Role '${companyRole}' cannot be assigned via SCIM`);
        }

        // Duplicate check
        const existing = await User.findOne({ email }).lean();
        if (existing) {
            if (existing.companyId?.toString() === companyId.toString()) {
                // Return existing user (idempotent)
                return res.status(200).json(scimUserResponse(existing));
            }
            return scimError(res, 409, 'User with this email exists in another company');
        }

        // Department resolution
        const deptId = await resolveDeptId(deptName, companyId);
        const departmentIds = deptId ? [deptId] : [];

        // Use onboarding service for consistent invite flow
        const { onboardIndividual } = require('../onboarding/onboarding.service');

        const result = await onboardIndividual({
            companyId,
            requesterRole: 'admin',   // SCIM always uses admin ceiling
            invitedBy: null,      // system-initiated
            email,
            firstName,
            lastName,
            companyRole,
            departmentIds,
            additionalWorkspaceIds: [],
            jobTitle,
        });

        // Attach scimExternalId
        if (extId) {
            await User.findByIdAndUpdate(result.userId, { scimExternalId: extId });
        }

        const user = await User.findById(result.userId).lean();

        logSecurityEvent({
            companyId,
            eventType: 'invite_accepted',
            outcome: 'success',
            metadata: { source: 'scim', email, provider: req.scimToken.provider },
        });

        return res.status(201).json(scimUserResponse(user));

    } catch (err) {
        console.error('[SCIM] createUser error:', err.message);
        return scimError(res, err.status || 500, err.message);
    }
};

// ============================================================================
// PATCH /api/scim/users/:id — Update user attributes
// ============================================================================

/**
 * SCIM User Update — PATCH (RFC 7644 § 3.5.2)
 *
 * Supported Operations:
 *   replace: title, name, roles
 *   replace: departments (group membership)
 *   replace: active (false → suspend, true → reactivate)
 */
exports.updateUser = async (req, res) => {
    try {
        const companyId = req.scimCompanyId;
        const userId = req.params.id;
        const body = req.body;

        const user = await User.findOne({ _id: userId, companyId });
        if (!user) return scimError(res, 404, 'User not found');

        const ops = body.Operations || [];

        for (const op of ops) {
            const path = (op.path || '').toLowerCase();
            const val = op.value;

            if (op.op === 'replace' || op.op === 'Replace') {

                // Display name / title
                if (path === 'title' || typeof val?.title === 'string') {
                    user.jobTitle = val?.title || val;
                }
                if (path === 'name.formatted' || val?.name?.formatted) {
                    user.username = val?.name?.formatted || val;
                }

                // Active flag → suspend / reactivate
                if (path === 'active' || typeof val?.active === 'boolean') {
                    const active = typeof val === 'boolean' ? val : val?.active;
                    user.accountStatus = active ? 'active' : 'suspended';
                }

                // Role
                if (path === 'roles' && Array.isArray(val)) {
                    const newRole = normaliseRole(val[0]?.value);
                    if (ASSIGNABLE_ROLES['admin'].includes(newRole) || newRole === 'admin') {
                        user.companyRole = newRole;
                    }
                }

                // Department via groups
                if (path === 'groups' && Array.isArray(val)) {
                    const deptId = await resolveDeptId(val[0]?.display, companyId);
                    if (deptId && !user.departments.map(String).includes(String(deptId))) {
                        const { assignMembers } = require('../departments/department.service');
                        await assignMembers(deptId.toString(), companyId.toString(), [userId], 'add').catch(() => { });
                    }
                }
            }
        }

        await user.save();
        return res.json(scimUserResponse(user));

    } catch (err) {
        console.error('[SCIM] updateUser error:', err.message);
        return scimError(res, err.status || 500, err.message);
    }
};

// ============================================================================
// DELETE /api/scim/users/:id — Deactivate (soft-delete)
// ============================================================================

/**
 * SCIM deprovision = suspend (not hard-delete).
 * Sets accountStatus:'suspended', preserves all data.
 * Full delete requires manual admin action.
 */
exports.deactivateUser = async (req, res) => {
    try {
        const companyId = req.scimCompanyId;
        const userId = req.params.id;

        const user = await User.findOne({ _id: userId, companyId });
        if (!user) return scimError(res, 404, 'User not found');

        user.accountStatus = 'suspended';
        await user.save();

        logSecurityEvent({
            companyId,
            actorId: null,
            eventType: 'account_suspended',
            outcome: 'success',
            metadata: { source: 'scim', userId, email: user.email, provider: req.scimToken.provider },
        });

        return res.status(204).send();

    } catch (err) {
        console.error('[SCIM] deactivateUser error:', err.message);
        return scimError(res, err.status || 500, err.message);
    }
};

// ============================================================================
// GET /api/scim/users/:id — Retrieve a user (SCIM READ)
// ============================================================================

exports.getUser = async (req, res) => {
    try {
        const user = await User.findOne({
            _id: req.params.id,
            companyId: req.scimCompanyId,
        }).lean();

        if (!user) return scimError(res, 404, 'User not found');
        return res.json(scimUserResponse(user));
    } catch (err) {
        return scimError(res, 500, err.message);
    }
};

// ============================================================================
// GET /api/scim/users — List users (SCIM LIST with filtering)
// ============================================================================

exports.listUsers = async (req, res) => {
    try {
        const { startIndex = 1, count = 50 } = req.query;
        const skip = Math.max(parseInt(startIndex) - 1, 0);

        const [users, totalResults] = await Promise.all([
            User.find({ companyId: req.scimCompanyId, accountStatus: { $ne: 'removed' } })
                .skip(skip)
                .limit(parseInt(count))
                .lean(),
            User.countDocuments({ companyId: req.scimCompanyId, accountStatus: { $ne: 'removed' } }),
        ]);

        return res.json({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
            totalResults,
            startIndex: parseInt(startIndex),
            itemsPerPage: users.length,
            Resources: users.map(scimUserResponse),
        });

    } catch (err) {
        return scimError(res, 500, err.message);
    }
};

// ============================================================================
// POST /api/company/scim/tokens — Issue a token (admin console)
// ============================================================================

exports.issueToken = async (req, res) => {
    try {
        const { label = 'SCIM Token', provider = 'generic' } = req.body;
        const companyId = req.companyId; // set by requireCompanyMember

        // Generate raw token
        const rawToken = crypto.randomBytes(40).toString('hex'); // 80-char hex
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        const tokenDoc = await ScimToken.create({
            companyId,
            createdBy: req.user._dbUser._id,
            tokenHash,
            label,
            provider,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        });

        // Return raw token ONCE — never retrievable again
        return res.status(201).json({
            success: true,
            tokenId: tokenDoc._id,
            label: tokenDoc.label,
            token: rawToken,   // ← raw, shown ONCE
            expiresAt: tokenDoc.expiresAt,
            warning: 'Save this token immediately. It will NOT be shown again.',
        });

    } catch (err) {
        console.error('[SCIM] issueToken error:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
};

// ============================================================================
// DELETE /api/company/scim/tokens/:tokenId — Revoke a token
// ============================================================================

exports.revokeToken = async (req, res) => {
    try {
        const doc = await ScimToken.findOneAndUpdate(
            { _id: req.params.tokenId, companyId: req.companyId },
            { isActive: false },
            { new: true }
        );
        if (!doc) return res.status(404).json({ success: false, error: 'Token not found' });

        return res.json({ success: true, message: 'Token revoked' });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

// ============================================================================
// GET /api/company/scim/tokens — List tokens for admin console
// ============================================================================

exports.listTokens = async (req, res) => {
    try {
        const tokens = await ScimToken.find({ companyId: req.companyId })
            .select('-tokenHash') // never expose hash
            .sort({ createdAt: -1 })
            .lean();

        return res.json({ success: true, tokens });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};
