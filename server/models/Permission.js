const mongoose = require("mongoose");

const PermissionSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    role: {
        type: String,
        required: true,
        enum: ["owner", "admin", "manager", "member", "guest"]
    },

    
    permissions: {
        
        manageCompany: { type: Boolean, default: false },
        viewAnalytics: { type: Boolean, default: false },
        manageBilling: { type: Boolean, default: false },

        
        inviteUsers: { type: Boolean, default: false },
        removeUsers: { type: Boolean, default: false },
        manageRoles: { type: Boolean, default: false },

        
        createWorkspace: { type: Boolean, default: false },
        deleteWorkspace: { type: Boolean, default: false },
        manageWorkspaceMembers: { type: Boolean, default: false },

        
        createChannel: { type: Boolean, default: false },
        deleteChannel: { type: Boolean, default: false },
        manageChannelMembers: { type: Boolean, default: false },

        
        sendMessages: { type: Boolean, default: true },
        deleteMessages: { type: Boolean, default: false },
        pinMessages: { type: Boolean, default: false },

        
        createTasks: { type: Boolean, default: false },
        assignTasks: { type: Boolean, default: false },
        deleteTasks: { type: Boolean, default: false },

        
        createNotes: { type: Boolean, default: true },
        shareNotes: { type: Boolean, default: true },

        
        postUpdates: { type: Boolean, default: false },
        deleteUpdates: { type: Boolean, default: false }
    },

    
    customPermissions: { type: mongoose.Schema.Types.Mixed }

}, { timestamps: true });

PermissionSchema.index({ company: 1, role: 1 });

module.exports = mongoose.model("Permission", PermissionSchema);
