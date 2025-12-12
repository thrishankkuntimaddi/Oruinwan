// server/models/Department.js
const mongoose = require("mongoose");

const DepartmentSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    name: { type: String, required: true },
    description: { type: String, default: "" },

    // Department head
    head: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Members
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Parent department for hierarchical structure
    parentDepartment: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },

    // Associated workspaces
    workspaces: [{ type: mongoose.Schema.Types.ObjectId, ref: "Workspace" }],

    // Metadata
    metadata: { type: mongoose.Schema.Types.Mixed },

    isActive: { type: Boolean, default: true }

}, { timestamps: true });

// Indexes
DepartmentSchema.index({ company: 1, name: 1 });
DepartmentSchema.index({ head: 1 });

module.exports = mongoose.model("Department", DepartmentSchema);
