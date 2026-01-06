// server/models/Update.js
const mongoose = require("mongoose");

const UpdateSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },

    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    message: { type: String, required: true },
    title: { type: String },

    // Update type for filtering
    type: {
        type: String,
        enum: ["announcement", "achievement", "milestone", "news", "alert", "general"],
        default: "general"
    },

    // Priority/importance
    priority: {
        type: String,
        enum: ["low", "normal", "high", "critical"],
        default: "normal"
    },

    // Attachments
    attachments: [{
        name: String,
        url: String,
        type: String,
        size: Number
    }],

    // Mentions
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Reactions
    reactions: [{
        emoji: String,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now }
    }],

    // Read tracking
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Pin to top
    isPinned: { type: Boolean, default: false },
    pinnedUntil: { type: Date, default: null },

    // Soft delete
    isDeleted: { type: Boolean, default: false }

}, { timestamps: true });

// Indexes
UpdateSchema.index({ company: 1, workspace: 1, createdAt: -1 });
UpdateSchema.index({ postedBy: 1 });
UpdateSchema.index({ type: 1, priority: 1 });

module.exports = mongoose.model("Update", UpdateSchema);
