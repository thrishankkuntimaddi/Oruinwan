// server/models/Note.js
const mongoose = require("mongoose");

/**
 * Note Model
 * 
 * Privacy-First Model:
 * - By default: private (only owner)
 * - Can be shared: sharedWith specific users
 * - Can be public: visible to all workspace members
 * 
 * ✅ Notes are ALWAYS workspace-scoped
 */
const NoteSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true }, // ✅ REQUIRED

    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    title: { type: String, required: true },
    content: { type: String, default: "" },

    // Note type (helps with organization)
    type: {
        type: String,
        enum: ["note", "meeting", "documentation"],
        default: "note"
    },

    // 🔒 CRITICAL: Privacy controls
    // Default: private (only owner can see)
    isPublic: { type: Boolean, default: false }, // If true, all workspace members can see
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Specific users who can view/edit

    // Collaboration permissions
    allowComments: { type: Boolean, default: false },
    allowEditing: { type: Boolean, default: false }, // If true, sharedWith users can edit

    // Meeting notes metadata (optional)
    meetingDate: { type: Date, default: null },
    meetingParticipants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Optional channel link (for context)
    channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },

    // Attachments
    attachments: [{
        name: String,           // Original filename
        url: String,            // Full URL: /uploads/notes/images/abc123.jpg
        type: String,           // MIME type: image/jpeg, video/mp4, audio/mpeg
        size: Number,           // File size in bytes
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        uploadedAt: { type: Date, default: Date.now },
        // For better querying:
        category: {
            type: String,
            enum: ['image', 'video', 'audio', 'document'],
            required: true
        }
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
NoteSchema.index({ workspace: 1, owner: 1, isArchived: 1 });
NoteSchema.index({ workspace: 1, isPublic: 1 });
NoteSchema.index({ sharedWith: 1 });
NoteSchema.index({ tags: 1 });
NoteSchema.index({ channel: 1 });

// Helper: Check if user can view note
NoteSchema.methods.canView = function (userId) {
    const userIdStr = userId.toString();

    // Owner can always view
    if (this.owner.toString() === userIdStr) return true;

    // Public notes visible to all workspace members (workspace check done by caller)
    if (this.isPublic) return true;

    // Check if explicitly shared with user
    if (this.sharedWith.some(id => id.toString() === userIdStr)) return true;

    return false;
};

// Helper: Check if user can edit note
NoteSchema.methods.canEdit = function (userId) {
    const userIdStr = userId.toString();

    // Owner can always edit
    if (this.owner.toString() === userIdStr) return true;

    // If allowEditing is true, shared users can edit
    if (this.allowEditing && this.sharedWith.some(id => id.toString() === userIdStr)) return true;

    return false;
};

// Virtual: Get image attachments
NoteSchema.virtual('images').get(function () {
    return this.attachments.filter(a => a.category === 'image');
});

// Virtual: Get video attachments
NoteSchema.virtual('videos').get(function () {
    return this.attachments.filter(a => a.category === 'video');
});

// Virtual: Get audio attachments
NoteSchema.virtual('audios').get(function () {
    return this.attachments.filter(a => a.category === 'audio');
});

// Virtual: Get document attachments
NoteSchema.virtual('documents').get(function () {
    return this.attachments.filter(a => a.category === 'document');
});

module.exports = mongoose.model("Note", NoteSchema);
