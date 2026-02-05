// server/controllers/analyticsController.js
const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');
const _Department = require('../../../models/Department');
const Message = require("../messages/message.model.js");
const Channel = require("../channels/channel.model.js");
const _DMSession = require('../../../models/DMSession');

/**
 * GET /api/analytics/company/:companyId
 * Returns comprehensive analytics for the admin dashboard
 */
exports.getCompanyAnalytics = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { timeRange = '30d' } = req.query; // 7d, 30d, 90d

        // Calculate date range
        const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
        const days = daysMap[timeRange] || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // =============================
        // 1. GROWTH ANALYTICS
        // =============================

        // Get all users for the company
        const allUsers = await User.find({ companyId }).lean();
        const totalUsers = allUsers.length;
        const activeUsers = allUsers.filter(u => u.isOnline || (u.lastActivityAt && new Date(u.lastActivityAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))).length;

        // Get all workspaces
        const workspaces = await Workspace.find({ company: companyId }).lean();
        const totalWorkspaces = workspaces.length;

        // Calculate weekly growth data
        const weeksInRange = Math.ceil(days / 7);
        const growthData = [];

        for (let i = weeksInRange - 1; i >= 0; i--) {
            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() - (i * 7));
            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekStart.getDate() - 7);

            const usersUpToWeek = allUsers.filter(u => new Date(u.createdAt) <= weekEnd).length;
            const activeInWeek = allUsers.filter(u =>
                u.lastActivityAt &&
                new Date(u.lastActivityAt) >= weekStart &&
                new Date(u.lastActivityAt) <= weekEnd
            ).length;
            const workspacesUpToWeek = workspaces.filter(w => new Date(w.createdAt) <= weekEnd).length;

            growthData.push({
                name: `Week ${weeksInRange - i}`,
                users: usersUpToWeek,
                active: activeInWeek,
                workspaces: workspacesUpToWeek
            });
        }

        // =============================
        // 2. COLLABORATION ANALYTICS
        // =============================

        // Get messages count by day (last 7 days)
        const collaborationData = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 6; i >= 0; i--) {
            const dayEnd = new Date();
            dayEnd.setDate(dayEnd.getDate() - i);
            dayEnd.setHours(23, 59, 59, 999);

            const dayStart = new Date(dayEnd);
            dayStart.setHours(0, 0, 0, 0);

            // Count messages - need to query across all channels in company workspaces
            const messageCount = await Message.countDocuments({
                workspace: { $in: workspaces.map(w => w._id) },
                createdAt: { $gte: dayStart, $lte: dayEnd }
            });

            // For now, we don't have tasks model, so we'll use a placeholder
            // TODO: Replace with actual task completion count when Task model is available
            const tasksCount = Math.floor(messageCount / 15); // Approximation

            collaborationData.push({
                name: dayNames[dayEnd.getDay()],
                messages: messageCount,
                tasks: tasksCount
            });
        }

        // =============================
        // 3. WORKSPACE HEALTH
        // =============================

        const workspaceHealth = await Promise.all(
            workspaces.slice(0, 10).map(async (ws) => {
                const members = ws.members || [];
                const memberCount = members.length;

                // Get recent activity
                const recentMessages = await Message.countDocuments({
                    workspace: ws._id,
                    createdAt: { $gte: startDate }
                });

                // Calculate active members (those who sent messages recently)
                const activeMemberIds = await Message.distinct('author', {
                    workspace: ws._id,
                    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                });

                const activeRate = memberCount > 0 ? Math.round((activeMemberIds.length / memberCount) * 100) : 0;

                // Get last activity
                const lastMessage = await Message.findOne({
                    workspace: ws._id
                }).sort({ createdAt: -1 }).lean();

                const lastActive = lastMessage ? formatLastActivity(lastMessage.createdAt) : 'No activity';

                // Task completion (placeholder - using message activity as proxy)
                const completion = Math.min(Math.round((recentMessages / memberCount) * 10), 100);

                // Determine status
                let status = 'Inactive';
                if (activeRate > 70 && completion > 60) status = 'Healthy';
                else if (activeRate > 40 || completion > 40) status = 'At Risk';

                return {
                    name: ws.name,
                    members: memberCount,
                    activeRate,
                    lastActive,
                    completion,
                    status
                };
            })
        );

        // =============================
        // 4. CULTURE & ENGAGEMENT
        // =============================

        // Count updates (messages in announcement channels, or specific update channels)
        const updateChannels = await Channel.find({
            company: companyId,
            $or: [
                { name: { $regex: /announcement|update|news/i } }
            ]
        }).lean();

        const updatesPosted = await Message.countDocuments({
            channel: { $in: updateChannels.map(c => c._id) },
            createdAt: { $gte: startDate }
        });

        // Priority updates (messages with @here or @channel mentions)
        const priorityUpdates = await Message.countDocuments({
            channel: { $in: updateChannels.map(c => c._id) },
            createdAt: { $gte: startDate },
            content: { $regex: /@(here|channel|everyone)/i }
        });

        // Average reactions (if we have reactions field)
        // Placeholder for now
        const avgReactions = 4.2;

        // =============================
        // 5. SECURITY METRICS
        // =============================

        // Count users with 2FA (if we have that field)
        // Placeholder for now
        const twoFAEnabled = false; // Will be true when 2FA is implemented
        const ssoStatus = 'Not Configured';
        const loginAnomalies = 0;

        // =============================
        // RESPONSE
        // =============================

        return res.json({
            growth: {
                totalUsers,
                activeUsers,
                totalWorkspaces,
                data: growthData
            },
            collaboration: {
                data: collaborationData
            },
            workspaceHealth,
            culture: {
                updatesPosted,
                priorityUpdates,
                avgReactions
            },
            security: {
                twoFAEnabled,
                ssoStatus,
                loginAnomalies
            }
        });

    } catch (_err) {
        console.error('GET COMPANY ANALYTICS ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Helper function to format last activity time
function formatLastActivity(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

module.exports = exports;
