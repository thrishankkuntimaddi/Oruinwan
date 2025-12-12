// server/controllers/dashboardController.js

const Company = require("../models/Company");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const Channel = require("../models/Channel");
const Invite = require("../models/Invite");
const Task = require("../models/Task");
const Update = require("../models/Update");

/**
 * Get admin dashboard data
 * GET /api/dashboard/admin
 */
exports.getAdminDashboard = async (req, res) => {
    try {
        const userId = req.user.sub;

        const user = await User.findById(userId).populate("companyId");

        if (!user || !user.companyId) {
            return res.status(404).json({ message: "Company not found" });
        }

        // Check if user is admin/owner
        if (user.companyRole !== "owner" && user.companyRole !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const companyId = user.companyId._id;

        // Get company details
        const company = await Company.findById(companyId)
            .populate("admins.user", "username email profilePicture")
            .populate("defaultWorkspace", "name");

        // Get company statistics
        const totalMembers = await User.countDocuments({ companyId });
        const totalWorkspaces = await Workspace.countDocuments({ company: companyId });
        const totalChannels = await Channel.countDocuments({ company: companyId });
        const pendingInvites = await Invite.countDocuments({
            company: companyId,
            used: false,
            expiresAt: { $gt: new Date() }
        });

        // Get recent members (last 10)
        const recentMembers = await User.find({ companyId })
            .sort({ createdAt: -1 })
            .limit(10)
            .select("username email profilePicture companyRole createdAt lastLoginAt")
            .lean();

        // Get all workspaces
        const workspaces = await Workspace.find({ company: companyId })
            .populate("createdBy", "username")
            .select("name description createdBy members createdAt")
            .lean();

        // Get pending/active tasks
        const activeTasks = await Task.countDocuments({
            company: companyId,
            status: { $in: ["todo", "in-progress"] }
        });

        // Get recent updates (announcements)
        const recentUpdates = await Update.find({
            company: companyId,
            type: "announcement"
        })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("postedBy", "username profilePicture")
            .lean();

        // Member growth by role
        const membersByRole = await User.aggregate([
            { $match: { companyId } },
            { $group: { _id: "$companyRole", count: { $sum: 1 } } }
        ]);

        return res.json({
            company: {
                id: company._id,
                name: company.name,
                domain: company.domain,
                domainVerified: company.domainVerified,
                plan: company.plan,
                admins: company.admins,
                defaultWorkspace: company.defaultWorkspace,
                settings: company.settings,
                createdAt: company.createdAt
            },
            statistics: {
                totalMembers,
                totalWorkspaces,
                totalChannels,
                pendingInvites,
                activeTasks,
                membersByRole
            },
            recentMembers,
            workspaces,
            recentUpdates,
            domainVerification: {
                available: !!company.domain,
                verified: company.domainVerified,
                canVerify: !!company.domain && !company.domainVerified
            }
        });

    } catch (err) {
        console.error("GET ADMIN DASHBOARD ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Get workspace dashboard data (for regular users)
 * GET /api/dashboard/workspace/:workspaceId
 */
exports.getWorkspaceDashboard = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId } = req.params;

        const workspace = await Workspace.findById(workspaceId)
            .populate("company", "name")
            .populate("createdBy", "username");

        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        // Check if user is member
        if (!workspace.isMember(userId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Get workspace channels
        const channels = await Channel.find({ workspace: workspaceId })
            .select("name description isPrivate isDefault members")
            .lean();

        // Get workspace tasks
        const tasks = await Task.find({ workspace: workspaceId })
            .populate("createdBy assignedTo", "username profilePicture")
            .sort({ dueDate: 1 })
            .limit(20)
            .lean();

        // Get workspace updates
        const updates = await Update.find({ workspace: workspaceId, isDeleted: false })
            .populate("postedBy", "username profilePicture")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        // Get workspace members
        const memberIds = workspace.members.map(m => m.user);
        const members = await User.find({ _id: { $in: memberIds } })
            .select("username email profilePicture isOnline lastActivityAt")
            .lean();

        return res.json({
            workspace: {
                id: workspace._id,
                name: workspace.name,
                description: workspace.description,
                company: workspace.company,
                createdBy: workspace.createdBy,
                members: workspace.members.length,
                createdAt: workspace.createdAt
            },
            channels,
            tasks,
            updates,
            members
        });

    } catch (err) {
        console.error("GET WORKSPACE DASHBOARD ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = exports;
