const Workspace = require("../../../models/Workspace");
const { isValidId } = require("../utils/workspaceAccess");

// Error bodies carry `message` (the API-wide convention); `error`/`success`
// are kept for older callers.
function deny(res, status, message, code) {
    return res.status(status).json({ success: false, message, error: message, code });
}

const requireWorkspaceMember = async (req, res, next) => {
    try {
        const workspaceId =
            req.params.workspaceId || req.params.id || req.body?.workspaceId || req.query?.workspaceId;

        if (!workspaceId) {
            return deny(res, 400, "workspaceId is required.", "WORKSPACE_ID_MISSING");
        }
        if (!isValidId(workspaceId)) {
            return deny(res, 400, "Invalid workspaceId.", "WORKSPACE_ID_INVALID");
        }

        const workspace = await Workspace.findOne({
            _id: workspaceId,
            isActive: true,
            isArchived: false,
        }).lean();

        if (!workspace) {
            return deny(res, 404, "Workspace not found or is no longer active.", "WORKSPACE_NOT_FOUND");
        }

        if (req.companyId && workspace.company && workspace.company.toString() !== req.companyId) {
            return deny(res, 403, "Access denied.", "CROSS_TENANT_DENIED");
        }

        const userId = (req.user._id || req.user.sub).toString();
        const membership = (workspace.members || []).find(
            (m) =>
                m.user && m.user.toString() === userId &&
                m.status === "active"
        );

        if (!membership) {
            return deny(res, 403, "You are not a member of this workspace.", "WORKSPACE_ACCESS_DENIED");
        }

        req.workspace = workspace;
        req.workspaceRole = membership.role;

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = requireWorkspaceMember;
