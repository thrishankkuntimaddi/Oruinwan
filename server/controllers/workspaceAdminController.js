/**
 * Revoke a pending workspace invite
 * POST /api/workspaces/:workspaceId/invites/:inviteId/revoke
 */
exports.revokeInvite = async (req, res) => {
    try {
        const { workspaceId, inviteId } = req.params;
        const { reason } = req.body;
        const userId = req.user?.sub;

        // Verify workspace exists
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        // 🔒 CRITICAL: Only admins/owners can revoke invites
        const member = workspace.members.find(m => String(m.user) === String(userId));
        if (!member || (member.role !== "admin" && member.role !== "owner")) {
            return res.status(403).json({ message: "Only workspace admins can revoke invites" });
        }

        // Find invite
        const Invite = require("../models/Invite");
        const invite = await Invite.findById(inviteId);

        if (!invite) {
            return res.status(404).json({ message: "Invite not found" });
        }

        // Verify invite belongs to this workspace
        if (String(invite.workspace) !== String(workspaceId)) {
            return res.status(403).json({ message: "Invite does not belong to this workspace" });
        }

        // Cannot revoke if already accepted
        if (invite.status === "accepted") {
            return res.status(400).json({ message: "Cannot revoke an already accepted invite" });
        }

        // Cannot revoke if already revoked
        if (invite.status === "revoked") {
            return res.status(400).json({ message: "Invite is already revoked" });
        }

        // Revoke the invite
        invite.status = "revoked";
        invite.revokedBy = userId;
        invite.revokedAt = new Date();
        invite.revokeReason = reason || "Revoked by admin";
        await invite.save();

        console.log(`✅ Invite ${inviteId} revoked by ${userId}`);

        return res.json({
            message: "Invite revoked successfully",
            invite: {
                id: invite._id,
                email: invite.email,
                status: invite.status,
                revokedAt: invite.revokedAt
            }
        });
    } catch (err) {
        console.error("REVOKE INVITE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Get all pending invites for a workspace
 * GET /api/workspaces/:workspaceId/invites
 */
exports.getWorkspaceInvites = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user?.sub;

        // Verify workspace exists
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        // 🔒 Only admins/owners can view invites
        const member = workspace.members.find(m => String(m.user) === String(userId));
        if (!member || (member.role !== "admin" && member.role !== "owner")) {
            return res.status(403).json({ message: "Only workspace admins can view invites" });
        }

        const Invite = require("../models/Invite");
        const invites = await Invite.find({ workspace: workspaceId })
            .populate('invitedBy', 'username email')
            .sort({ createdAt: -1 })
            .lean();

        // Categorize invites
        const pending = [];
        const accepted = [];
        const revoked = [];
        const expired = [];

        const now = new Date();

        for (const invite of invites) {
            const inviteData = {
                id: invite._id,
                email: invite.email,
                role: invite.role,
                invitedBy: invite.invitedBy?.username,
                createdAt: invite.createdAt,
                expiresAt: invite.expiresAt,
                status: invite.status
            };

            if (invite.status === "pending" && invite.expiresAt < now) {
                expired.push({ ...inviteData, status: "expired" });
            } else if (invite.status === "pending") {
                pending.push(inviteData);
            } else if (invite.status === "accepted") {
                accepted.push(inviteData);
            } else if (invite.status === "revoked") {
                revoked.push({
                    ...inviteData,
                    revokedBy: invite.revokedBy,
                    revokedAt: invite.revokedAt,
                    revokeReason: invite.revokeReason
                });
            }
        }

        return res.json({
            pending,
            accepted,
            revoked,
            expired,
            total: invites.length
        });
    } catch (err) {
        console.error("GET WORKSPACE INVITES ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Remove a member from workspace
 * POST /api/workspaces/:workspaceId/remove-member
 */
exports.removeMember = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { userId: targetUserId } = req.body;
        const adminId = req.user?.sub;

        if (!targetUserId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        // Get workspace
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        // 🔒 CRITICAL: Only admins/owners can remove members
        const admin = workspace.members.find(m => String(m.user) === String(adminId));
        if (!admin || (admin.role !== "admin" && admin.role !== "owner")) {
            return res.status(403).json({ message: "Only workspace admins can remove members" });
        }

        // Cannot remove yourself
        if (String(targetUserId) === String(adminId)) {
            return res.status(400).json({ message: "You cannot remove yourself. Use leave workspace instead." });
        }

        // Cannot remove owner
        const targetMember = workspace.members.find(m => String(m.user) === String(targetUserId));
        if (!targetMember) {
            return res.status(404).json({ message: "User is not a member of this workspace" });
        }

        if (targetMember.role === "owner") {
            return res.status(403).json({ message: "Cannot remove workspace owner" });
        }

        console.log(`🚨 Removing user ${targetUserId} from workspace ${workspaceId}`);

        // 1️⃣ Remove from workspace
        workspace.members = workspace.members.filter(m => String(m.user) !== String(targetUserId));
        await workspace.save();

        // 2️⃣ Remove from all channels in workspace
        await Channel.updateMany(
            { workspace: workspaceId },
            { $pull: { members: targetUserId } }
        );

        // 3️⃣ Close/remove from DMs in workspace
        const DMSession = require("../models/DMSession");
        await DMSession.updateMany(
            { workspace: workspaceId, participants: targetUserId },
            { $set: { status: "closed" } }
        );

        // 4️⃣ Remove workspace from user's workspaces list
        const User = require("../models/User");
        await User.findByIdAndUpdate(targetUserId, {
            $pull: { workspaces: { workspace: workspaceId } }
        });

        console.log(`✅ User ${targetUserId} removed from workspace ${workspaceId}`);

        return res.json({
            message: "Member removed successfully",
            removedUserId: targetUserId
        });
    } catch (err) {
        console.error("REMOVE MEMBER ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// No need for module.exports - already using exports.functionName above
