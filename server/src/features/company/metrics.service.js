'use strict';

const org = require('../../identity/queries/org');
const Message = require('../../modules/messages/message.model.js');
const Tasks = require('../tasks/tasks.query');
const Channel = require('../channels/channel.model.js');
const logger = require('../../shared/utils/logger');

async function getCompanyAnalytics(companyId) {
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Identity counts in one PostgreSQL round trip; tasks still come from the task store.
    const [stats, activeUsers, tasks] = await Promise.all([
        org.companyUserStats(companyId),
        org.users.count({ companyId, lastLoginAt: { $gte: sevenDaysAgo } }),
        // Tasks carry `company` (a `companyId` filter matched nothing) and the
        // statuses todo / in_progress / review / blocked / done / cancelled.
        Promise.all([
            Tasks.countDocuments({ company: companyId, deleted: { $ne: true }, status: { $in: ['backlog', 'todo', 'in_progress', 'review', 'blocked'] } }),
            Tasks.countDocuments({ company: companyId, deleted: { $ne: true }, status: 'done' }),
            Tasks.countDocuments({ company: companyId, deleted: { $ne: true }, dueDate: { $lt: new Date() }, status: { $nin: ['done', 'cancelled'] } }),
        ]),
    ]);
    const totalUsers = stats.users.total;
    const workspaces = stats.workspaces.total;
    const departments = stats.departments;

    
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

    
    const taskStats = {
        open: tasks[0],
        completed: tasks[1],
        overdue: tasks[2]
    };

    
    const departmentList = await org.departments.find({ company: companyId }, { members: false });
    const sizes = new Map((await org.departmentSizes(companyId)).map((d) => [String(d._id), d.members]));
    const departmentStats = await Promise.all(
        departmentList.map(async (dept) => {
            const memberCount = sizes.get(String(dept._id)) || 0;
            const deptChannels = await Channel.find({ company: companyId, department: dept._id }).select('_id').lean();

            const channelIds = deptChannels.map(c => c._id);
            const activityScore = channelIds.length
                ? await Message.countDocuments({ channel: { $in: channelIds }, createdAt: { $gte: weekAgo } })
                : 0;

            return {
                name: dept.name,
                memberCount,
                activityScore,           
                totalMessages: channelIds.length
                    ? await Message.countDocuments({ channel: { $in: channelIds } })
                    : 0,
            };
        })
    );

    
    const users = await org.users.find({ companyId }, { select: 'username email profilePicture' });

    const userActivityCounts = await Promise.all(
        users.map(async (u) => {
            const messageCount = await Message.countDocuments({
                sender: u._id,
                companyId,
                createdAt: { $gte: monthAgo },
            });
            return { ...u, activityCount: messageCount };
        })
    );

    const topUsers = userActivityCounts
        .sort((a, b) => b.activityCount - a.activityCount)
        .slice(0, 10);

    logger.debug({ companyId, totalUsers, activeUsers }, 'Company analytics computed');

    
    return {
        overview: {
            totalUsers,
            activeUsers,
            totalWorkspaces: workspaces,
            totalDepartments: departments,
            messagesCount: {
                today: messagesToday,
                week: messagesWeek,
                month: messagesMonth,
            },
            tasksStats: taskStats,
        },
        departmentStats,
        topUsers,
        userGrowth: [],      
        activityData: [],    
    };
}

module.exports = {
    getCompanyAnalytics
};
