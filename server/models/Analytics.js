const mongoose = require("mongoose");

const AnalyticsSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    
    period: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
        required: true
    },

    
    snapshotDate: { type: Date, required: true },

    
    userStats: {
        total: { type: Number, default: 0 },
        active: { type: Number, default: 0 }, 
        new: { type: Number, default: 0 }, 
        dailyActive: { type: Number, default: 0 }, 
        weeklyActive: { type: Number, default: 0 }, 
        monthlyActive: { type: Number, default: 0 }, 
        byRole: {
            owner: { type: Number, default: 0 },
            admin: { type: Number, default: 0 },
            manager: { type: Number, default: 0 },
            member: { type: Number, default: 0 },
            guest: { type: Number, default: 0 }
        }
    },

    
    workspaceStats: {
        total: { type: Number, default: 0 },
        active: { type: Number, default: 0 }, 
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

    
    channelStats: {
        total: { type: Number, default: 0 },
        active: { type: Number, default: 0 }, 
        averageMembers: { type: Number, default: 0 },
        averageMessages: { type: Number, default: 0 },
        topChannels: [{
            channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel" },
            name: String,
            messageCount: Number,
            memberCount: Number,
            engagementScore: Number 
        }]
    },

    
    taskStats: {
        total: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
        inProgress: { type: Number, default: 0 },
        todo: { type: Number, default: 0 },
        cancelled: { type: Number, default: 0 },
        completionRate: { type: Number, default: 0 }, 
        averageCompletionTime: { type: Number, default: 0 }, 
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

    
    messageStats: {
        total: { type: Number, default: 0 },
        byChannel: { type: Number, default: 0 },
        byDM: { type: Number, default: 0 },
        withAttachments: { type: Number, default: 0 },
        averagePerUser: { type: Number, default: 0 },
        averagePerDay: { type: Number, default: 0 },
        peakHour: { type: Number, default: 0 }, 
        peakDay: { type: Number, default: 0 } 
    },

    
    engagementMetrics: {
        dau: { type: Number, default: 0 }, 
        wau: { type: Number, default: 0 }, 
        mau: { type: Number, default: 0 }, 
        dauWauRatio: { type: Number, default: 0 }, 
        averageSessionDuration: { type: Number, default: 0 }, 
        messagesPerActiveUser: { type: Number, default: 0 },
        tasksPerActiveUser: { type: Number, default: 0 }
    },

    
    growth: {
        userGrowth: { type: Number, default: 0 }, 
        workspaceGrowth: { type: Number, default: 0 },
        channelGrowth: { type: Number, default: 0 },
        messageGrowth: { type: Number, default: 0 },
        taskGrowth: { type: Number, default: 0 }
    },

    
    generatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true } 

}, { timestamps: true });

AnalyticsSchema.index({ company: 1, period: 1, snapshotDate: -1 });
AnalyticsSchema.index({ company: 1, expiresAt: 1 });
AnalyticsSchema.index({ snapshotDate: -1 });

AnalyticsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Analytics", AnalyticsSchema);
