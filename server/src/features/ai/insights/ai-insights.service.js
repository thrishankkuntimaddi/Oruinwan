'use strict';

const Message  = require('../../messages/message.model');
const logger   = require('../../../../utils/logger');

let TaskModel = null;
try { TaskModel = require('../../../../models/Task'); } catch { TaskModel = null; }

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

async function getProductivityInsights(workspaceId, days = 7) {
    const since = daysAgo(days);

    const [messageCount, taskStats, activeUserIds] = await Promise.all([
        
        Message.countDocuments({
            workspace:  workspaceId,
            createdAt:  { $gte: since },
            isDeleted:  { $ne: true },
            type:       { $in: ['message', 'checklist'] },
        }),

        
        TaskModel
            ? Promise.all([
                TaskModel.countDocuments ? TaskModel.countDocuments({ workspaceId, createdAt: { $gte: since } }).catch(() => 0) : Promise.resolve(0),
                TaskModel.countDocuments ? TaskModel.countDocuments({ workspaceId, status: { $in: ['done', 'completed'] }, updatedAt: { $gte: since } }).catch(() => 0) : Promise.resolve(0),
              ])
            : Promise.resolve([0, 0]),

        
        Message.distinct('sender', {
            workspace:  workspaceId,
            createdAt:  { $gte: since },
            isDeleted:  { $ne: true },
        }),
    ]);

    const [tasksCreated, tasksCompleted] = Array.isArray(taskStats) ? taskStats : [0, 0];

    return {
        period:         `Last ${days} days`,
        messageCount,
        activeUsers:    activeUserIds.length,
        tasksCreated,
        tasksCompleted,
        completionRate: tasksCreated > 0 ? Math.round((tasksCompleted / tasksCreated) * 100) : 0,
    };
}

async function getCollaborationInsights(workspaceId, days = 7) {
    const since = daysAgo(days);
    const mongoose = require('mongoose');

    
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
        return { period: `Last ${days} days`, topChannels: [], activeThreads: 0, totalReplies: 0 };
    }

    const channelActivity = await Message.aggregate([
        {
            $match: {
                workspace:  mongoose.Types.ObjectId.createFromHexString(workspaceId),
                channel:    { $ne: null },
                createdAt:  { $gte: since },
                isDeleted:  { $ne: true },
            },
        },
        { $group: { _id: '$channel', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
    ]);

    const threadCount = await Message.countDocuments({
        workspace:  workspaceId,
        parentId:   { $ne: null },
        createdAt:  { $gte: since },
    });

    return {
        period:          `Last ${days} days`,
        topChannels:     channelActivity.map(c => ({ channelId: c._id, messageCount: c.count })),
        activeThreads:   Math.floor(threadCount / 3), 
        totalReplies:    threadCount,
    };
}

async function getEngagementInsights(workspaceId, days = 7) {
    const since = daysAgo(days);
    const mongoose = require('mongoose');

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
        return { period: `Last ${days} days`, topContributors: [] };
    }

    const perUser = await Message.aggregate([
        {
            $match: {
                workspace:  mongoose.Types.ObjectId.createFromHexString(workspaceId),
                createdAt:  { $gte: since },
                isDeleted:  { $ne: true },
                type:       { $in: ['message', 'checklist'] },
            },
        },
        { $group: { _id: '$sender', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
    ]);

    return {
        period:      `Last ${days} days`,
        topContributors: perUser.map((u, i) => ({
            rank:     i + 1,
            userId:   u._id,
            messages: u.count,
        })),
    };
}

async function detectAnomalies(workspaceId) {
    const now   = daysAgo(0);
    const week1 = daysAgo(7);
    const week2 = daysAgo(14);

    const [recentCount, priorCount] = await Promise.all([
        Message.countDocuments({ workspace: workspaceId, createdAt: { $gte: week1, $lte: now },  isDeleted: { $ne: true } }),
        Message.countDocuments({ workspace: workspaceId, createdAt: { $gte: week2, $lt: week1 }, isDeleted: { $ne: true } }),
    ]);

    const anomalies = [];
    if (priorCount > 0) {
        const change = ((recentCount - priorCount) / priorCount) * 100;
        if (change < -50) {
            anomalies.push({
                type:    'activity_drop',
                message: `Message activity dropped by ${Math.abs(Math.round(change))}% vs last week`,
                severity:'high',
                data:    { recentCount, priorCount, changePercent: Math.round(change) },
            });
        } else if (change < -25) {
            anomalies.push({
                type:    'activity_decline',
                message: `Message activity declined by ${Math.abs(Math.round(change))}% vs last week`,
                severity:'medium',
                data:    { recentCount, priorCount, changePercent: Math.round(change) },
            });
        }
    }

    if (recentCount === 0) {
        anomalies.push({
            type:    'inactive_workspace',
            message: 'No messages in the last 7 days — workspace appears inactive',
            severity:'high',
            data:    { recentCount },
        });
    }

    return {
        anomalies,
        summary: anomalies.length === 0 ? 'No anomalies detected — workspace activity looks healthy 🟢' : `${anomalies.length} anomaly(s) detected`,
        recentCount,
        priorCount,
    };
}

module.exports = { getProductivityInsights, getCollaborationInsights, getEngagementInsights, detectAnomalies };
