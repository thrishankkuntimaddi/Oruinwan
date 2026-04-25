const mongoose = require("mongoose");

const UpdateSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },

    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    message: { type: String, required: true },
    title: { type: String },

    
    visibility: {
        type: String,
        enum: ["all", "managers", "department"],
        default: "all",
    },

    
    targetDepartment: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },

    
    type: {
        type: String,
        enum: ["announcement", "achievement", "milestone", "news", "alert", "general"],
        default: "general"
    },

    
    priority: {
        type: String,
        enum: ["low", "normal", "high", "critical"],
        default: "normal"
    },

    
    attachments: [{
        name: String,
        url: String,
        type: String,
        size: Number
    }],

    
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    
    reactions: [{
        emoji: String,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now }
    }],

    
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    
    isPinned: { type: Boolean, default: false },
    pinnedUntil: { type: Date, default: null },

    
    isDeleted: { type: Boolean, default: false }

}, { timestamps: true });

UpdateSchema.index({ company: 1, createdAt: -1 });           
UpdateSchema.index({ company: 1, workspace: 1, createdAt: -1 }); 
UpdateSchema.index({ company: 1, visibility: 1, isDeleted: 1 }); 
UpdateSchema.index({ postedBy: 1 });
UpdateSchema.index({ type: 1, priority: 1 });

module.exports = mongoose.model("Update", UpdateSchema);
