// server/models/TaskTemplate.js
const mongoose = require("mongoose");

const TaskTemplateSchema = new mongoose.Schema({
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    name: { type: String, required: true, trim: true }, // Template label e.g. "Bug Report"
    // Pre-filled task fields
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    priority: {
        type: String,
        enum: ['lowest', 'low', 'medium', 'high', 'highest'],
        default: 'medium'
    },
    tags: [{ type: String }],
    estimatedHours: { type: Number, default: null },
    // Sub-task titles to auto-create when instantiating template
    subtaskTitles: [{ type: String }],
    automationRules: [{
        trigger: { type: String },
        action: { type: String }
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, {
    timestamps: true
});

TaskTemplateSchema.index({ workspace: 1 });

module.exports = mongoose.model("TaskTemplate", TaskTemplateSchema);
