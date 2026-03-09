// server/src/features/people/people.routes.js
//
// Phase 3 — Company People Management
// Routes at /api/company/...
//
// Middleware chain:
//   requireAuth          → validates JWT
//   requireCompanyMember → DB read: validates companyId + accountStatus; attaches req.companyId, req.companyRole
//   requireCompanyRole() → gate by role tier
//   requireMinMember     → blocks guests from viewing member lists

const express = require('express');
const router = express.Router();

const ctrl = require('./people.controller');
const validation = require('./people.validation');
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

// ── requireMinMember ─────────────────────────────────────────────────────────
// Blocks 'guest' role from accessing member lists.
// Per spec: "Guests cannot see company member lists."
// Must run AFTER requireCompanyMember (which attaches req.companyRole).

const requireMinMember = (req, res, next) => {
    if (req.companyRole === 'guest') {
        return res.status(403).json({
            success: false,
            error: 'Guests are not permitted to view company member lists.',
            code: 'GUEST_RESTRICTED',
        });
    }
    return next();
};

// ============================================================================
// ROUTES
// ============================================================================

/**
 * @route   POST /api/company/invite
 * @desc    Invite a new employee. Creates account with accountStatus='invited' + sends email.
 * @access  Private — admin or owner
 * @body    { email, firstName?, lastName?, companyRole?, jobTitle?, departments? }
 */
router.post(
    '/invite',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('admin'),
    validation.inviteEmployee,
    ctrl.inviteEmployee
);

/**
 * @route   GET /api/company/members
 * @desc    List all company members. Supports ?status=, ?role=, ?search= filters.
 * @access  Private — member or above (guests blocked)
 * @query   status?, role?, search?
 */
router.get(
    '/members',
    requireAuth,
    requireCompanyMember,
    requireMinMember,
    validation.listMembers,
    ctrl.listMembers
);

/**
 * @route   GET /api/company/members/:id
 * @desc    Get a single company member (company-isolated)
 * @access  Private — member or above (guests blocked)
 */
router.get(
    '/members/:id',
    requireAuth,
    requireCompanyMember,
    requireMinMember,
    ctrl.getMember
);

/**
 * @route   PATCH /api/company/members/:id/role
 * @desc    Change a member's company role
 * @access  Private — admin or owner
 * @body    { newRole: string, managedDepartments?: string[] }
 */
router.patch(
    '/members/:id/role',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('admin'),
    validation.changeRole,
    ctrl.changeRole
);

/**
 * @route   PATCH /api/company/members/:id/status
 * @desc    Suspend, reactivate, or remove a member
 * @access  Private — admin or owner
 * @body    { status: 'active'|'suspended'|'removed', reason?: string }
 */
router.patch(
    '/members/:id/status',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('admin'),
    validation.updateStatus,
    ctrl.updateStatus
);

module.exports = router;
