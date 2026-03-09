// server/src/features/departments/departments.routes.js
//
// Phase 2 — Department Management System
// Replaces the old inline monolith. All routes wired with Phase 1 middleware chain.
//
// Middleware chain:
//   requireAuth            → validates JWT token
//   requireCompanyMember   → DB read: validates companyId + accountStatus, attaches req.companyId
//   requireCompanyRole()   → checks req.companyRole meets minimum tier
//   canManageDepartment    → for /members: allows admin/owner always; manager only if they own this dept

const express = require('express');
const router = express.Router();
const deptController = require('./department.controller');
const deptValidation = require('./department.validation');

// Phase 1 middleware
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole, checkCompanyRole } = require('../../shared/utils/companyRole');

// ── canManageDepartment ──────────────────────────────────────────────────────
// Admins and owners always pass.
// Managers pass only if this specific department is in their managedDepartments[].
// req.user._dbUser is attached by requireCompanyMember (Phase 1 upgrade).

const canManageDepartment = (req, res, next) => {
    const role = req.companyRole;
    const departmentId = req.params.id;

    // Admin or owner: full access
    if (checkCompanyRole(role, 'admin')) {
        return next();
    }

    // Manager: must manage THIS department specifically
    if (role === 'manager') {
        const dbUser = req.user._dbUser;
        const managedIds = (dbUser?.managedDepartments || []).map(id => id.toString());

        if (managedIds.includes(departmentId)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            error: 'You do not manage this department.',
            code: 'NOT_DEPARTMENT_MANAGER',
        });
    }

    // Member, guest: no access
    return res.status(403).json({
        success: false,
        error: 'Managing department members requires manager access or higher.',
        code: 'INSUFFICIENT_ROLE',
    });
};

// ============================================================================
// ROUTES
// ============================================================================

/**
 * @route   GET /api/departments
 * @desc    Get all departments for the authenticated user's company
 * @access  Private — any active company member
 */
router.get(
    '/',
    requireAuth,
    requireCompanyMember,
    deptController.getDepartments
);

/**
 * @route   GET /api/departments/:id
 * @desc    Get a single department (company-isolated)
 * @access  Private — any active company member
 */
router.get(
    '/:id',
    requireAuth,
    requireCompanyMember,
    deptController.getDepartmentById
);

/**
 * @route   POST /api/departments
 * @desc    Create a new department (bootstraps workspace + channels + encryption keys)
 * @access  Private — admin or owner
 */
router.post(
    '/',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('admin'),
    deptValidation.createDepartment,
    deptController.createDepartment
);

/**
 * @route   PATCH /api/departments/:id
 * @desc    Update department metadata (name, description, head, etc.)
 * @access  Private — admin or owner
 */
router.patch(
    '/:id',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('admin'),
    deptValidation.updateDepartment,
    deptController.updateDepartment
);

/**
 * @route   DELETE /api/departments/:id
 * @desc    Soft-delete department + clean up User.departments[] references
 * @access  Private — admin or owner
 */
router.delete(
    '/:id',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('admin'),
    deptController.deleteDepartment
);

/**
 * @route   PATCH /api/departments/:id/members
 * @desc    Bulk add or remove members (syncs User.departments[] bidirectionally)
 * @body    { userIds: string[], action: 'add' | 'remove' }
 * @access  Private — admin/owner always; manager only for their own department
 */
router.patch(
    '/:id/members',
    requireAuth,
    requireCompanyMember,
    canManageDepartment,
    deptValidation.assignMembers,
    deptController.assignMembers
);

module.exports = router;
