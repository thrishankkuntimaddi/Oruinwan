'use strict';

const org = require('../../identity/queries/org');
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

    
    const taskStats = {
        open: tasks[0],
        completed: tasks[1],
        overdue: tasks[2]
    };

    // Department activity is measured by structure (members, channels), never by messages:
    // messages are end-to-end encrypted and an admin console must not count who says what.
    const departmentList = await org.departments.find({ company: companyId }, { members: false });
    const sizes = new Map((await org.departmentSizes(companyId)).map((d) => [String(d._id), d.members]));
    const departmentStats = await Promise.all(departmentList.map(async (dept) => ({
        name: dept.name,
        memberCount: sizes.get(String(dept._id)) || 0,
        channelCount: await Channel.countDocuments({ company: companyId, department: dept._id }),
    })));

    logger.debug({ companyId, totalUsers, activeUsers }, 'Company analytics computed');

    
    return {
        overview: {
            totalUsers,
            activeUsers,
            totalWorkspaces: workspaces,
            totalDepartments: departments,
            tasksStats: taskStats,
        },
        departmentStats,
        userGrowth: [],      
        activityData: [],    
    };
}

module.exports = {
    getCompanyAnalytics
};
