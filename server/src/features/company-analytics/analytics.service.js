const User = require('../../../models/User');
const Department = require('../../../models/Department');
const Workspace = require('../../../models/Workspace');
const Message = require('../../features/messages/message.model');
const Task = require('../../../models/Task');

function since(range) {
    const now = new Date();
    switch (range) {
        case '7d': return new Date(now - 7 * 864e5);
        case '90d': return new Date(now - 90 * 864e5);
        case '30d':
        default: return new Date(now - 30 * 864e5);
    }
}

async function getCompanyAnalytics(companyId, timeRange = '30d') {
    const from = since(timeRange);

    
    const [
        totalEmployees,
        activeEmployees,
        invitedEmployees,
        suspendedEmployees,
        totalDepartments,
        totalWorkspaces,
        activeWorkspaces,

        
        totalMessages,
        recentMessages,
        channelMessages,
        dmMessages,

        
        totalTasks,
        completedTasks,
        openTasks,
        overdueTasks,

        
        activeMessageSenders,

        
        newHires,

        
        totalUpdates,
        recentUpdates,
    ] = await Promise.all([
        
        User.countDocuments({ companyId, accountStatus: { $ne: 'removed' } }),
        User.countDocuments({ companyId, accountStatus: 'active' }),
        User.countDocuments({ companyId, accountStatus: 'invited' }),
        User.countDocuments({ companyId, accountStatus: 'suspended' }),

        
        Department.countDocuments({ company: companyId, isActive: true }),

        
        Workspace.countDocuments({ company: companyId }),
        Workspace.countDocuments({ company: companyId, isActive: true, isArchived: false }),

        
        Message.countDocuments({ company: companyId, isDeleted: false }),
        Message.countDocuments({ company: companyId, isDeleted: false, createdAt: { $gte: from } }),
        Message.countDocuments({ company: companyId, isDeleted: false, channel: { $ne: null } }),
        Message.countDocuments({ company: companyId, isDeleted: false, dm: { $ne: null } }),

        
        Task.countDocuments({ company: companyId }),
        Task.countDocuments({ company: companyId, status: { $in: ['done', 'completed'] } }),
        Task.countDocuments({ company: companyId, status: { $nin: ['done', 'completed', 'cancelled'] } }),
        Task.countDocuments({ company: companyId, dueDate: { $lt: new Date() }, status: { $nin: ['done', 'completed', 'cancelled'] } }),

        
        Message.distinct('sender', { company: companyId, isDeleted: false, createdAt: { $gte: from } })
            .then(ids => ids.length),

        
        User.countDocuments({ companyId, createdAt: { $gte: from }, accountStatus: { $ne: 'removed' } }),

        
        require('../../../models/Update').countDocuments({ company: companyId, isDeleted: false }),
        require('../../../models/Update').countDocuments({ company: companyId, isDeleted: false, createdAt: { $gte: from } }),
    ]);

    

    const taskCompletionRate = totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

    const engagementScore = totalEmployees > 0
        ? Math.round((activeMessageSenders / totalEmployees) * 100)
        : 0;

    const messageGrowthRate = totalMessages > 0
        ? Math.round((recentMessages / totalMessages) * 100)
        : 0;

    
    const departmentBreakdown = await Department.aggregate([
        { $match: { company: require('mongoose').Types.ObjectId.createFromHexString(companyId.toString()), isActive: true } },
        { $project: { name: 1, memberCount: { $size: '$members' } } },
        { $sort: { memberCount: -1 } },
        { $limit: 5 },
    ]);

    
    const workspaceActivity = await Message.aggregate([
        { $match: { company: require('mongoose').Types.ObjectId.createFromHexString(companyId.toString()), isDeleted: false, createdAt: { $gte: from }, workspace: { $ne: null } } },
        { $group: { _id: '$workspace', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'workspaces', localField: '_id', foreignField: '_id', as: 'ws' } },
        { $unwind: { path: '$ws', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, workspaceId: '$_id', name: { $ifNull: ['$ws.name', 'Unknown'] }, messageCount: '$count' } },
    ]);

    
    const roleDistribution = await User.aggregate([
        { $match: { companyId: require('mongoose').Types.ObjectId.createFromHexString(companyId.toString()), accountStatus: { $ne: 'removed' } } },
        { $group: { _id: '$companyRole', count: { $sum: 1 } } },
        { $project: { _id: 0, role: '$_id', count: 1 } },
        { $sort: { count: -1 } },
    ]);

    
    return {
        timeRange,
        period: { from, to: new Date() },

        employees: {
            total: totalEmployees,
            active: activeEmployees,
            invited: invitedEmployees,
            suspended: suspendedEmployees,
            newHires,
            roleDistribution,
        },

        orgStructure: {
            departments: totalDepartments,
            departmentBreakdown,
        },

        workspaces: {
            total: totalWorkspaces,
            active: activeWorkspaces,
            workspaceActivity,
        },

        messages: {
            total: totalMessages,
            recent: recentMessages,
            channelMessages,
            dmMessages,
            messageGrowthRate,
        },

        tasks: {
            total: totalTasks,
            open: openTasks,
            completed: completedTasks,
            overdue: overdueTasks,
            taskCompletionRate,
        },

        engagement: {
            activeUsers: activeMessageSenders,
            engagementScore,
        },

        updates: {
            total: totalUpdates,
            recent: recentUpdates,
        },
    };
}

async function getActivityAnalytics(companyId) {
    const from = since('7d');
    const mongoose = require('mongoose');
    const cid = mongoose.Types.ObjectId.createFromHexString(companyId.toString());

    const [
        messageLast7Days,
        taskCreatedLast7Days,
        activeUsers,
        newInvites,
        updatesPosted,
    ] = await Promise.all([
        Message.countDocuments({ company: companyId, isDeleted: false, createdAt: { $gte: from } }),
        Task.countDocuments({ company: companyId, createdAt: { $gte: from } }),
        
        Message.distinct('sender', { company: companyId, isDeleted: false, createdAt: { $gte: from } })
            .then(ids => ids.length),
        User.countDocuments({ companyId, accountStatus: 'invited', createdAt: { $gte: from } }),
        require('../../../models/Update').countDocuments({ company: companyId, isDeleted: false, createdAt: { $gte: from } }),
    ]);

    
    const dailyActivity = await Message.aggregate([
        {
            $match: {
                company: cid,
                isDeleted: false,
                createdAt: { $gte: from },
            },
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', messageCount: '$count' } },
    ]);

    return {
        period: { from, to: new Date() },
        messagesLast7Days: messageLast7Days,
        tasksCreatedLast7Days: taskCreatedLast7Days,
        activeUsers,
        newInvites,
        updatesPosted,
        dailyActivity,
    };
}

module.exports = { getCompanyAnalytics, getActivityAnalytics };
