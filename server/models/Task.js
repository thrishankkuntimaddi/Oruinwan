const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
    
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },

    
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },

    
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },

    
    issueKey: { type: String, default: null, index: true },

    
    type: {
        type: String,
        enum: ['task', 'subtask', 'bug', 'epic'],
        default: 'task',
        required: true
    },

    
    
    
    
    
    
    taskType: {
        type: String,
        enum: ['personal', 'workspace', 'channel', 'project'],
        default: 'workspace',
        required: true
    },

    
    parentTask: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    epic: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    subtasks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],

    
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 
    watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    
    visibility: {
        type: String,
        enum: ["private", "channel", "workspace"],
        default: "private"
    },

    
    channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },

    
    status: {
        type: String,
        enum: ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'],
        default: 'backlog',
        required: true
    },
    previousStatus: { type: String, default: null },

    
    blockedReason: { type: String, default: null },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    blockedAt: { type: Date, default: null },

    
    dueDate: { type: Date, default: null },
    startDate: { type: Date, default: null },

    
    priority: {
        type: String,
        enum: ['lowest', 'low', 'medium', 'high', 'highest'],
        default: 'medium'
    },
    storyPoints: { type: Number, min: 0, default: null },
    estimatedHours: { type: Number, min: 0, default: null },
    actualHours: { type: Number, min: 0, default: null },

    
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    completionNote: { type: String, default: "" },
    resolution: { type: String, default: "" },

    
    source: {
        type: String,
        enum: ['manual', 'ai'],
        default: 'manual'
    },
    aiContext: { type: mongoose.Schema.Types.Mixed },
    linkedMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    linkedDM: { type: mongoose.Schema.Types.ObjectId, ref: "DMSession", default: null },

    
    tags: [{ type: String }],
    
    labels: [{ type: String }],

    
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

    
    deleted: { type: Boolean, default: false },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null },

    
    timeTracking: {
        totalTime: { type: Number, default: 0 }, 
        sessions: [{
            start: { type: Date },
            end: { type: Date }
        }]
    },

    
    recurring: {
        isRecurring: { type: Boolean, default: false },
        pattern: { type: String, enum: ['daily', 'weekly', 'custom'], default: null },
        interval: { type: Number, default: 1 }, 
        nextDue: { type: Date, default: null }
    },

    
    automationRules: [{
        trigger: { type: String }, 
        action: { type: String }  
    }],

    
    sprintId: { type: mongoose.Schema.Types.ObjectId, ref: "Sprint", default: null },

    
    milestoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Milestone", default: null },

    
    
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }]

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

TaskSchema.pre('validate', function (next) {
    const { taskType, workspace, project, channel, visibility } = this;

    if (taskType === 'personal') {
        if (workspace) {
            return next(new Error('Personal tasks must not have a workspace.'));
        }
        if (visibility !== 'private') {
            this.visibility = 'private';
        }
    }

    if (taskType === 'workspace' && !workspace) {
        return next(new Error('Workspace tasks require a workspace.'));
    }

    if (taskType === 'channel' && (!workspace || !channel)) {
        return next(new Error('Channel tasks require both a workspace and a channel.'));
    }

    if (taskType === 'project' && (!workspace || !project)) {
        return next(new Error('Project tasks require both a workspace and a project.'));
    }

    next();
});

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
TaskSchema.index({ workspace: 1, createdAt: -1, status: 1 }); 

TaskSchema.index({ company: 1, workspace: 1, status: 1 });   
TaskSchema.index({ company: 1, taskType: 1, status: 1 });    
TaskSchema.index({ taskType: 1, createdBy: 1, status: 1 });  

TaskSchema.methods.canView = function (userId, userChannels = []) {
    const userIdStr = userId.toString();

    
    if (this.createdBy.toString() === userIdStr) return true;
    if (this.assignedTo.some(id => id.toString() === userIdStr)) return true;

    
    if (this.watchers && this.watchers.some(id => id.toString() === userIdStr)) return true;

    
    if (this.visibility === "workspace") return true;
    if (this.visibility === "channel" && userChannels.includes(this.channel?.toString())) return true;

    return false;
};

TaskSchema.methods.isAssignee = function (userId) {
    return this.assignedTo.some(id => id.toString() === userId.toString());
};

TaskSchema.methods.isCreator = function (userId) {
    return this.createdBy.toString() === userId.toString();
};

TaskSchema.methods.isWatcher = function (userId) {
    return this.watchers && this.watchers.some(id => id.toString() === userId.toString());
};

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
