// server/models/Task.js
const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },

    title: { type: String, required: true },
    description: { type: String, default: "" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

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
    linkedChannel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
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
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }

}, { timestamps: true });

// Indexes for performance
TaskSchema.index({ company: 1, workspace: 1, status: 1 });
TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ createdBy: 1 });
TaskSchema.index({ dueDate: 1 });

module.exports = mongoose.model("Task", TaskSchema);
