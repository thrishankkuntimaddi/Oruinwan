// server/src/shared/utils/companyRole.js
//
// Company Role Utility — Phase 1 Company Membership Foundation
//
// Exports:
//   COMPANY_ROLE_HIERARCHY        → ordered array, lowest to highest
//   checkCompanyRole(userRole, requiredRole) → boolean
//   requireCompanyRole(minRole)   → Express middleware factory
//
// Company roles (from the Architecture Audit):
//   guest   → external collaborator, most restricted
//   member  → standard employee
//   manager → team/department lead
//   admin   → company administrator
//   owner   → company owner (highest, can reassign owner)
//
// Usage in routes:
//   router.put('/settings',
//     verifyToken, requireCompanyMember, requireCompanyRole('admin'), controller.update
//   );
//
// Usage in controllers/services:
//   const { checkCompanyRole } = require('../../shared/utils/companyRole');
//   if (!checkCompanyRole(req.companyRole, 'manager')) { ... }

// ============ ROLE HIERARCHY ============
// Index = privilege level. Higher index = more privileged.
const COMPANY_ROLE_HIERARCHY = ["guest", "member", "manager", "admin", "owner"];

/**
 * Returns the numeric privilege level for a given role.
 * Unknown roles default to -1 (below guest).
 * @param {string} role
 * @returns {number}
 */
function roleLevel(role) {
    const idx = COMPANY_ROLE_HIERARCHY.indexOf(role);
    return idx === -1 ? -1 : idx;
}

/**
 * Check whether a user's company role meets or exceeds a required role.
 *
 * @param {string} userRole     - The user's current companyRole
 * @param {string} requiredRole - The minimum role required for the operation
 * @returns {boolean}
 *
 * Returns false if either role is not in the hierarchy (defensive default).
 *
 * @example
 * checkCompanyRole('admin',   'manager') // → true   (admin > manager)
 * checkCompanyRole('member',  'admin')   // → false  (member < admin)
 * checkCompanyRole('owner',   'owner')   // → true   (exact match)
 * checkCompanyRole('manager', 'manager') // → true   (exact match)
 * checkCompanyRole('guest',   'member')  // → false
 * checkCompanyRole('admin',   'god')     // → false  (unknown required role)
 */
function checkCompanyRole(userRole, requiredRole) {
    const userLevel = roleLevel(userRole);
    const requiredLevel = roleLevel(requiredRole);

    // Treat unknown roles as insufficient — defensive default
    if (userLevel === -1 || requiredLevel === -1) return false;

    return userLevel >= requiredLevel;
}

/**
 * Express middleware factory.
 * Protects a route by requiring a minimum company role.
 * Must run AFTER requireCompanyMember (which attaches req.companyRole).
 *
 * @param {string} minRole - Minimum required company role
 * @returns {Function} Express middleware
 *
 * @example
 * router.delete('/:id', verifyToken, requireCompanyMember, requireCompanyRole('admin'), ctrl);
 * router.get('/reports', verifyToken, requireCompanyMember, requireCompanyRole('manager'), ctrl);
 */
function requireCompanyRole(minRole) {
    if (!COMPANY_ROLE_HIERARCHY.includes(minRole)) {
        throw new Error(
            `[requireCompanyRole] Invalid minRole: "${minRole}". ` +
            `Must be one of: ${COMPANY_ROLE_HIERARCHY.join(", ")}`
        );
    }

    return (req, res, next) => {
        const companyRole = req.companyRole;

        if (!companyRole) {
            return res.status(500).json({
                success: false,
                error: "Middleware chain error: requireCompanyMember must run before requireCompanyRole.",
                code: "MIDDLEWARE_ORDER_ERROR",
            });
        }

        if (!checkCompanyRole(companyRole, minRole)) {
            return res.status(403).json({
                success: false,
                error: `This action requires '${minRole}' access or higher. Your role is '${companyRole}'.`,
                code: "INSUFFICIENT_COMPANY_ROLE",
                yourRole: companyRole,
                requiredRole: minRole,
            });
        }

        next();
    };
}

module.exports = {
    COMPANY_ROLE_HIERARCHY,
    checkCompanyRole,
    requireCompanyRole,
    // Internal helper exposed for use by other role utilities
    _roleLevel: roleLevel,
};
