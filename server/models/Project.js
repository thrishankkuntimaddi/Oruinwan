const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
    {
        
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Workspace",
            required: true,
        },

        
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: "",
        },

        
        status: {
            type: String,
            enum: ["planning", "active", "on_hold", "completed", "cancelled"],
            default: "planning",
        },

        
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        
        startDate: {
            type: Date,
            default: null,
        },
        endDate: {
            type: Date,
            default: null,
        },

        
        
        
        members: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                role: {
                    type: String,
                    enum: ["lead", "member"],
                    default: "member",
                },
                joinedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],

        
        isArchived: {
            type: Boolean,
            default: false,
        },
        archivedAt: {
            type: Date,
            default: null,
        },
        archivedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        
        deleted: {
            type: Boolean,
            default: false,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        
        metadata: {
            type: mongoose.Schema.Types.Mixed,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

ProjectSchema.index({ workspaceId: 1, status: 1 });
ProjectSchema.index({ companyId: 1, status: 1 });
ProjectSchema.index({ ownerId: 1 });
ProjectSchema.index({ workspaceId: 1, isArchived: 1 });
ProjectSchema.index({ companyId: 1, deleted: 1 });

ProjectSchema.virtual("memberCount").get(function () {
    return this.members ? this.members.length : 0;
});

ProjectSchema.methods.isMember = function (userId) {
    return this.members.some(
        (m) => m.user.toString() === userId.toString()
    );
};

ProjectSchema.methods.isLead = function (userId) {
    return this.members.some(
        (m) => m.user.toString() === userId.toString() && m.role === "lead"
    );
};

module.exports = mongoose.model("Project", ProjectSchema);
