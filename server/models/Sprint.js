const mongoose = require("mongoose");

const SprintSchema = new mongoose.Schema({
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    name: { type: String, required: true, trim: true },
    goal: { type: String, default: "" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
        type: String,
        enum: ['planning', 'active', 'completed', 'cancelled'],
        default: 'planning'
    },
    
    boardColumns: [{
        name: { type: String, required: true },
        order: { type: Number, required: true },
        color: { type: String, default: '#6b7280' }
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deleted: { type: Boolean, default: false }
}, {
    timestamps: true
});

SprintSchema.index({ workspace: 1, status: 1 });
SprintSchema.index({ workspace: 1, startDate: 1 });

module.exports = mongoose.model("Sprint", SprintSchema);
