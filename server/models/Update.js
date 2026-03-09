// server/models/Update.js
//
// Phase 2 — Company Communication Layer
// Patched: workspace optional (company-scoped updates don't require a workspace)
// Added:   visibility field (all | managers | department)
const mongoose = require("mongoose");

const UpdateSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    // Optional: null = company-wide update; set = workspace-specific update
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },

    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    message: { type: String, required: true },
    title: { type: String },

    // Phase 2: Visibility scope
    visibility: {
        type: String,
        enum: ["all", "managers", "department"],
        default: "all",
    },

    // Optional: target department when visibility === 'department'
    targetDepartment: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },

    // Update type for filtering
    type: {
        type: String,
        enum: ["announcement", "achievement", "milestone", "news", "alert", "general"],
        default: "general"
    },

    // Priority/importance
    priority: {
        type: String,
        enum: ["low", "normal", "high", "critical"],
        default: "normal"
    },

    // Attachments
    attachments: [{
        name: String,
        url: String,
        type: String,
        size: Number
    }],

    // Mentions
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Reactions
    reactions: [{
        emoji: String,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now }
    }],

    // Read tracking
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Pin to top
    isPinned: { type: Boolean, default: false },
    pinnedUntil: { type: Date, default: null },

    // Soft delete
    isDeleted: { type: Boolean, default: false }

}, { timestamps: true });

// Indexes
UpdateSchema.index({ company: 1, createdAt: -1 });           // company-scoped list (most common)
UpdateSchema.index({ company: 1, workspace: 1, createdAt: -1 }); // workspace-scoped list
UpdateSchema.index({ company: 1, visibility: 1, isDeleted: 1 }); // visibility filter
UpdateSchema.index({ postedBy: 1 });
UpdateSchema.index({ type: 1, priority: 1 });

module.exports = mongoose.model("Update", UpdateSchema);

