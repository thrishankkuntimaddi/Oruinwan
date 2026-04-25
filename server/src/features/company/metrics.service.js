'use strict';

const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');
const Department = require('../../../models/Department');
const Message = require('../messages/message.model.js');
const Task = require('../../../models/Task');
const Channel = require('../channels/channel.model.js');
const logger = require('../../shared/utils/logger');

async function getCompanyAnalytics(companyId) {
    
    const [totalUsers, workspaces, departments, _messages, tasks] = await Promise.all([
        User.countDocuments({ companyId }),
        Workspace.countDocuments({ company: companyId }),
        Department.countDocuments({ company: companyId }),
        Message.countDocuments({ companyId }),
        Task.find({ companyId })
    ]);

    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers = await User.countDocuments({
        companyId,
        lastLogin: { $gte: sevenDaysAgo }
    });

    
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
        open: tasks.filter(t => t.status === 'open' || t.status === 'in-progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed').length
    };

    
    const departmentList = await Department.find({ company: companyId }).lean();
    const departmentStats = await Promise.all(
        departmentList.map(async (dept) => {
            const [memberCount, deptChannels] = await Promise.all([
                User.countDocuments({ companyId, departments: dept._id }),
                
                Channel.find({ company: companyId, department: dept._id }).select('_id').lean(),
            ]);

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

    
    const users = await User.find({ companyId })
        .select('username email profilePicture')
        .lean();

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
