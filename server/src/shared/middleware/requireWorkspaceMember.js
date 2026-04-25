const Workspace = require("../../../models/Workspace");

const requireWorkspaceMember = async (req, res, next) => {
    try {
        const workspaceId =
            req.params.workspaceId || req.params.id || req.body.workspaceId || req.query.workspaceId;

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                error: "workspaceId is required.",
                code: "WORKSPACE_ID_MISSING",
            });
        }

        const workspace = await Workspace.findOne({
            _id: workspaceId,
            isActive: true,
            isArchived: false,
        }).lean();

        if (!workspace) {
            return res.status(404).json({
                success: false,
                error: "Workspace not found or is no longer active.",
                code: "WORKSPACE_NOT_FOUND",
            });
        }

        
        
        
        
        if (req.companyId && workspace.company && workspace.company.toString() !== req.companyId) {
            return res.status(403).json({
                success: false,
                error: "Access denied.",
                code: "CROSS_TENANT_DENIED",
            });
        }

        
        const userId = (req.user._id || req.user.sub).toString();
        const membership = workspace.members.find(
            (m) =>
                m.user.toString() === userId &&
                m.status === "active"
        );

        if (!membership) {
            return res.status(403).json({
                success: false,
                error: "You are not a member of this workspace.",
                code: "WORKSPACE_ACCESS_DENIED",
            });
        }

        
        req.workspace = workspace;
        req.workspaceRole = membership.role;

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = requireWorkspaceMember;
