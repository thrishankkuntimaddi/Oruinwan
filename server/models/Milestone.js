const mongoose = require("mongoose");

const MilestoneSchema = new mongoose.Schema({
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    dueDate: { type: Date, default: null },
    
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'at_risk'],
        default: 'not_started'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deleted: { type: Boolean, default: false }
}, {
    timestamps: true
});

MilestoneSchema.index({ workspace: 1, status: 1 });
MilestoneSchema.index({ workspace: 1, dueDate: 1 });

module.exports = mongoose.model("Milestone", MilestoneSchema);
