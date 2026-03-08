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
    // ============ IDENTIFICATION ============
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    project: { type: String, default: null },

    // Jira-style issue key: auto-assigned by IssueKeyCounter, e.g. "CHT-7"
    issueKey: { type: String, default: null, index: true },

    // ============ TAXONOMY ============
    type: {
        type: String,
        enum: ['task', 'subtask', 'bug', 'epic'],
        default: 'task',
        required: true
    },

    // ============ HIERARCHY ============
    parentTask: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    epic: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    subtasks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],

    // ============ CONTENT ============
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    // ============ OWNERSHIP (MULTI-ASSIGNEE) ============
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Multiple assignees
    watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // 🔒 CRITICAL: Visibility controls
    visibility: {
        type: String,
        enum: ["private", "channel", "workspace"],
        default: "private"
    },

    // Optional channel link (required if visibility = "channel")
    channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },

    // ============ ENHANCED WORKFLOW ============
    status: {
        type: String,
        enum: ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'],
        default: 'backlog',
        required: true
    },
    previousStatus: { type: String, default: null },

    // Enhanced blocked state
    blockedReason: { type: String, default: null },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    blockedAt: { type: Date, default: null },

    // ============ SCHEDULING ============
    dueDate: { type: Date, default: null },
    startDate: { type: Date, default: null },

    // ============ ESTIMATION ============
    priority: {
        type: String,
        enum: ['lowest', 'low', 'medium', 'high', 'highest'],
        default: 'medium'
    },
    storyPoints: { type: Number, min: 0, default: null },
    estimatedHours: { type: Number, min: 0, default: null },
    actualHours: { type: Number, min: 0, default: null },

    // ============ COMPLETION ============
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    completionNote: { type: String, default: "" },
    resolution: { type: String, default: "" },

    // ============ AI INTEGRATION ============
    source: {
        type: String,
        enum: ['manual', 'ai'],
        default: 'manual'
    },
    aiContext: { type: mongoose.Schema.Types.Mixed },
    linkedMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    linkedDM: { type: mongoose.Schema.Types.ObjectId, ref: "DMSession", default: null },

    // ============ METADATA ============
    tags: [{ type: String }],
    // Jira-style labels (user-defined free-form strings)
    labels: [{ type: String }],

    // ============ LINKED ISSUES ============
    linkedIssues: [{
        task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
        linkType: {
            type: String,
            enum: ['blocks', 'is_blocked_by', 'duplicates', 'is_duplicated_by', 'relates_to'],
            required: true
        },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now }
    }],
    attachments: [{
        name: String,
        url: String,
        type: String,
        size: Number,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        uploadedAt: { type: Date, default: Date.now }
    }],

    // ============ TRANSFER ============
    // Transfer request tracking (assignee can request to transfer task)
    transferRequest: {
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        requestedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        requestedAt: { type: Date },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"]
        },
        reason: { type: String }
    },

    // ============ SOFT DELETE ============
    deleted: { type: Boolean, default: false },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null }


}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ============ INDEXES ============
TaskSchema.index({ workspace: 1, status: 1, deleted: 1 });
TaskSchema.index({ workspace: 1, visibility: 1, status: 1 });
TaskSchema.index({ channel: 1, status: 1 });
TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ createdBy: 1 });
TaskSchema.index({ parentTask: 1 });
TaskSchema.index({ epic: 1 });
TaskSchema.index({ type: 1, workspace: 1 });
TaskSchema.index({ dueDate: 1, status: 1 });
TaskSchema.index({ project: 1 });
TaskSchema.index({ workspace: 1, createdAt: -1, status: 1 }); // For dashboard activity queries

// ============ HELPER METHODS ============

// Check if user can view task
TaskSchema.methods.canView = function (userId, userChannels = []) {
    const userIdStr = userId.toString();

    // Creator and assignees can always view
    if (this.createdBy.toString() === userIdStr) return true;
    if (this.assignedTo.some(id => id.toString() === userIdStr)) return true;

    // Watchers can view
    if (this.watchers && this.watchers.some(id => id.toString() === userIdStr)) return true;

    // Visibility-based access
    if (this.visibility === "workspace") return true;
    if (this.visibility === "channel" && userChannels.includes(this.channel?.toString())) return true;

    return false;
};

// Check if user is assigned to this task
TaskSchema.methods.isAssignee = function (userId) {
    return this.assignedTo.some(id => id.toString() === userId.toString());
};

// Check if user is creator
TaskSchema.methods.isCreator = function (userId) {
    return this.createdBy.toString() === userId.toString();
};

// Check if user is watcher
TaskSchema.methods.isWatcher = function (userId) {
    return this.watchers && this.watchers.some(id => id.toString() === userId.toString());
};

// Get all stakeholders (creator + assignees + watchers)
TaskSchema.methods.getStakeholders = function () {
    const stakeholders = new Set();
    stakeholders.add(this.createdBy.toString());
    this.assignedTo.forEach(id => stakeholders.add(id.toString()));
    if (this.watchers) {
        this.watchers.forEach(id => stakeholders.add(id.toString()));
    }
    return Array.from(stakeholders);
};

module.exports = mongoose.model("Task", TaskSchema);
