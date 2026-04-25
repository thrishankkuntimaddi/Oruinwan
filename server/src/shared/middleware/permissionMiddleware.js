const Company = require('../../../models/Company');
const User = require('../../../models/User');

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

const requireOwner = async (req, res, next) => {
    try {
        
        if (!req.user.companyRole || !req.user.companyId) {
            const userId = req.user.sub || req.user._id;
            const fullUser = await User.findById(userId);

            if (!fullUser) {
                console.error('[REQUIRE_OWNER] User not found:', userId);
                return res.status(401).json({ message: "User not found" });
            }
            req.user = fullUser;
        }

        
        
        console.log('[REQUIRE_OWNER] Checking owner role for user:', req.user._id || req.user.sub, 'Role:', req.user.companyRole);

        
        
        
        const isCoOwnerHere = req.user.coOwnerOf && req.user.companyId &&
            req.user.coOwnerOf.toString() === req.user.companyId.toString();
        if (req.user.companyRole === 'owner' || isCoOwnerHere) {
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

const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user.companyRole || !req.user.companyId) {
            const userId = req.user.sub || req.user._id;
            const fullUser = await User.findById(userId);

            if (!fullUser) {
                return res.status(401).json({ message: "User not found" });
            }
            req.user = fullUser;
        }

        const adminRoles = ['owner', 'admin'];
        
        const isCoOwnerHere = req.user.coOwnerOf && req.user.companyId &&
            req.user.coOwnerOf.toString() === req.user.companyId.toString();
        if (adminRoles.includes(req.user.companyRole) || isCoOwnerHere) {
            next();
        } else {
            res.status(403).json({ message: "Access denied: Admin privileges required" });
        }
    } catch (error) {
        console.error("RequireAdmin Middleware Error:", error);
        res.status(500).json({ message: "Server error during permission check" });
    }
};

const requireDepartmentManager = async (req, res, next) => {
    try {
        const departmentId = req.params.id || req.params.departmentId;

        
        
        const isCoOwnerHere = req.user.coOwnerOf && req.user.companyId &&
            req.user.coOwnerOf.toString() === req.user.companyId.toString();
        if (['owner', 'admin'].includes(req.user.companyRole) || isCoOwnerHere) {
            return next();
        }

        if (req.user.companyRole !== 'manager') {
            return res.status(403).json({ message: "Access denied: Manager role required" });
        }

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

const canCreateWorkspace = async (req, res, next) => {
    try {
        
        const isCoOwnerHere = req.user.coOwnerOf && req.user.companyId &&
            req.user.coOwnerOf.toString() === req.user.companyId.toString();
        if (['owner', 'admin'].includes(req.user.companyRole) || isCoOwnerHere) {
            return next();
        }

        if (req.user.companyRole === 'manager') {
            return next();
        }

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

const requireManager = async (req, res, next) => {
    try {
        if (!req.user.companyRole || !req.user.companyId) {
            const userId = req.user.sub || req.user._id;
            const fullUser = await User.findById(userId);

            if (!fullUser) {
                return res.status(401).json({ message: "User not found" });
            }
            req.user = fullUser;
        }

        const managerRoles = ['owner', 'admin', 'manager'];
        
        const isCoOwnerHere = req.user.coOwnerOf && req.user.companyId &&
            req.user.coOwnerOf.toString() === req.user.companyId.toString();
        if (managerRoles.includes(req.user.companyRole) || isCoOwnerHere) {
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
