// server/middleware/permissionMiddleware.js
const Company = require('../models/Company');
const Department = require('../models/Department');

/**
 * Generic middleware to check if user has one of the required roles
 * @param {string[]} allowedRoles - Array of allowed roles ['owner', 'admin', 'manager', 'member']
 */
const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.companyRole) {
            return res.status(403).json({ message: "Access denied: No role assigned" });
        }

        if (allowedRoles.includes(req.user.companyRole)) {
            next();
        } else {
            res.status(403).json({
                message: "Access denied: Insufficient permissions",
                required: allowedRoles,
                current: req.user.companyRole
            });
        }
    };
};

/**
 * Check if user is Company Owner (or Co-Owner)
 */
const requireOwner = async (req, res, next) => {
    if (req.user.companyRole === 'owner' || req.user.isCoOwner) {
        next();
    } else {
        res.status(403).json({ message: "Access denied: Owner privileges required" });
    }
};

/**
 * Check if user is Company Admin or Owner
 */
const requireAdmin = async (req, res, next) => {
    const adminRoles = ['owner', 'admin'];
    if (adminRoles.includes(req.user.companyRole) || req.user.isCoOwner) {
        next();
    } else {
        res.status(403).json({ message: "Access denied: Admin privileges required" });
    }
};

/**
 * Check if user is a Manager of the specific department
 * Expects departmentId in req.params.id or req.params.departmentId
 */
const requireDepartmentManager = async (req, res, next) => {
    try {
        const departmentId = req.params.id || req.params.departmentId;

        // Owners and Admins explicitly have access to all departments
        if (['owner', 'admin'].includes(req.user.companyRole) || req.user.isCoOwner) {
            return next();
        }

        // Check if user is a manager
        if (req.user.companyRole !== 'manager') {
            return res.status(403).json({ message: "Access denied: Manager role required" });
        }

        // Check if user manages THIS specific department
        const managesDepartment = req.user.managedDepartments &&
            req.user.managedDepartments.map(id => id.toString()).includes(departmentId);

        if (managesDepartment) {
            next();
        } else {
            res.status(403).json({ message: "Access denied: You do not manage this department" });
        }
    } catch (error) {
        console.error("Permission Check Error:", error);
        res.status(500).json({ message: "Permission check failed" });
    }
};

/**
 * Check if user has permission to create workspace
 * - Admins/Owners: Always yes
 * - Managers: Yes, within their department
 * - Members: Yes, ONLY if allowMemberWorkspaceCreation setting is true
 */
const canCreateWorkspace = async (req, res, next) => {
    try {
        // 1. Owner/Admin -> Always allow
        if (['owner', 'admin'].includes(req.user.companyRole) || req.user.isCoOwner) {
            return next();
        }

        // 2. Manager -> Allow (will be scoped to department in controller)
        if (req.user.companyRole === 'manager') {
            return next();
        }

        // 3. Member -> Check Company Settings
        const company = await Company.findById(req.user.companyId);
        if (company && company.settings.allowMemberWorkspaceCreation) {
            return next();
        }

        return res.status(403).json({
            message: "Access denied: Workspace creation requires approval. Please contact your admin."
        });

    } catch (error) {
        console.error("Permission Check Error:", error);
        res.status(500).json({ message: "Permission check failed" });
    }
};

module.exports = {
    checkRole,
    requireOwner,
    requireAdmin,
    requireDepartmentManager,
    canCreateWorkspace
};
