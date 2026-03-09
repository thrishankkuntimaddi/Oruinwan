// server/src/features/company-analytics/analytics.service.js
//
// Phase 6 — Company Analytics
// Aggregate COUNTS only — no message contents read.
// All queries are company-scoped and use indexed fields.

const User = require('../../../models/User');
const Department = require('../../../models/Department');
const Workspace = require('../../../models/Workspace');
const Message = require('../../features/messages/message.model');
const Task = require('../../../models/Task');

// ============================================================================
// TIME RANGE HELPER
// ============================================================================

function since(range) {
    const now = new Date();
    switch (range) {
        case '7d': return new Date(now - 7 * 864e5);
        case '90d': return new Date(now - 90 * 864e5);
        case '30d':
        default: return new Date(now - 30 * 864e5);
    }
}

// ============================================================================
// MAIN AGGREGATOR
// ============================================================================

/**
 * Returns a snapshot of company health metrics.
 * All queries hit indexed fields only — never reads message text/payload.
 *
 * @param {string} companyId
 * @param {string} timeRange  '7d' | '30d' | '90d'
 */
async function getCompanyAnalytics(companyId, timeRange = '30d') {
    const from = since(timeRange);

    // ── Run all counts in parallel ──────────────────────────────────────────
    const [
        totalEmployees,
        activeEmployees,
        invitedEmployees,
        suspendedEmployees,
        totalDepartments,
        totalWorkspaces,
        activeWorkspaces,

        // Message volume — count only, no text read
        totalMessages,
        recentMessages,
        channelMessages,
        dmMessages,

        // Task counts
        totalTasks,
        completedTasks,
        openTasks,
        overdueTasks,

        // Activity: unique members who sent a message in timeRange
        activeMessageSenders,

        // New hires in timeRange
        newHires,

        // Updates posted
        totalUpdates,
        recentUpdates,
    ] = await Promise.all([
        // ── Employees ───────────────────────────────────────────────────────
        User.countDocuments({ companyId, accountStatus: { $ne: 'removed' } }),
        User.countDocuments({ companyId, accountStatus: 'active' }),
        User.countDocuments({ companyId, accountStatus: 'invited' }),
        User.countDocuments({ companyId, accountStatus: 'suspended' }),

        // ── Org Structure ───────────────────────────────────────────────────
        Department.countDocuments({ company: companyId, isActive: true }),

        // ── Workspaces ──────────────────────────────────────────────────────
        Workspace.countDocuments({ company: companyId }),
        Workspace.countDocuments({ company: companyId, isActive: true, isArchived: false }),

        // ── Messages (counts only — no content projected) ───────────────────
        Message.countDocuments({ company: companyId, isDeleted: false }),
        Message.countDocuments({ company: companyId, isDeleted: false, createdAt: { $gte: from } }),
        Message.countDocuments({ company: companyId, isDeleted: false, channel: { $ne: null } }),
        Message.countDocuments({ company: companyId, isDeleted: false, dm: { $ne: null } }),

        // ── Tasks ────────────────────────────────────────────────────────────
        Task.countDocuments({ company: companyId }),
        Task.countDocuments({ company: companyId, status: { $in: ['done', 'completed'] } }),
        Task.countDocuments({ company: companyId, status: { $nin: ['done', 'completed', 'cancelled'] } }),
        Task.countDocuments({ company: companyId, dueDate: { $lt: new Date() }, status: { $nin: ['done', 'completed', 'cancelled'] } }),

        // ── Engagement: unique active message senders in period ─────────────
        Message.distinct('sender', { company: companyId, isDeleted: false, createdAt: { $gte: from } })
            .then(ids => ids.length),

        // ── Growth: users who joined in timeRange ───────────────────────────
        User.countDocuments({ companyId, createdAt: { $gte: from }, accountStatus: { $ne: 'removed' } }),

        // ── Company Updates ─────────────────────────────────────────────────
        require('../../../models/Update').countDocuments({ company: companyId, isDeleted: false }),
        require('../../../models/Update').countDocuments({ company: companyId, isDeleted: false, createdAt: { $gte: from } }),
    ]);

    // ── Derived metrics ─────────────────────────────────────────────────────

    const taskCompletionRate = totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

    const engagementScore = totalEmployees > 0
        ? Math.round((activeMessageSenders / totalEmployees) * 100)
        : 0;

    const messageGrowthRate = totalMessages > 0
        ? Math.round((recentMessages / totalMessages) * 100)
        : 0;

    // ── Department breakdown (top 5 by member count) ─────────────────────────
    const departmentBreakdown = await Department.aggregate([
        { $match: { company: require('mongoose').Types.ObjectId.createFromHexString(companyId.toString()), isActive: true } },
        { $project: { name: 1, memberCount: { $size: '$members' } } },
        { $sort: { memberCount: -1 } },
        { $limit: 5 },
    ]);

    // ── Workspace activity breakdown ─────────────────────────────────────────
    const workspaceActivity = await Message.aggregate([
        { $match: { company: require('mongoose').Types.ObjectId.createFromHexString(companyId.toString()), isDeleted: false, createdAt: { $gte: from }, workspace: { $ne: null } } },
        { $group: { _id: '$workspace', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'workspaces', localField: '_id', foreignField: '_id', as: 'ws' } },
        { $unwind: { path: '$ws', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, workspaceId: '$_id', name: { $ifNull: ['$ws.name', 'Unknown'] }, messageCount: '$count' } },
    ]);

    // ── Role distribution ────────────────────────────────────────────────────
    const roleDistribution = await User.aggregate([
        { $match: { companyId: require('mongoose').Types.ObjectId.createFromHexString(companyId.toString()), accountStatus: { $ne: 'removed' } } },
        { $group: { _id: '$companyRole', count: { $sum: 1 } } },
        { $project: { _id: 0, role: '$_id', count: 1 } },
        { $sort: { count: -1 } },
    ]);

    // ── Assemble response ────────────────────────────────────────────────────
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

module.exports = { getCompanyAnalytics };
