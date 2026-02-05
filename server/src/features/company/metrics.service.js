/**
 * Metrics Service - Company Analytics and Reporting
 * 
 * Provides analytics data for company dashboards including user stats,
 * message activity, task tracking, and department performance.
 * Extracted from companyController.js for better organization.
 * 
 * @module features/company/metrics.service
 */

const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');
const Department = require('../../../models/Department');
const Message = require("../messages/message.model.js");
const Task = require('../../../models/Task');

/**
 * Get comprehensive company analytics
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Analytics object with overview, department stats, and user activity
 */
async function getCompanyAnalytics(companyId) {
    // Get basic counts (parallel for speed)
    const [totalUsers, workspaces, departments, _messages, tasks] = await Promise.all([
        User.countDocuments({ companyId }),
        Workspace.countDocuments({ company: companyId }),
        Department.countDocuments({ company: companyId }),
        Message.countDocuments({ companyId }),
        Task.find({ companyId })
    ]);

    // Count active users (logged in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers = await User.countDocuments({
        companyId,
        lastLogin: { $gte: sevenDaysAgo }
    });

    // Messages stats (today, week, month)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [messagesToday, messagesWeek, messagesMonth] = await Promise.all([
        Message.countDocuments({
            companyId,
            createdAt: { $gte: today }
        }),
        Message.countDocuments({
            companyId,
            createdAt: { $gte: weekAgo }
        }),
        Message.countDocuments({
            companyId,
            createdAt: { $gte: monthAgo }
        })
    ]);

    // Task stats (open, completed, overdue)
    const taskStats = {
        open: tasks.filter(t => t.status === 'open' || t.status === 'in-progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed').length
    };

    // Department stats with member counts
    const departmentList = await Department.find({ company: companyId }).lean();
    const departmentStats = await Promise.all(
        departmentList.map(async (dept) => {
            const memberCount = await User.countDocuments({
                companyId,
                departments: dept._id
            });

            return {
                name: dept.name,
                memberCount,
                activityScore: Math.floor(Math.random() * 100), // TODO: Implement real activity tracking
                score: Math.floor(Math.random() * 500) // TODO: Implement real scoring
            };
        })
    );

    // Top users by activity
    const users = await User.find({ companyId })
        .select('username email')
        .limit(10)
        .lean();

    const topUsers = users.map(u => ({
        ...u,
        activityCount: Math.floor(Math.random() * 100) // TODO: Implement real activity tracking
    })).sort((a, b) => b.activityCount - a.activityCount);

    // Return comprehensive analytics
    return {
        overview: {
            totalUsers,
            activeUsers,
            totalWorkspaces: workspaces,
            totalDepartments: departments,
            messagesCount: {
                today: messagesToday,
                week: messagesWeek,
                month: messagesMonth
            },
            tasksStats: taskStats
        },
        departmentStats,
        topUsers,
        userGrowth: [], // TODO: Implement user growth chart data
        activityData: [] // TODO: Implement activity chart data
    };
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    getCompanyAnalytics
};
