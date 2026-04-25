const ROLE_HIERARCHY = ["guest", "member", "manager", "admin", "owner"];

const WORKSPACE_ROLE_MAP = {
    member: "member",
    admin: "admin",
    owner: "owner",
};

const COMPANY_CEILING_MAP = {
    guest: "guest",
    member: "member",
    manager: "admin",   
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

    
    const ceilingLevel = roleLevel(companyCeiling);
    const workspaceLevel = roleLevel(mappedWorkspaceRole);

    return ceilingLevel <= workspaceLevel ? companyCeiling : mappedWorkspaceRole;
}

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

enforceRoleCeiling.resolveEffectiveRole = resolveEffectiveRole;
enforceRoleCeiling.ROLE_HIERARCHY = ROLE_HIERARCHY;

module.exports = enforceRoleCeiling;
