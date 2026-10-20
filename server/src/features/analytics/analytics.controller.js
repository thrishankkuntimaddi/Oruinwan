const logger = require('../../../utils/logger');
const org = require('../../identity/queries/org');
const Tasks = require('../tasks/tasks.query');

// Privacy: no message counts, senders or content. Messages are end-to-end encrypted and only
// their participants read them; company analytics use people, workspaces and tasks only.

exports.getCompanyAnalytics = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { timeRange = '30d' } = req.query; 

        
        const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
        const days = daysMap[timeRange] || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        
        
        

        
        const allUsers = await org.users.find({ companyId }, { select: 'isOnline lastActivityAt createdAt' });
        const totalUsers = allUsers.length;
        const activeUsers = allUsers.filter(u => u.isOnline || (u.lastActivityAt && new Date(u.lastActivityAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))).length;

        
        const workspaces = (await org.workspaces.find({ company: companyId }))
            .map((w) => ({ ...w, members: (w.members || []).filter((m) => m.status === 'active') }));
        const totalWorkspaces = workspaces.length;

        
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

        
        
        

        
        // Tasks created and completed per day over the last week, company-wide.
        const collaborationData = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const live = { company: companyId, deleted: { $ne: true } };
        for (let i = 6; i >= 0; i--) {
            const dayEnd = new Date();
            dayEnd.setDate(dayEnd.getDate() - i);
            dayEnd.setHours(23, 59, 59, 999);
            const dayStart = new Date(dayEnd);
            dayStart.setHours(0, 0, 0, 0);
            const [created, completed] = await Promise.all([
                Tasks.countDocuments({ ...live, createdAt: { $gte: dayStart, $lte: dayEnd } }),
                Tasks.countDocuments({ ...live, completedAt: { $gte: dayStart, $lte: dayEnd } }),
            ]);
            collaborationData.push({ name: dayNames[dayEnd.getDay()], tasks: created, completed });
        }

        // Workspace health from structure and tasks: members, open and finished tasks.
        const workspaceHealth = await Promise.all(
            workspaces.slice(0, 10).map(async (ws) => {
                const memberCount = (ws.members || []).length;
                const wsLive = { workspace: ws._id, deleted: { $ne: true } };
                const [total, done] = await Promise.all([
                    Tasks.countDocuments({ ...wsLive, createdAt: { $gte: startDate } }),
                    Tasks.countDocuments({ ...wsLive, status: 'done', createdAt: { $gte: startDate } }),
                ]);
                const completion = total > 0 ? Math.round((done / total) * 100) : 0;
                return {
                    name: ws.name,
                    members: memberCount,
                    tasks: total,
                    completion,
                    lastActive: ws.updatedAt ? formatLastActivity(ws.updatedAt) : 'No activity',
                };
            })
        );

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
        });

    } catch (err) {
        logger.error('GET COMPANY ANALYTICS ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

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
