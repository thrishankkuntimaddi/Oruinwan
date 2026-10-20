const org = require('../../identity/queries/org');
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

// Privacy: nothing here counts or reads messages. Messages are end-to-end encrypted and the
// product promise is that only the participants read them, so the company console works
// from non-message aggregates only: people, sign-ins, workspaces, departments, tasks, updates.

/** One { start, end } bucket per calendar day (UTC) for the last `days` days, oldest first. */
function dayBuckets(days) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
        out.push({ date, start: new Date(`${date}T00:00:00.000Z`), end: new Date(`${date}T23:59:59.999Z`) });
    }
    return out;
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


        
        totalTasks,
        completedTasks,
        openTasks,
        overdueTasks,

        
        signedInUsers,

        
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


        
        Tasks.countDocuments({ company: companyId }),
        Tasks.countDocuments({ company: companyId, status: { $in: ['done', 'completed'] } }),
        Tasks.countDocuments({ company: companyId, status: { $nin: ['done', 'completed', 'cancelled'] } }),
        Tasks.countDocuments({ company: companyId, dueDate: { $lt: new Date() }, status: { $nin: ['done', 'completed', 'cancelled'] } }),

        
        org.users.count({ companyId, accountStatus: 'active', lastLoginAt: { $gte: from } }),

        
        org.users.count({ companyId, createdAt: { $gte: from }, accountStatus: { $ne: 'removed' } }),

        
        require('../../../models/Update').countDocuments({ company: companyId, isDeleted: false }),
        require('../../../models/Update').countDocuments({ company: companyId, isDeleted: false, createdAt: { $gte: from } }),
    ]);

    

    const taskCompletionRate = totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

    // Share of people who signed in during the period (a sign-in event, not message activity).
    const engagementScore = totalEmployees > 0
        ? Math.round((signedInUsers / totalEmployees) * 100)
        : 0;

    
    const departmentBreakdown = (await org.departmentSizes(companyId))
        .map((d) => ({ _id: d._id, name: d.name, memberCount: d.members }))
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(0, 5);

    
    // Largest workspaces by active members (structure, not usage).
    const workspaceSizes = (await org.workspaces.find({ company: companyId }))
        .map((w) => ({ workspaceId: w._id, name: w.name, memberCount: (w.members || []).filter((m) => m.status === 'active').length }))
        .sort((x, y) => y.memberCount - x.memberCount)
        .slice(0, 5);
    
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
            workspaceSizes,
        },

        tasks: {
            total: totalTasks,
            open: openTasks,
            completed: completedTasks,
            overdue: overdueTasks,
            taskCompletionRate,
        },

        engagement: {
            activeUsers: signedInUsers,
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
    const buckets = dayBuckets(7);

    const [
        taskCreatedLast7Days,
        activeUsers,
        newInvites,
        updatesPosted,
        perDay,
    ] = await Promise.all([
        Tasks.countDocuments({ company: companyId, createdAt: { $gte: from } }),
        org.users.count({ companyId, accountStatus: 'active', lastLoginAt: { $gte: from } }),
        org.users.count({ companyId, accountStatus: 'invited', createdAt: { $gte: from } }),
        require('../../../models/Update').countDocuments({ company: companyId, isDeleted: false, createdAt: { $gte: from } }),
        Tasks.countBuckets({ company: companyId }, 'createdAt', buckets).catch(() => buckets.map(() => 0)),
    ]);

    // Tasks created per day, company-wide.
    const dailyActivity = buckets.map((b, i) => ({ date: b.date, taskCount: perDay[i] || 0 }));

    return {
        period: { from, to: new Date() },
        tasksCreatedLast7Days: taskCreatedLast7Days,
        activeUsers,
        newInvites,
        updatesPosted,
        dailyActivity,
    };
}

module.exports = { getCompanyAnalytics, getActivityAnalytics };
