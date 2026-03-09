// server/src/shared/middleware/enforceRoleCeiling.js
//
// ARCH: Gate #3 in the middleware chain (used after requireWorkspaceMember).
// Implements the core permission ceiling rule from the Architecture Audit:
//
//   Company Role = Permission CEILING
//   Workspace Role = Scoped permission (cannot exceed the ceiling)
//
// Rule Examples:
//   companyRole=guest  + workspaceRole=admin   → effectiveRole=guest  (BLOCKED at ceiling)
//   companyRole=member + workspaceRole=admin   → effectiveRole=member  (BLOCKED at ceiling)
//   companyRole=admin  + workspaceRole=member  → effectiveRole=member  (lower scoped role used)
//   companyRole=admin  + workspaceRole=admin   → effectiveRole=admin   (same level, allowed)
//   companyRole=owner  + workspaceRole=owner   → effectiveRole=owner   (full access)
//
// Expects:
//   req.companyRole    → set by requireCompanyMember
//   req.workspaceRole  → set by requireWorkspaceMember
//
// Sets on req:
//   req.effectiveRole  → the resolved role after ceiling enforcement
//
// Optional: pass { minRole } option to require a minimum effectiveRole for the route.
//   Example: enforceRoleCeiling({ minRole: 'admin' })

// Ordered from lowest to highest privilege.
const ROLE_HIERARCHY = ["guest", "member", "manager", "admin", "owner"];

// Map workspace roles to the company hierarchy scale for comparison.
// Workspace does not have 'manager' or 'guest' — map them to nearest equivalent.
const WORKSPACE_ROLE_MAP = {
    member: "member",
    admin: "admin",
    owner: "owner",
};

// Map company roles to the ceiling (manager → admin ceiling for workspace actions)
const COMPANY_CEILING_MAP = {
    guest: "guest",
    member: "member",
    manager: "admin",   // managers have admin-level workspace access
    admin: "admin",
    owner: "owner",
};

function roleLevel(role) {
    const level = ROLE_HIERARCHY.indexOf(role);
    return level === -1 ? 0 : level;
}

function resolveEffectiveRole(companyRole, workspaceRole) {
    const companyCeiling = COMPANY_CEILING_MAP[companyRole] || "member";
    const mappedWorkspaceRole = WORKSPACE_ROLE_MAP[workspaceRole] || "member";

    // Effective role = lower of the two
    const ceilingLevel = roleLevel(companyCeiling);
    const workspaceLevel = roleLevel(mappedWorkspaceRole);

    return ceilingLevel <= workspaceLevel ? companyCeiling : mappedWorkspaceRole;
}

/**
 * Middleware factory. Call with optional options.
 *
 * @param {Object} options
 * @param {string} [options.minRole] - If provided, requires effectiveRole >= minRole.
 *                                     Responds 403 if the ceiling falls below this.
 *
 * @example
 * // Any authenticated workspace member:
 * router.get('/', verifyToken, requireCompanyMember, requireWorkspaceMember, enforceRoleCeiling());
 *
 * // Must have at least admin effective role:
 * router.delete('/:id', verifyToken, requireCompanyMember, requireWorkspaceMember, enforceRoleCeiling({ minRole: 'admin' }));
 */
const enforceRoleCeiling = (options = {}) => {
    const { minRole } = options;

    return (req, res, next) => {
        try {
            const companyRole = req.companyRole;
            const workspaceRole = req.workspaceRole;

            if (!companyRole) {
                return res.status(500).json({
                    success: false,
                    error: "Middleware chain error: requireCompanyMember must run first.",
                    code: "MIDDLEWARE_ORDER_ERROR",
                });
            }

            const effectiveRole = resolveEffectiveRole(companyRole, workspaceRole || "member");
            req.effectiveRole = effectiveRole;

            // If a minimum role is required for this route, enforce it now
            if (minRole) {
                const effectiveLevel = roleLevel(effectiveRole);
                const requiredLevel = roleLevel(minRole);

                if (effectiveLevel < requiredLevel) {
                    return res.status(403).json({
                        success: false,
                        error: `This action requires at least '${minRole}' access. Your effective role is '${effectiveRole}'.`,
                        code: "INSUFFICIENT_ROLE",
                        effectiveRole,
                        requiredRole: minRole,
                    });
                }
            }

            next();
        } catch (err) {
            next(err);
        }
    };
};

// Expose the resolver utility for use in controllers/services where needed
enforceRoleCeiling.resolveEffectiveRole = resolveEffectiveRole;
enforceRoleCeiling.ROLE_HIERARCHY = ROLE_HIERARCHY;

module.exports = enforceRoleCeiling;
