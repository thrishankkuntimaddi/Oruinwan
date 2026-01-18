const Workspace = require('../models/Workspace');

// Update workspace permissions (admin/owner only)
// PUT /api/workspaces/:id/permissions
exports.updateWorkspacePermissions = async (req, res) => {
    try {
        const { id: workspaceId } = req.params;
        const userId = req.user?.sub;
        const { allowMemberChannelCreation, allowMemberInvite, requireAdminApproval, isDiscoverable } = req.body;

        // Find workspace
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        // Check if user is admin/owner
        const member = workspace.members.find(m => m.user.toString() === userId);
        if (!member || (member.role !== "admin" && member.role !== "owner")) {
            return res.status(403).json({ message: "Only admins and owners can update permissions" });
        }

        // Update permissions
        if (typeof allowMemberChannelCreation === 'boolean') {
            workspace.settings.allowMemberChannelCreation = allowMemberChannelCreation;
        }
        if (typeof allowMemberInvite === 'boolean') {
            workspace.settings.allowMemberInvite = allowMemberInvite;
        }
        if (typeof requireAdminApproval === 'boolean') {
            workspace.settings.requireAdminApproval = requireAdminApproval;
        }
        if (typeof isDiscoverable === 'boolean') {
            workspace.settings.isDiscoverable = isDiscoverable;
        }

        await workspace.save();

        return res.json({
            message: "Permissions updated successfully",
            settings: workspace.settings
        });
    } catch (err) {
        console.error("UPDATE PERMISSIONS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
