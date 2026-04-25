const mongoose = require('mongoose');

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
            
            'created',
            'updated',
            'deleted',
            'restored',

            
            'status_changed',
            'blocked',
            'unblocked',

            
            'assignee_added',
            'assignee_removed',
            'all_assignees_changed',

            
            'subtask_added',
            'subtask_removed',
            'moved_to_epic',

            
            'priority_changed',
            'due_date_changed',
            'estimation_changed',

            
            'watcher_added',
            'watcher_removed',
            'commented',
            'attachment_added',
            'attachment_removed',

            
            'transfer_requested',
            'transfer_approved',
            'transfer_rejected'
        ]
    },

    
    field: { type: String, default: null },

    
    from: { type: mongoose.Schema.Types.Mixed, default: null },

    
    to: { type: mongoose.Schema.Types.Mixed, default: null },

    
    metadata: { type: mongoose.Schema.Types.Mixed },

    
    ipAddress: { type: String },
    userAgent: { type: String }

}, {
    timestamps: true  
});

TaskActivitySchema.index({ task: 1, createdAt: -1 });
TaskActivitySchema.index({ user: 1, createdAt: -1 });
TaskActivitySchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('TaskActivity', TaskActivitySchema);
