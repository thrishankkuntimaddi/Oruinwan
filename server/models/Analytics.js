// server/models/Analytics.js
const mongoose = require("mongoose");

/**
 * Analytics Model
 * Stores pre-computed analytics snapshots for performance optimization
 * Caches daily/weekly/monthly aggregations to avoid expensive real-time queries
 */
const AnalyticsSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    // Time period for this snapshot
    period: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
        required: true
    },

    // Date this snapshot represents
    snapshotDate: { type: Date, required: true },

    // User statistics
    userStats: {
        total: { type: Number, default: 0 },
        active: { type: Number, default: 0 }, // Active in this period
        new: { type: Number, default: 0 }, // New users in this period
        dailyActive: { type: Number, default: 0 }, // DAU
        weeklyActive: { type: Number, default: 0 }, // WAU
        monthlyActive: { type: Number, default: 0 }, // MAU
        byRole: {
            owner: { type: Number, default: 0 },
            admin: { type: Number, default: 0 },
            manager: { type: Number, default: 0 },
            member: { type: Number, default: 0 },
            guest: { type: Number, default: 0 }
        }
    },

    // Workspace statistics
    workspaceStats: {
        total: { type: Number, default: 0 },
        active: { type: Number, default: 0 }, // Workspaces with activity in this period
        averageMembers: { type: Number, default: 0 },
        averageChannels: { type: Number, default: 0 },
        byWorkspace: [{
            workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace" },
            name: String,
            memberCount: Number,
            channelCount: Number,
            messageCount: Number,
            taskCount: Number,
            activeUsers: Number
        }]
    },

    // Channel statistics
    channelStats: {
        total: { type: Number, default: 0 },
        active: { type: Number, default: 0 }, // Channels with messages in this period
        averageMembers: { type: Number, default: 0 },
        averageMessages: { type: Number, default: 0 },
        topChannels: [{
            channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel" },
            name: String,
            messageCount: Number,
            memberCount: Number,
            engagementScore: Number // Custom metric: messages per member
        }]
    },

    // Task statistics
    taskStats: {
        total: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
        inProgress: { type: Number, default: 0 },
        todo: { type: Number, default: 0 },
        cancelled: { type: Number, default: 0 },
        completionRate: { type: Number, default: 0 }, // Percentage
        averageCompletionTime: { type: Number, default: 0 }, // In hours
        byPriority: {
            low: { type: Number, default: 0 },
            medium: { type: Number, default: 0 },
            high: { type: Number, default: 0 },
            urgent: { type: Number, default: 0 }
        },
        byStatus: {
            todo: { type: Number, default: 0 },
            inProgress: { type: Number, default: 0 },
            review: { type: Number, default: 0 },
            done: { type: Number, default: 0 },
            cancelled: { type: Number, default: 0 }
        }
    },

    // Message statistics
    messageStats: {
        total: { type: Number, default: 0 },
        byChannel: { type: Number, default: 0 },
        byDM: { type: Number, default: 0 },
        withAttachments: { type: Number, default: 0 },
        averagePerUser: { type: Number, default: 0 },
        averagePerDay: { type: Number, default: 0 },
        peakHour: { type: Number, default: 0 }, // Hour of day with most messages (0-23)
        peakDay: { type: Number, default: 0 } // Day of week with most messages (0-6)
    },

    // Engagement metrics
    engagementMetrics: {
        dau: { type: Number, default: 0 }, // Daily Active Users
        wau: { type: Number, default: 0 }, // Weekly Active Users
        mau: { type: Number, default: 0 }, // Monthly Active Users
        dauWauRatio: { type: Number, default: 0 }, // Stickiness metric
        averageSessionDuration: { type: Number, default: 0 }, // In minutes
        messagesPerActiveUser: { type: Number, default: 0 },
        tasksPerActiveUser: { type: Number, default: 0 }
    },

    // Growth metrics (compared to previous period)
    growth: {
        userGrowth: { type: Number, default: 0 }, // Percentage
        workspaceGrowth: { type: Number, default: 0 },
        channelGrowth: { type: Number, default: 0 },
        messageGrowth: { type: Number, default: 0 },
        taskGrowth: { type: Number, default: 0 }
    },

    // Cache metadata
    generatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true } // Cache expiration

}, { timestamps: true });

// Indexes for efficient querying
AnalyticsSchema.index({ company: 1, period: 1, snapshotDate: -1 });
AnalyticsSchema.index({ company: 1, expiresAt: 1 });
AnalyticsSchema.index({ snapshotDate: -1 });

// TTL index to automatically delete expired snapshots
AnalyticsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Analytics", AnalyticsSchema);
