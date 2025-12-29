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

/**
 * Get analytics summary
 * GET /api/dashboard/analytics/summary
 */
exports.getAnalyticsSummary = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { period = 30 } = req.query; // Default 30 days

        const user = await User.findById(userId).populate("companyId");

        if (!user || !user.companyId) {
            return res.status(404).json({ message: "Company not found" });
        }

        // Check if user has viewAnalytics permission
        if (user.companyRole !== "owner" && user.companyRole !== "admin") {
            return res.status(403).json({ message: "Analytics access required" });
        }

        const companyId = user.companyId._id;
        const analyticsService = require("../utils/analyticsService");

        // Get all metrics
        const [
            userGrowth,
            dau,
            wau,
            mau,
            taskMetrics,
            messageMetrics,
            workspaceAnalytics
        ] = await Promise.all([
            analyticsService.calculateUserGrowth(companyId, parseInt(period)),
            analyticsService.calculateActiveUsers(companyId, 'daily'),
            analyticsService.calculateActiveUsers(companyId, 'weekly'),
            analyticsService.calculateActiveUsers(companyId, 'monthly'),
            analyticsService.calculateTaskCompletionRate(companyId, parseInt(period)),
            analyticsService.calculateMessageVolume(companyId, parseInt(period)),
            analyticsService.getWorkspaceAnalytics(companyId)
        ]);

        const totalUsers = await User.countDocuments({ companyId });
        const totalWorkspaces = await Workspace.countDocuments({ company: companyId });
        const totalChannels = await Channel.countDocuments({ company: companyId });

        return res.json({
            summary: {
                totalUsers,
                activeUsers: dau,
                totalWorkspaces,
                totalChannels,
                totalTasks: taskMetrics.total,
                totalMessages: messageMetrics.total,
                userGrowth: userGrowth.growth,
                taskCompletionRate: taskMetrics.completionRate
            },
            engagement: {
                dau,
                wau,
                mau,
                dauWauRatio: wau > 0 ? ((dau / wau) * 100).toFixed(1) : 0
            },
            period: parseInt(period)
        });

    } catch (err) {
        console.error("GET ANALYTICS SUMMARY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Get user activity analytics
 * GET /api/dashboard/analytics/users
 */
exports.getUserActivityAnalytics = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { period = 30 } = req.query;

        const user = await User.findById(userId).populate("companyId");

        if (!user || !user.companyId) {
            return res.status(404).json({ message: "Company not found" });
        }

        if (user.companyRole !== "owner" && user.companyRole !== "admin") {
            return res.status(403).json({ message: "Analytics access required" });
        }

        const companyId = user.companyId._id;
        const analyticsService = require("../utils/analyticsService");

        const days = parseInt(period);
        const now = new Date();
        const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        // Get user activity over time
        const userActivity = await User.aggregate([
            {
                $match: {
                    companyId,
                    lastActivityAt: { $gte: periodStart }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$lastActivityAt" } }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.date": 1 } }
        ]);

        const trendData = analyticsService.generateTrendData(userActivity, days);

        // Get users by role
        const usersByRole = await User.aggregate([
            { $match: { companyId } },
            { $group: { _id: "$companyRole", count: { $sum: 1 } } }
        ]);

        const userGrowth = await analyticsService.calculateUserGrowth(companyId, days);

        return res.json({
            trendData,
            usersByRole,
            growth: userGrowth,
            period: days
        });

    } catch (err) {
        console.error("GET USER ACTIVITY ANALYTICS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Get workspace analytics
 * GET /api/dashboard/analytics/workspaces
 */
exports.getWorkspaceAnalytics = async (req, res) => {
    try {
        const userId = req.user.sub;

        const user = await User.findById(userId).populate("companyId");

        if (!user || !user.companyId) {
            return res.status(404).json({ message: "Company not found" });
        }

        if (user.companyRole !== "owner" && user.companyRole !== "admin") {
            return res.status(403).json({ message: "Analytics access required" });
        }

        const companyId = user.companyId._id;
        const analyticsService = require("../utils/analyticsService");

        const workspaceAnalytics = await analyticsService.getWorkspaceAnalytics(companyId);

        return res.json({
            workspaces: workspaceAnalytics
        });

    } catch (err) {
        console.error("GET WORKSPACE ANALYTICS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Get channel engagement analytics
 * GET /api/dashboard/analytics/channels
 */
exports.getChannelEngagementAnalytics = async (req, res) => {
    try {
        const userId = req.user.sub;

        const user = await User.findById(userId).populate("companyId");

        if (!user || !user.companyId) {
            return res.status(404).json({ message: "Company not found" });
        }

        if (user.companyRole !== "owner" && user.companyRole !== "admin") {
            return res.status(403).json({ message: "Analytics access required" });
        }

        const companyId = user.companyId._id;
        const analyticsService = require("../utils/analyticsService");

        const channelEngagement = await analyticsService.calculateChannelEngagement(companyId);

        return res.json({
            channels: channelEngagement
        });

    } catch (err) {
        console.error("GET CHANNEL ENGAGEMENT ANALYTICS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Get task analytics
 * GET /api/dashboard/analytics/tasks
 */
exports.getTaskAnalytics = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { period = 30 } = req.query;

        const user = await User.findById(userId).populate("companyId");

        if (!user || !user.companyId) {
            return res.status(404).json({ message: "Company not found" });
        }

        if (user.companyRole !== "owner" && user.companyRole !== "admin") {
            return res.status(403).json({ message: "Analytics access required" });
        }

        const companyId = user.companyId._id;
        const analyticsService = require("../utils/analyticsService");

        const taskMetrics = await analyticsService.calculateTaskCompletionRate(companyId, parseInt(period));

        // Get task creation trend
        const days = parseInt(period);
        const now = new Date();
        const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        const taskTrend = await Task.aggregate([
            {
                $match: {
                    company: companyId,
                    createdAt: { $gte: periodStart }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.date": 1 } }
        ]);

        const trendData = analyticsService.generateTrendData(taskTrend, days);

        return res.json({
            metrics: taskMetrics,
            trendData,
            period: days
        });

    } catch (err) {
        console.error("GET TASK ANALYTICS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Get message volume analytics
 * GET /api/dashboard/analytics/messages
 */
exports.getMessageVolumeAnalytics = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { period = 30 } = req.query;

        const user = await User.findById(userId).populate("companyId");

        if (!user || !user.companyId) {
            return res.status(404).json({ message: "Company not found" });
        }

        if (user.companyRole !== "owner" && user.companyRole !== "admin") {
            return res.status(403).json({ message: "Analytics access required" });
        }

        const companyId = user.companyId._id;
        const analyticsService = require("../utils/analyticsService");

        const messageMetrics = await analyticsService.calculateMessageVolume(companyId, parseInt(period));

        const trendData = analyticsService.generateTrendData(messageMetrics.dailyBreakdown, parseInt(period));

        return res.json({
            metrics: messageMetrics,
            trendData,
            period: parseInt(period)
        });

    } catch (err) {
        console.error("GET MESSAGE VOLUME ANALYTICS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Get engagement trends (DAU/WAU/MAU over time)
 * GET /api/dashboard/analytics/engagement
 */
exports.getEngagementTrends = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { period = 30 } = req.query;

        const user = await User.findById(userId).populate("companyId");

        if (!user || !user.companyId) {
            return res.status(404).json({ message: "Company not found" });
        }

        if (user.companyRole !== "owner" && user.companyRole !== "admin") {
            return res.status(403).json({ message: "Analytics access required" });
        }

        const companyId = user.companyId._id;
        const analyticsService = require("../utils/analyticsService");

        const dau = await analyticsService.calculateActiveUsers(companyId, 'daily');
        const wau = await analyticsService.calculateActiveUsers(companyId, 'weekly');
        const mau = await analyticsService.calculateActiveUsers(companyId, 'monthly');

        return res.json({
            dau,
            wau,
            mau,
            dauWauRatio: wau > 0 ? ((dau / wau) * 100).toFixed(1) : 0,
            dauMauRatio: mau > 0 ? ((dau / mau) * 100).toFixed(1) : 0
        });

    } catch (err) {
        console.error("GET ENGAGEMENT TRENDS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = exports;
