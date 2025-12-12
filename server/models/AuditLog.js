// server/models/AuditLog.js

const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
    // Company context (null for personal users or system-wide actions)
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },

    // User who performed the action
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Action details
    action: { type: String, required: true }, // e.g., "user.created", "channel.deleted", "company.created"
    resource: { type: String }, // Resource type: "User", "Channel", "Workspace", etc.
    resourceId: { type: mongoose.Schema.Types.ObjectId },

    // Detailed information
    details: { type: mongoose.Schema.Types.Mixed },
    description: { type: String },

    // Request metadata
    ipAddress: { type: String },
    userAgent: { type: String },
    endpoint: { type: String },
    method: { type: String },

    // Status
    status: { type: String, enum: ["success", "failure", "pending"], default: "success" },
    errorMessage: { type: String },

    createdAt: { type: Date, default: Date.now }
}, { timestamps: false }); // Using createdAt only, no updatedAt

// Indexes for efficient queries
AuditLogSchema.index({ companyId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ resource: 1, resourceId: 1 });
AuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
