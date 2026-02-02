// server/utils/analyticsService.js

const User = require("../models/User");
const Workspace = require("../models/Workspace");
const Channel = require("../src/features/channels/channel.model");
const Message = require("../src/features/messages/message.model");
const Task = require("../models/Task");
const Analytics = require("../models/Analytics");

/**
 * Analytics Service
 * Utility functions for calculating analytics metrics
 */

/**
 * Calculate user growth percentage for a given period
 * @param {ObjectId} companyId - Company ID
 * @param {Number} days - Number of days to look back
 * @returns {Object} { current, previous, growth }
 */
exports.calculateUserGrowth = async (companyId, days = 30) => {
    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

    const currentCount = await User.countDocuments({
        companyId,
        createdAt: { $gte: periodStart, $lte: now }
    });

    const previousCount = await User.countDocuments({
        companyId,
        createdAt: { $gte: previousPeriodStart, $lt: periodStart }
    });

    const growth = previousCount > 0
        ? ((currentCount - previousCount) / previousCount) * 100
        : currentCount > 0 ? 100 : 0;

    return {
        current: currentCount,
        previous: previousCount,
        growth: Math.round(growth * 10) / 10
    };
};

/**
 * Calculate active users (DAU/WAU/MAU)
 * @param {ObjectId} companyId - Company ID
 * @param {String} period - 'daily', 'weekly', or 'monthly'
 * @returns {Number} Active user count
 */
exports.calculateActiveUsers = async (companyId, period = 'daily') => {
    const now = new Date();
    let startDate;

    switch (period) {
        case 'daily':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case 'weekly':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'monthly':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const activeUsers = await User.countDocuments({
        companyId,
        lastActivityAt: { $gte: startDate }
    });

    return activeUsers;
};

/**
 * Calculate channel engagement score
 * @param {ObjectId} companyId - Company ID
 * @param {ObjectId} channelId - Channel ID (optional, for specific channel)
 * @returns {Object} Engagement metrics
 */
exports.calculateChannelEngagement = async (companyId, channelId = null) => {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const matchStage = channelId
        ? { company: companyId, channel: channelId, createdAt: { $gte: last7Days } }
        : { company: companyId, channel: { $ne: null }, createdAt: { $gte: last7Days } };

    const channelEngagement = await Message.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: "$channel",
                messageCount: { $sum: 1 },
                uniqueUsers: { $addToSet: "$sender" }
            }
        },
        {
            $lookup: {
                from: "channels",
                localField: "_id",
                foreignField: "_id",
                as: "channelData"
            }
        },
        { $unwind: "$channelData" },
        {
            $project: {
                channelId: "$_id",
                name: "$channelData.name",
                messageCount: 1,
                memberCount: { $size: "$channelData.members" },
                activeUsers: { $size: "$uniqueUsers" },
                engagementScore: {
                    $cond: [
                        { $gt: [{ $size: "$channelData.members" }, 0] },
                        { $divide: ["$messageCount", { $size: "$channelData.members" }] },
                        0
                    ]
                }
            }
        },
        { $sort: { engagementScore: -1 } },
        { $limit: 10 }
    ]);

    return channelEngagement;
};

/**
 * Calculate task completion rate and metrics
 * @param {ObjectId} companyId - Company ID
 * @param {Number} days - Number of days to look back
 * @returns {Object} Task metrics
 */
exports.calculateTaskCompletionRate = async (companyId, days = 30) => {
    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const taskStats = await Task.aggregate([
        {
            $match: {
                company: companyId,
                createdAt: { $gte: periodStart }
            }
        },
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 }
            }
        }
    ]);

    const statusCounts = {
        todo: 0,
        'in-progress': 0,
        review: 0,
        done: 0,
        cancelled: 0
    };

    taskStats.forEach(stat => {
        statusCounts[stat._id] = stat.count;
    });

    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    const completed = statusCounts.done;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    // Calculate average completion time
    const completedTasks = await Task.find({
        company: companyId,
        status: 'done',
        completedAt: { $ne: null },
        createdAt: { $gte: periodStart }
    }).select('createdAt completedAt');

    let totalCompletionTime = 0;
    completedTasks.forEach(task => {
        const timeToComplete = task.completedAt - task.createdAt;
        totalCompletionTime += timeToComplete;
    });

    const averageCompletionTime = completedTasks.length > 0
        ? totalCompletionTime / completedTasks.length / (1000 * 60 * 60) // Convert to hours
        : 0;

    return {
        total,
        completed,
        inProgress: statusCounts['in-progress'],
        todo: statusCounts.todo,
        review: statusCounts.review,
        cancelled: statusCounts.cancelled,
        completionRate: Math.round(completionRate * 10) / 10,
        averageCompletionTime: Math.round(averageCompletionTime * 10) / 10,
        byStatus: statusCounts
    };
};

/**
 * Calculate message volume statistics
 * @param {ObjectId} companyId - Company ID
 * @param {Number} days - Number of days to look back
 * @returns {Object} Message volume metrics
 */
exports.calculateMessageVolume = async (companyId, days = 30) => {
    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const messageStats = await Message.aggregate([
        {
            $match: {
                company: companyId,
                createdAt: { $gte: periodStart }
            }
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    type: {
                        $cond: [{ $ne: ["$channel", null] }, "channel", "dm"]
                    }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id.date": 1 } }
    ]);

    // Calculate total messages
    const totalMessages = await Message.countDocuments({
        company: companyId,
        createdAt: { $gte: periodStart }
    });

    const channelMessages = await Message.countDocuments({
        company: companyId,
        channel: { $ne: null },
        createdAt: { $gte: periodStart }
    });

    const dmMessages = await Message.countDocuments({
        company: companyId,
        dm: { $ne: null },
        createdAt: { $gte: periodStart }
    });

    const messagesWithAttachments = await Message.countDocuments({
        company: companyId,
        createdAt: { $gte: periodStart },
        attachments: { $exists: true, $ne: [] }
    });

    return {
        total: totalMessages,
        byChannel: channelMessages,
        byDM: dmMessages,
        withAttachments: messagesWithAttachments,
        averagePerDay: Math.round(totalMessages / days),
        dailyBreakdown: messageStats
    };
};

/**
 * Generate trend data for charts
 * @param {Array} data - Raw data array
 * @param {Number} days - Number of days
 * @returns {Array} Formatted trend data
 */
exports.generateTrendData = (data, days = 30) => {
    const now = new Date();
    const trendData = [];

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];

        const dataPoint = data.find(d => d._id.date === dateStr);

        trendData.push({
            date: dateStr,
            value: dataPoint ? dataPoint.count : 0
        });
    }

    return trendData;
};

/**
 * Get workspace analytics
 * @param {ObjectId} companyId - Company ID
 * @returns {Array} Workspace analytics
 */
exports.getWorkspaceAnalytics = async (companyId) => {
    const workspaces = await Workspace.find({ company: companyId })
        .select('name members')
        .lean();

    const workspaceAnalytics = await Promise.all(
        workspaces.map(async (workspace) => {
            const channelCount = await Channel.countDocuments({ workspace: workspace._id });
            const messageCount = await Message.countDocuments({ workspace: workspace._id });
            const taskCount = await Task.countDocuments({ workspace: workspace._id });

            return {
                workspaceId: workspace._id,
                name: workspace.name,
                memberCount: workspace.members.length,
                channelCount,
                messageCount,
                taskCount
            };
        })
    );

    return workspaceAnalytics;
};

module.exports = exports;
