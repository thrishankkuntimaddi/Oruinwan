const org = require('../../identity/queries/org');
const Message = require('../../modules/messages/message.model');
const Tasks = require('../tasks/tasks.query');

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
        
        org.users.count({ companyId, accountStatus: { $ne: 'removed' } }),
        org.users.count({ companyId, accountStatus: 'active' }),
        org.users.count({ companyId, accountStatus: 'invited' }),
        org.users.count({ companyId, accountStatus: 'suspended' }),

        org.departments.count({ company: companyId, isActive: true }),

        org.workspaces.count({ company: companyId }),
        org.workspaces.count({ company: companyId, isActive: true, isArchived: false }),

        
        Message.countDocuments({ company: companyId, isDeleted: false }),
        Message.countDocuments({ company: companyId, isDeleted: false, createdAt: { $gte: from } }),
        Message.countDocuments({ company: companyId, isDeleted: false, channel: { $ne: null } }),
        Message.countDocuments({ company: companyId, isDeleted: false, dm: { $ne: null } }),

        
        Tasks.countDocuments({ company: companyId }),
        Tasks.countDocuments({ company: companyId, status: { $in: ['done', 'completed'] } }),
        Tasks.countDocuments({ company: companyId, status: { $nin: ['done', 'completed', 'cancelled'] } }),
        Tasks.countDocuments({ company: companyId, dueDate: { $lt: new Date() }, status: { $nin: ['done', 'completed', 'cancelled'] } }),

        
        Message.distinct('sender', { company: companyId, isDeleted: false, createdAt: { $gte: from } })
            .then(ids => ids.length),

        
        org.users.count({ companyId, createdAt: { $gte: from }, accountStatus: { $ne: 'removed' } }),

        
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

    
    const departmentBreakdown = (await org.departmentSizes(companyId))
        .map((d) => ({ _id: d._id, name: d.name, memberCount: d.members }))
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(0, 5);

    
    const workspaceActivity = await Message.aggregate([
        { $match: { company: require('mongoose').Types.ObjectId.createFromHexString(companyId.toString()), isDeleted: false, createdAt: { $gte: from }, workspace: { $ne: null } } },
        { $group: { _id: '$workspace', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
    ]).then(async (rows) => {
        // Workspace names come from PostgreSQL.
        const names = new Map((await org.workspaces.find({ _id: { $in: rows.map((r) => String(r._id)) } }, { members: false }))
            .map((w) => [String(w._id), w.name]));
        return rows.map((r) => ({ workspaceId: r._id, name: names.get(String(r._id)) || 'Unknown', messageCount: r.count }));
    });

    
    const roleDistribution = Object.entries(await org.roleDistribution(companyId))
        .map(([role, count]) => ({ role, count }))
        .sort((a, b) => b.count - a.count);

    
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
        Tasks.countDocuments({ company: companyId, createdAt: { $gte: from } }),
        
        Message.distinct('sender', { company: companyId, isDeleted: false, createdAt: { $gte: from } })
            .then(ids => ids.length),
        org.users.count({ companyId, accountStatus: 'invited', createdAt: { $gte: from } }),
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
