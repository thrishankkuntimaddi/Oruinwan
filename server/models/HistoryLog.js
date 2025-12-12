// server/models/HistoryLog.js
const mongoose = require("mongoose");

const HistoryLogSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },

    // Who performed the action
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Action details
    action: {
        type: String,
        required: true,
        enum: [
            "user_login",
            "user_logout",
            "user_signup",
            "user_invited",
            "user_joined_company",
            "user_left_company",
            "user_role_changed",
            "company_created",
            "company_updated",
            "workspace_created",
            "workspace_updated",
            "workspace_deleted",
            "channel_created",
            "channel_updated",
            "channel_deleted",
            "member_added",
            "member_removed",
            "task_created",
            "task_updated",
            "task_completed",
            "note_created",
            "note_shared",
            "update_posted",
            "domain_verified",
            "settings_changed",
            "other"
        ]
    },

    // Resource affected
    resourceType: {
        type: String,
        enum: ["user", "company", "workspace", "channel", "message", "task", "note", "update", "invite", "other"]
    },
    resourceId: { type: mongoose.Schema.Types.ObjectId },

    // Details
    description: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed }, // additional context

    // IP and device info
    ipAddress: { type: String },
    userAgent: { type: String },

    // Timestamp
    timestamp: { type: Date, default: Date.now }

}, { timestamps: false }); // We're using custom timestamp field

// Indexes for querying
HistoryLogSchema.index({ company: 1, timestamp: -1 });
HistoryLogSchema.index({ user: 1, timestamp: -1 });
HistoryLogSchema.index({ action: 1, timestamp: -1 });
HistoryLogSchema.index({ resourceType: 1, resourceId: 1 });

module.exports = mongoose.model("HistoryLog", HistoryLogSchema);
