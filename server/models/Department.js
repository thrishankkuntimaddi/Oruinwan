const mongoose = require("mongoose");

const DepartmentSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    name: { type: String, required: true },
    description: { type: String, default: "" },

    
    head: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    
    managers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    
    parentDepartment: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },

    
    workspaces: [{ type: mongoose.Schema.Types.ObjectId, ref: "Workspace" }],

    
    
    
    
    defaultWorkspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },

    
    metadata: { type: mongoose.Schema.Types.Mixed },

    isActive: { type: Boolean, default: true }

}, { timestamps: true });

DepartmentSchema.index({ company: 1, name: 1 });
DepartmentSchema.index({ company: 1, createdAt: -1 }); 
DepartmentSchema.index({ head: 1 });

module.exports = mongoose.model("Department", DepartmentSchema);
