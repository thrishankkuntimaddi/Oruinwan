// server/middleware/permissions.js

const Company = require("../models/Company");
const Workspace = require("../models/Workspace");
const Channel = require("../../features/channels/channel.model.js");
const User = require("../models/User");

/**
 * Check if user belongs to a company
 */
exports.requireCompany = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.sub);

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        if (!user.companyId) {
            return res.status(403).json({
                message: "This feature requires company membership",
                userType: "personal"
            });
        }

        const company = await Company.findById(user.companyId);

        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        if (!company.isActive) {
            return res.status(403).json({ message: "Company is inactive" });
        }

        // Attach to request
        req.company = company;
        req.userRole = user.companyRole;

        next();
    } catch (_err) {
        console.error("requireCompany error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check if user is company owner
 */
exports.requireCompanyOwner = async (req, res, next) => {
    try {
        await exports.requireCompany(req, res, async () => {
            if (!req.company.isOwner(req.user.sub)) {
                return res.status(403).json({ message: "Only company owners can perform this action" });
            }
            next();
        });
    } catch (_err) {
        console.error("requireCompanyOwner error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check if user is company admin or owner
 */
exports.requireCompanyAdmin = async (req, res, next) => {
    try {
        await exports.requireCompany(req, res, async () => {
            const user = await User.findById(req.user.sub);

            if (!req.company.isAdmin(req.user.sub) && user.companyRole !== "admin" && user.companyRole !== "owner") {
                return res.status(403).json({ message: "Admin privileges required" });
            }

            next();
        });
    } catch (_err) {
        console.error("requireCompanyAdmin error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check if user has access to a workspace
 */
exports.requireWorkspaceAccess = async (req, res, next) => {
    try {
        const workspaceId = req.params.workspaceId || req.body.workspaceId;

        if (!workspaceId) {
            return res.status(400).json({ message: "Workspace ID required" });
        }

        const workspace = await Workspace.findById(workspaceId);

        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        // Check if user is member
        if (!workspace.isMember(req.user.sub)) {
            return res.status(403).json({ message: "You are not a member of this workspace" });
        }

        // Check if workspace belongs to user's company (if company user)
        const user = await User.findById(req.user.sub);
        if (user.companyId && workspace.type === "company") {
            if (workspace.company.toString() !== user.companyId.toString()) {
                return res.status(403).json({ message: "Workspace belongs to different company" });
            }
        }

        req.workspace = workspace;
        next();
    } catch (_err) {
        console.error("requireWorkspaceAccess error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check if user is workspace admin or owner
 */
exports.requireWorkspaceAdmin = async (req, res, next) => {
    try {
        await exports.requireWorkspaceAccess(req, res, async () => {
            if (!req.workspace.isAdminOrOwner(req.user.sub)) {
                return res.status(403).json({ message: "Workspace admin privileges required" });
            }
            next();
        });
    } catch (_err) {
        console.error("requireWorkspaceAdmin error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check if user has access to a channel
 */
exports.requireChannelAccess = async (req, res, next) => {
    try {
        const channelId = req.params.channelId || req.body.channelId;

        if (!channelId) {
            return res.status(400).json({ message: "Channel ID required" });
        }

        const channel = await Channel.findById(channelId).populate("workspace");

        if (!channel) {
            return res.status(404).json({ message: "Channel not found" });
        }

        // Check workspace access first
        const workspace = channel.workspace;
        if (!workspace.isMember(req.user.sub)) {
            return res.status(403).json({ message: "You are not a member of this workspace" });
        }

        // Check channel membership (for private channels)
        if (!channel.isMember(req.user.sub)) {
            return res.status(403).json({ message: "You are not a member of this channel" });
        }

        req.channel = channel;
        req.workspace = workspace;
        next();
    } catch (_err) {
        console.error("requireChannelAccess error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Validate same company for DM
 */
exports.validateDMAccess = async (req, res, next) => {
    try {
        const { recipientId } = req.body;

        if (!recipientId) {
            return res.status(400).json({ message: "Recipient ID required" });
        }

        const sender = await User.findById(req.user.sub);
        const recipient = await User.findById(recipientId);

        if (!recipient) {
            return res.status(404).json({ message: "Recipient not found" });
        }

        // Both must belong to same company
        if (sender.companyId && recipient.companyId) {
            if (sender.companyId.toString() !== recipient.companyId.toString()) {
                return res.status(403).json({
                    message: "Cannot DM users from different companies"
                });
            }
        } else if (!sender.companyId || !recipient.companyId) {
            // Personal users can only DM other personal users
            if (sender.companyId !== recipient.companyId) {
                return res.status(403).json({
                    message: "Personal and company users cannot DM each other"
                });
            }
        }

        req.recipient = recipient;
        next();
    } catch (_err) {
        console.error("validateDMAccess error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Multi-tenant isolation - ensure all queries include companyId
 */
exports.tenantIsolation = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.sub);

        // Add companyId to request for automatic filtering
        req.tenantId = user.companyId || null;
        req.userType = user.userType;

        next();
    } catch (_err) {
        console.error("tenantIsolation error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check specific permission
 */
exports.checkPermission = (permission) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.user.sub);

            // Super simple permission check based on role
            const rolePermissions = {
                owner: ["all"],
                admin: ["manageUsers", "createWorkspace", "deleteChannel", "assignTasks"],
                manager: ["createChannel", "assignTasks", "createTasks"],
                member: ["sendMessages", "createNotes", "createTasks"],
                guest: ["sendMessages", "createNotes"]
            };

            const userPermissions = rolePermissions[user.companyRole] || [];

            if (!userPermissions.includes("all") && !userPermissions.includes(permission)) {
                return res.status(403).json({
                    message: `Permission denied: ${permission}`,
                    requiredPermission: permission,
                    userRole: user.companyRole
                });
            }

            next();
        } catch (_err) {
            console.error("checkPermission error:", err);
            return res.status(500).json({ message: "Server error" });
        }
    };
};

module.exports = exports;
