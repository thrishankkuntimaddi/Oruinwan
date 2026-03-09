// server/src/shared/middleware/requireWorkspaceMember.js
//
// ARCH: Gate #2 in the middleware chain (used after requireCompanyMember).
// Verifies the authenticated user is an active member of the requested Workspace.
//
// Usage:
//   router.get('/:workspaceId/channels',
//     verifyToken, requireCompanyMember, requireWorkspaceMember, controller.listChannels
//   );
//
// Expects:
//   req.params.workspaceId   → the workspace being accessed
//   req.user                 → set by verifyToken
//   req.companyId            → set by requireCompanyMember
//
// Sets on req:
//   req.workspace            → the loaded Workspace document
//   req.workspaceRole        → the user's role in this workspace ('owner'|'admin'|'member')

const Workspace = require("../../../models/Workspace");

const requireWorkspaceMember = async (req, res, next) => {
    try {
        const workspaceId =
            req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;

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

        // Verify company isolation — prevent cross-tenant access.
        // Only enforced when req.companyId is set (company accounts that went through requireCompanyMember).
        // Personal accounts have no companyId and are skipped here — their isolation comes
        // from the workspace.members check below (they can only access workspaces they belong to).
        if (req.companyId && workspace.company && workspace.company.toString() !== req.companyId) {
            return res.status(403).json({
                success: false,
                error: "Access denied.",
                code: "CROSS_TENANT_DENIED",
            });
        }

        // Support both JWT-decoded users (req.user.sub) and DB-loaded users (req.user._id)
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

        // Attach workspace context for downstream handlers
        req.workspace = workspace;
        req.workspaceRole = membership.role;

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = requireWorkspaceMember;
