// server/models/Note.js
const mongoose = require("mongoose");

const NoteSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null }, // null for personal notes
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null }, // null for personal notes

    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    title: { type: String, required: true },
    content: { type: String, default: "" },

    // Note type
    type: {
        type: String,
        enum: ["personal", "workspace", "meeting", "shared"],
        default: "personal"
    },

    // Sharing
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isPublic: { type: Boolean, default: false }, // visible to all workspace members

    // Meeting notes metadata
    meetingDate: { type: Date, default: null },
    meetingParticipants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Attachments
    attachments: [{
        name: String,
        url: String,
        type: String,
        size: Number
    }],

    // Tags for organization
    tags: [{ type: String }],

    // Pin to top
    isPinned: { type: Boolean, default: false },

    // Soft delete
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null }

}, { timestamps: true });

// Indexes
NoteSchema.index({ owner: 1, isArchived: 1 });
NoteSchema.index({ company: 1, workspace: 1 });
NoteSchema.index({ sharedWith: 1 });
NoteSchema.index({ tags: 1 });

module.exports = mongoose.model("Note", NoteSchema);
