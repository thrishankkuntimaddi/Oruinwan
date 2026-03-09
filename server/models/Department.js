// server/models/Department.js
const mongoose = require("mongoose");

const DepartmentSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    name: { type: String, required: true },
    description: { type: String, default: "" },

    // Department head (single primary head)
    head: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Department managers (multiple team leads/supervisors)
    managers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Members
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Parent department for hierarchical structure
    parentDepartment: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },

    // Associated workspaces
    workspaces: [{ type: mongoose.Schema.Types.ObjectId, ref: "Workspace" }],

    // Phase 4 — Hybrid Workspace Assignment
    // The one workspace every new member auto-joins when added to this department.
    // Set to the bootstrapped workspace at creation time.
    // Can be updated later via PATCH /api/departments/:id (admin only).
    defaultWorkspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },

    // Metadata
    metadata: { type: mongoose.Schema.Types.Mixed },

    isActive: { type: Boolean, default: true }

}, { timestamps: true });

// Indexes
DepartmentSchema.index({ company: 1, name: 1 });
DepartmentSchema.index({ company: 1, createdAt: -1 }); // For growth rate queries
DepartmentSchema.index({ head: 1 });

module.exports = mongoose.model("Department", DepartmentSchema);
