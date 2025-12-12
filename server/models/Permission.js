// server/models/Permission.js
const mongoose = require("mongoose");

// Permission template for roles
const PermissionSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    role: {
        type: String,
        required: true,
        enum: ["owner", "admin", "manager", "member", "guest"]
    },

    // Granular permissions
    permissions: {
        // Company level
        manageCompany: { type: Boolean, default: false },
        viewAnalytics: { type: Boolean, default: false },
        manageBilling: { type: Boolean, default: false },

        // User management
        inviteUsers: { type: Boolean, default: false },
        removeUsers: { type: Boolean, default: false },
        manageRoles: { type: Boolean, default: false },

        // Workspace
        createWorkspace: { type: Boolean, default: false },
        deleteWorkspace: { type: Boolean, default: false },
        manageWorkspaceMembers: { type: Boolean, default: false },

        // Channel
        createChannel: { type: Boolean, default: false },
        deleteChannel: { type: Boolean, default: false },
        manageChannelMembers: { type: Boolean, default: false },

        // Content
        sendMessages: { type: Boolean, default: true },
        deleteMessages: { type: Boolean, default: false },
        pinMessages: { type: Boolean, default: false },

        // Tasks
        createTasks: { type: Boolean, default: false },
        assignTasks: { type: Boolean, default: false },
        deleteTasks: { type: Boolean, default: false },

        // Notes
        createNotes: { type: Boolean, default: true },
        shareNotes: { type: Boolean, default: true },

        // Updates
        postUpdates: { type: Boolean, default: false },
        deleteUpdates: { type: Boolean, default: false }
    },

    // Custom permissions (extensible)
    customPermissions: { type: mongoose.Schema.Types.Mixed }

}, { timestamps: true });

// Indexes
PermissionSchema.index({ company: 1, role: 1 });

module.exports = mongoose.model("Permission", PermissionSchema);
