const COMPANY_ROLE_HIERARCHY = ["guest", "member", "manager", "admin", "owner"];

function roleLevel(role) {
    const idx = COMPANY_ROLE_HIERARCHY.indexOf(role);
    return idx === -1 ? -1 : idx;
}

function checkCompanyRole(userRole, requiredRole) {
    const userLevel = roleLevel(userRole);
    const requiredLevel = roleLevel(requiredRole);

    
    if (userLevel === -1 || requiredLevel === -1) return false;

    return userLevel >= requiredLevel;
}

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
    
    _roleLevel: roleLevel,
};
