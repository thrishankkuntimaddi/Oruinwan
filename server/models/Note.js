const mongoose = require("mongoose");

const NoteSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true }, 

    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    title: { type: String, required: true },
    content: { type: String, default: "" },

    
    type: {
        type: String,
        enum: ["note", "meeting", "documentation", "brainstorm", "sop", "projectspec", "techdesign", "announcement"],
        default: "note"
    },

    
    
    isPublic: { type: Boolean, default: false }, 
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 

    
    allowComments: { type: Boolean, default: false },
    allowEditing: { type: Boolean, default: false }, 

    
    meetingDate: { type: Date, default: null },
    meetingParticipants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    
    channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },

    
    attachments: [{
        name: { type: String },
        url: { type: String },
        // Declared explicitly: a bare `type: String` key would make mongoose treat
        // the whole subdocument as a String and `attachments` as [String].
        type: { type: String },
        size: { type: Number },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        uploadedAt: { type: Date, default: Date.now },
        
        category: {
            type: String,
            enum: ['image', 'video', 'audio', 'document'],
            required: true
        }
    }],

    
    tags: [{ type: String }],

    
    versions: [{
        title: { type: String, default: '' },
        content: { type: String, default: '' },
        savedAt: { type: Date, default: Date.now },
    }],

    
    isPinned: { type: Boolean, default: false },

    
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null }

}, { timestamps: true });

NoteSchema.index({ workspace: 1, owner: 1, isArchived: 1 });
NoteSchema.index({ workspace: 1, isPublic: 1 });
NoteSchema.index({ sharedWith: 1 });
NoteSchema.index({ tags: 1 });
NoteSchema.index({ channel: 1 });

/**
 * Access checks. Callers must pass whether `userId` is an active member of the
 * note's workspace (opts.isWorkspaceMember); nobody outside the workspace can view
 * or edit, and public notes are visible to members only.
 */
NoteSchema.methods.canView = function (userId, opts = {}) {
    if (!opts.isWorkspaceMember) return false;
    const userIdStr = userId.toString();
    if (this.owner.toString() === userIdStr) return true;
    if (this.isPublic) return true;
    return (this.sharedWith || []).some(id => (id?._id || id).toString() === userIdStr);
};

NoteSchema.methods.canEdit = function (userId, opts = {}) {
    if (!opts.isWorkspaceMember) return false;
    const userIdStr = userId.toString();
    if (this.owner.toString() === userIdStr) return true;
    return !!this.allowEditing && (this.sharedWith || []).some(id => (id?._id || id).toString() === userIdStr);
};

NoteSchema.virtual('images').get(function () {
    return this.attachments.filter(a => a.category === 'image');
});

NoteSchema.virtual('videos').get(function () {
    return this.attachments.filter(a => a.category === 'video');
});

NoteSchema.virtual('audios').get(function () {
    return this.attachments.filter(a => a.category === 'audio');
});

NoteSchema.virtual('documents').get(function () {
    return this.attachments.filter(a => a.category === 'document');
});

module.exports = mongoose.model("Note", NoteSchema);
