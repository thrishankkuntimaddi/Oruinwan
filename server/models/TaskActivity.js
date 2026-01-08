const mongoose = require('mongoose');

/**
 * TaskActivity Model - Audit Trail
 * 
 * Tracks all changes made to tasks for complete history and compliance
 */
const TaskActivitySchema = new mongoose.Schema({
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
        index: true
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    action: {
        type: String,
        required: true,
        enum: [
            // Lifecycle
            'created',
            'updated',
            'deleted',
            'restored',

            // Status
            'status_changed',
            'blocked',
            'unblocked',

            // Assignment (multi-assignee support)
            'assignee_added',
            'assignee_removed',
            'all_assignees_changed',

            // Hierarchy
            'subtask_added',
            'subtask_removed',
            'moved_to_epic',

            // Metadata
            'priority_changed',
            'due_date_changed',
            'estimation_changed',

            // Collaboration
            'watcher_added',
            'watcher_removed',
            'commented',
            'attachment_added',
            'attachment_removed',

            // Transfer
            'transfer_requested',
            'transfer_approved',
            'transfer_rejected'
        ]
    },

    // What changed (field name)
    field: { type: String, default: null },

    // Old value (stored as JSON-compatible type)
    from: { type: mongoose.Schema.Types.Mixed, default: null },

    // New value
    to: { type: mongoose.Schema.Types.Mixed, default: null },

    // Additional context (e.g., reason for blocking, comment text)
    metadata: { type: mongoose.Schema.Types.Mixed },

    // Audit trail for security
    ipAddress: { type: String },
    userAgent: { type: String }

}, {
    timestamps: true  // createdAt gives us the activity timestamp
});

// Compound indexes for efficient querying
TaskActivitySchema.index({ task: 1, createdAt: -1 });
TaskActivitySchema.index({ user: 1, createdAt: -1 });
TaskActivitySchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('TaskActivity', TaskActivitySchema);
