// server/controllers/dashboardController.js
const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');
const Message = require("../messages/message.model.js");
const _Channel = require("../channels/channel.model.js");

/**
 * GET /api/dashboard/metrics/:companyId
 * Get real-time dashboard metrics for company
 */
exports.getDashboardMetrics = async (req, res) => {
    try {
        const { companyId } = req.params;
        const userId = req.user.sub;

        // Verify user belongs to this company and has admin rights
        const requestingUser = await User.findById(userId);
        if (!requestingUser) {
            return res.status(401).json({ message: 'User not found' });
        }

        // Check if user's company matches the requested companyId
        if (requestingUser.companyId.toString() !== companyId) {
            return res.status(403).json({ message: 'Access denied: Not authorized for this company' });
        }

        // Check if user is admin/owner
        const adminRoles = ['owner', 'admin'];
        if (!adminRoles.includes(requestingUser.companyRole) && !requestingUser.isCoOwner) {
            return res.status(403).json({ message: 'Access denied: Admin privileges required' });
        }

        // Get today's start (midnight)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Get 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Fetch all workspaces for this company
        const workspaces = await Workspace.find({ company: companyId }).lean();
        const workspaceIds = workspaces.map(w => w._id);

        // Parallel queries for efficiency
        const [
            totalUsers,
            activeUsers,
            messagesToday,
            tasksCompletedToday,
            workspaceHealthData
        ] = await Promise.all([
            // Total users
            User.countDocuments({ companyId }),

            // Active users (7 days)
            User.countDocuments({
                companyId,
                $or: [
                    { isOnline: true },
                    { lastActivityAt: { $gte: sevenDaysAgo } }
                ]
            }),

            // Messages sent today
            Message.countDocuments({
                workspace: { $in: workspaceIds },
                createdAt: { $gte: todayStart }
            }),

            // Tasks completed today (placeholder - will be 0 until Task model exists)
            Promise.resolve(0),

            // Workspace health with activity
            Promise.all(workspaces.map(async (ws) => {
                const lastMessage = await Message.findOne({
                    workspace: ws._id
                }).sort({ createdAt: -1 }).lean();

                const messageCount = await Message.countDocuments({
                    workspace: ws._id,
                    createdAt: { $gte: sevenDaysAgo }
                });

                // Determine if workspace is inactive (no messages in 7 days)
                const isInactive = messageCount === 0;

                // Calculate last activity
                let lastActivity = 'No activity';
                if (lastMessage) {
                    const diffMs = Date.now() - new Date(lastMessage.createdAt).getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMins / 60);
                    const diffDays = Math.floor(diffHours / 24);

                    if (diffMins < 1) lastActivity = 'Just now';
                    else if (diffMins < 60) lastActivity = `${diffMins}m ago`;
                    else if (diffHours < 24) lastActivity = `${diffHours}h ago`;
                    else lastActivity = `${diffDays}d ago`;
                }

                return {
                    _id: ws._id,
                    name: ws.name,
                    members: ws.members, // Include full members array
                    memberCount: ws.members?.length || 0,
                    lastActivity,
                    isInactive,
                    messageCount,
                    openTasks: 0 // Placeholder
                };
            }))
        ]);

        // Get pending invites
        const pendingInvites = await User.find({
            companyId,
            accountStatus: { $in: ['pending', 'invited'] }
        }).select('email createdAt').lean();

        // Get recently joined (last 7 days)
        const recentlyJoined = await User.find({
            companyId,
            createdAt: { $gte: sevenDaysAgo }
        }).select('username email profilePicture createdAt')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        return res.json({
            snapshot: {
                totalUsers,
                activeUsers,
                totalWorkspaces: workspaces.length,
                openTasks: 0 // Placeholder until Task model
            },
            todayActivity: {
                messagesToday,
                tasksCompletedToday,
                meetingsToday: 0 // Placeholder
            },
            workspaceHealth: workspaceHealthData,
            peopleAccess: {
                pendingInvites,
                recentlyJoined
            }
        });

    } catch (err) {
        return res.status(500).json({
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Placeholder functions for other routes (to be implemented)
exports.getAdminDashboard = async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
};

exports.getWorkspaceDashboard = async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
};

exports.getAnalyticsSummary = async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
};

exports.getUserActivityAnalytics = async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
};

exports.getWorkspaceAnalytics = async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
};

exports.getChannelEngagementAnalytics = async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
};

exports.getTaskAnalytics = async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
};

exports.getMessageVolumeAnalytics = async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
};

exports.getEngagementTrends = async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
};

