// server/models/Task.js
const mongoose = require("mongoose");

/**
 * Task Model
 * 
 * Visibility Rules:
 * - private: Only creator + assignees
 * - channel: All channel members
 * - workspace: All workspace members
 */
const TaskSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },

    title: { type: String, required: true },
    description: { type: String, default: "" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Multiple assignees

    // 🔒 CRITICAL: Visibility controls
    visibility: {
        type: String,
        enum: ["private", "channel", "workspace"],
        default: "private"
    },

    // Optional channel link (required if visibility = "channel")
    channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },

    status: {
        type: String,
        enum: ["todo", "in-progress", "review", "done", "cancelled"],
        default: "todo"
    },

    priority: {
        type: String,
        enum: ["low", "medium", "high", "urgent"],
        default: "medium"
    },

    dueDate: { type: Date, default: null },

    // Optional links to conversation context
    linkedMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    linkedDM: { type: mongoose.Schema.Types.ObjectId, ref: "DMSession", default: null },

    // AI-generated task flag
    aiGenerated: { type: Boolean, default: false },
    aiContext: { type: mongoose.Schema.Types.Mixed }, // store AI context

    // Task metadata
    tags: [{ type: String }],
    attachments: [{
        name: String,
        url: String,
        type: String,
        size: Number
    }],

    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    completionNote: { type: String, default: "" }, // Completion note from frontend
    deleted: { type: Boolean, default: false }, // Soft delete support

    // Transfer request tracking (assignee can request to transfer task)
    transferRequest: {
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        requestedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Proposed new assignee
        requestedAt: { type: Date },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"]
        },
        note: { type: String }
    },

    // Revoke tracking (assigner can take back task)
    revokedAt: { type: Date, default: null },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Track users who deleted this task from their view (assignees only)
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]


}, { timestamps: true });

// Indexes for performance
TaskSchema.index({ workspace: 1, visibility: 1, status: 1 });
TaskSchema.index({ channel: 1, status: 1 });
TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ createdBy: 1 });
TaskSchema.index({ dueDate: 1 });

// Helper: Check if user can view task
TaskSchema.methods.canView = function (userId, userChannels = []) {
    const userIdStr = userId.toString();

    // Creator and assignees can always view
    if (this.createdBy.toString() === userIdStr) return true;
    if (this.assignedTo.some(id => id.toString() === userIdStr)) return true;

    // Visibility-based access
    if (this.visibility === "workspace") return true;
    if (this.visibility === "channel" && userChannels.includes(this.channel?.toString())) return true;

    return false;
};

module.exports = mongoose.model("Task", TaskSchema);
