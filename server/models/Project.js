// server/models/Project.js
//
// ARCH: Project is a first-class entity — a time-bounded, goal-oriented effort
// that lives inside a Workspace. Promoted from Task.project (plain String) to a
// proper relational model per the Company Layer Architecture Audit.
//
// Relationship summary:
//   Company  → [1:N] → Workspaces → [1:N] → Projects → [1:N] → Tasks
//
// Controllers and routes are NOT yet implemented (planned for Company Layer build Phase 2).

const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
    {
        // ============ OWNER SCOPING ============
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

        // ============ IDENTITY ============
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: "",
        },

        // ============ LIFECYCLE STATUS ============
        status: {
            type: String,
            enum: ["planning", "active", "on_hold", "completed", "cancelled"],
            default: "planning",
        },

        // ============ OWNERSHIP ============
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // ============ SCHEDULING ============
        startDate: {
            type: Date,
            default: null,
        },
        endDate: {
            type: Date,
            default: null,
        },

        // ============ MEMBERS ============
        //   lead   → project lead / PM (elevated visibility)
        //   member → standard project collaborator
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

        // ============ STATE FLAGS ============
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

        // ============ SOFT DELETE ============
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

        // ============ METADATA ============
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

// ============ INDEXES ============
// Primary access patterns:
//   - List projects in a workspace, filtered by status
//   - List all projects for a company, filtered by status
//   - Look up projects by owner
ProjectSchema.index({ workspaceId: 1, status: 1 });
ProjectSchema.index({ companyId: 1, status: 1 });
ProjectSchema.index({ ownerId: 1 });
ProjectSchema.index({ workspaceId: 1, isArchived: 1 });
ProjectSchema.index({ companyId: 1, deleted: 1 });

// ============ VIRTUALS ============
// Expose member count without loading full array
ProjectSchema.virtual("memberCount").get(function () {
    return this.members ? this.members.length : 0;
});

// ============ HELPERS ============
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
