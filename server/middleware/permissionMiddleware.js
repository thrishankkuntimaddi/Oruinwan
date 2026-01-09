// server/middleware/permissionMiddleware.js
const Company = require('../models/Company');
const Department = require('../models/Department');
const User = require('../models/User');

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
    try {
        // Fetch full user if not already fully populated
        if (!req.user.companyRole || !req.user.companyId) {
            const userId = req.user.sub || req.user._id;
            const fullUser = await User.findById(userId);

            if (!fullUser) {
                console.error('[REQUIRE_OWNER] User not found:', userId);
                return res.status(401).json({ message: "User not found" });
            }
            // Update req.user with full DB object
            req.user = fullUser;
        }

        console.log('[REQUIRE_OWNER] Checking owner role for user:', req.user.email, 'Role:', req.user.companyRole);

        if (req.user.companyRole === 'owner' || req.user.isCoOwner) {
            console.log('[REQUIRE_OWNER] Access granted');
            next();
        } else {
            console.error('[REQUIRE_OWNER] Access denied. Current role:', req.user.companyRole);
            res.status(403).json({
                message: "Access denied: Owner privileges required",
                currentRole: req.user.companyRole
            });
        }
    } catch (error) {
        console.error("RequireOwner Middleware Error:", error);
        res.status(500).json({ message: "Server error during permission check" });
    }
};

/**
 * Check if user is Company Admin or Owner
 */
const requireAdmin = async (req, res, next) => {
    try {
        // Fetch full user if not already fully populated
        // We check for companyRole because JWT payload doesn't have it
        if (!req.user.companyRole || !req.user.companyId) {
            const userId = req.user.sub || req.user._id;
            const fullUser = await User.findById(userId);

            if (!fullUser) {
                return res.status(401).json({ message: "User not found" });
            }
            // Update req.user with full DB object
            req.user = fullUser;
        }

        const adminRoles = ['owner', 'admin'];
        if (adminRoles.includes(req.user.companyRole) || req.user.isCoOwner) {
            next();
        } else {
            res.status(403).json({ message: "Access denied: Admin privileges required" });
        }
    } catch (error) {
        console.error("RequireAdmin Middleware Error:", error);
        res.status(500).json({ message: "Server error during permission check" });
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

/**
 * Check if user is a Manager, Admin, or Owner
 * Used for manager dashboard access
 */
const requireManager = async (req, res, next) => {
    try {
        // Fetch full user if needed
        if (!req.user.companyRole || !req.user.companyId) {
            const userId = req.user.sub || req.user._id;
            const fullUser = await User.findById(userId);

            if (!fullUser) {
                return res.status(401).json({ message: "User not found" });
            }
            req.user = fullUser;
        }

        const managerRoles = ['owner', 'admin', 'manager'];
        if (managerRoles.includes(req.user.companyRole) || req.user.isCoOwner) {
            next();
        } else {
            res.status(403).json({ message: "Access denied: Manager privileges required" });
        }
    } catch (error) {
        console.error("RequireManager Middleware Error:", error);
        res.status(500).json({ message: "Server error during permission check" });
    }
};

module.exports = {
    checkRole,
    requireOwner,
    requireAdmin,
    requireManager,
    requireDepartmentManager,
    canCreateWorkspace
};
