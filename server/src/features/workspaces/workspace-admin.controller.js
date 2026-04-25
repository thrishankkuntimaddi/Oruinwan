const Workspace = require("../../../models/Workspace");
const _User = require("../../../models/User");
const Channel = require("../channels/channel.model.js");

exports.revokeInvite = async (req, res) => {
    try {
        const { workspaceId, inviteId } = req.params;
        const reason = req.body?.reason; 
        const userId = req.user?.sub;

        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        
        const member = workspace.members.find(m => String(m.user) === String(userId));
        if (!member || (member.role !== "admin" && member.role !== "owner")) {
            return res.status(403).json({ message: "Only workspace admins can revoke invites" });
        }

        
        const Invite = require("../../../models/Invite");
        const invite = await Invite.findById(inviteId);

        if (!invite) {
            return res.status(404).json({ message: "Invite not found" });
        }

        
        if (String(invite.workspace) !== String(workspaceId)) {
            return res.status(403).json({ message: "Invite does not belong to this workspace" });
        }

        
        if (invite.status === "accepted") {
            return res.status(400).json({ message: "Cannot revoke an already accepted invite" });
        }

        
        if (invite.status === "revoked") {
            return res.status(400).json({ message: "Invite is already revoked" });
        }

        
        invite.status = "revoked";
        invite.revokedBy = userId;
        invite.revokedAt = new Date();
        invite.revokeReason = reason || "Revoked by admin";
        await invite.save();

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

exports.getWorkspaceInvites = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user?.sub;

        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        
        const member = workspace.members.find(m => String(m.user) === String(userId));
        if (!member || (member.role !== "admin" && member.role !== "owner")) {
            return res.status(403).json({ message: "Only workspace admins can view invites" });
        }

        const Invite = require("../../../models/Invite");
        const invites = await Invite.find({ workspace: workspaceId })
            .populate('invitedBy', 'username email')
            .sort({ createdAt: -1 })
            .lean();

        
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
                status: invite.status,
                inviteType: invite.inviteType || 'link',  
                used: invite.used || false  
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

        
        
        const emailCounts = {};
        pending.forEach(invite => {
            if (invite.email) {  
                emailCounts[invite.email] = (emailCounts[invite.email] || 0) + 1;
            }
        });

        
        const duplicateEmails = Object.keys(emailCounts).filter(email => emailCounts[email] > 1);
        const pendingWithDuplicates = pending.map(invite => ({
            ...invite,
            isDuplicate: invite.email ? duplicateEmails.includes(invite.email) : false,  
            duplicateCount: invite.email ? (emailCounts[invite.email] || 1) : 1
        }));

        return res.json({
            pending: pendingWithDuplicates,
            accepted,
            revoked,
            expired,
            total: invites.length,
            duplicateEmails,
            duplicateCount: duplicateEmails.length
        });
    } catch (err) {
        console.error("GET WORKSPACE INVITES ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.resendInvite = async (req, res) => {
    try {
        const { workspaceId, inviteId } = req.params;
        const userId = req.user?.sub;

        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        
        const member = workspace.members.find(m => String(m.user) === String(userId));
        if (!member || (member.role !== "admin" && member.role !== "owner")) {
            return res.status(403).json({ message: "Only workspace admins can resend invites" });
        }

        
        const Invite = require("../../../models/Invite");
        const invite = await Invite.findById(inviteId);

        if (!invite) {
            return res.status(404).json({ message: "Invite not found" });
        }

        
        if (String(invite.workspace) !== String(workspaceId)) {
            return res.status(403).json({ message: "Invite does not belong to this workspace" });
        }

        
        const now = new Date();
        const _isExpired = invite.expiresAt < now;

        if (invite.status === "accepted") {
            return res.status(400).json({ message: "Cannot resend an already accepted invite" });
        }

        if (invite.status === "revoked") {
            return res.status(400).json({ message: "Cannot resend a revoked invite" });
        }

        
        const crypto = require("crypto");
        const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
        const raw = crypto.randomBytes(32).toString("hex");
        const tokenHash = sha256(raw);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 

        
        invite.tokenHash = tokenHash;
        invite.expiresAt = expiresAt;
        invite.status = "pending"; 
        await invite.save();

        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join-workspace?token=${raw}`;

        
        const sendEmail = require("../../../utils/sendEmail");
        try {
            await sendEmail({
                to: invite.email,
                subject: `Reminder: Join ${workspace.name} on Chttrix`,
                html: `
                    <h2>You've been invited to join ${workspace.name}!</h2>
                    <p>This is a reminder invitation. Click the link below to accept:</p>
                    <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px;">Join Workspace</a>
                    <p style="margin-top: 20px; color: #666;">This link will expire in 7 days.</p>
                `
            });

        } catch (_e) {
            console.warn("⚠️ SMTP not configured — Email not sent");

        }

        return res.json({
            message: "Invite resent successfully",
            invite: {
                id: invite._id,
                email: invite.email,
                expiresAt: invite.expiresAt,
                inviteLink
            }
        });
    } catch (err) {
        console.error("RESEND INVITE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.suspendMember = async (req, res) => {
    try {
        const { workspaceId, userId: targetUserId } = req.params;
        const adminId = req.user?.sub;

        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        
        const admin = workspace.members.find(m => String(m.user) === String(adminId));
        if (!admin || (admin.role !== "admin" && admin.role !== "owner")) {
            return res.status(403).json({ message: "Only workspace admins can suspend members" });
        }

        
        if (String(targetUserId) === String(adminId)) {
            return res.status(400).json({ message: "You cannot suspend yourself" });
        }

        
        const targetMember = workspace.members.find(m => String(m.user) === String(targetUserId));
        if (!targetMember) {
            return res.status(404).json({ message: "User is not a member of this workspace" });
        }

        
        if (targetMember.role === "owner") {
            return res.status(403).json({ message: "Cannot suspend workspace owner" });
        }

        
        if (targetMember.status === "suspended") {
            return res.status(400).json({ message: "Member is already suspended" });
        }

        
        targetMember.status = "suspended";
        targetMember.suspendedAt = new Date();
        targetMember.suspendedBy = adminId;
        await workspace.save();

        return res.json({
            message: "Member suspended successfully",
            userId: targetUserId
        });
    } catch (err) {
        console.error("SUSPEND MEMBER ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.restoreMember = async (req, res) => {
    try {
        const { workspaceId, userId: targetUserId } = req.params;
        const adminId = req.user?.sub;

        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        
        const admin = workspace.members.find(m => String(m.user) === String(adminId));
        if (!admin || (admin.role !== "admin" && admin.role !== "owner")) {
            return res.status(403).json({ message: "Only workspace admins can restore members" });
        }

        
        const targetMember = workspace.members.find(m => String(m.user) === String(targetUserId));
        if (!targetMember) {
            return res.status(404).json({ message: "User is not a member of this workspace" });
        }

        
        if (targetMember.status !== "suspended") {
            return res.status(400).json({ message: "Member is not suspended" });
        }

        
        targetMember.status = "active";
        targetMember.suspendedAt = null;
        targetMember.suspendedBy = null;
        await workspace.save();

        return res.json({
            message: "Member restored successfully",
            userId: targetUserId
        });
    } catch (err) {
        console.error("RESTORE MEMBER ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.changeRole = async (req, res) => {
    try {
        const { workspaceId, userId: targetUserId } = req.params;
        const { newRole } = req.body;
        const adminId = req.user?.sub;

        
        if (!['member', 'admin'].includes(newRole)) {
            return res.status(400).json({ message: "Invalid role. Must be 'member' or 'admin'" });
        }

        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        
        const admin = workspace.members.find(m => String(m.user) === String(adminId));
        if (!admin || (admin.role !== "admin" && admin.role !== "owner")) {
            return res.status(403).json({ message: "Only workspace admins can change member roles" });
        }

        
        if (String(targetUserId) === String(adminId)) {
            return res.status(400).json({ message: "You cannot change your own role" });
        }

        
        const targetMember = workspace.members.find(m => String(m.user) === String(targetUserId));
        if (!targetMember) {
            return res.status(404).json({ message: "User is not a member of this workspace" });
        }

        
        if (targetMember.role === "owner") {
            return res.status(403).json({ message: "Cannot change workspace owner's role" });
        }

        
        if (targetMember.role === newRole) {
            return res.status(400).json({ message: `Member is already ${newRole}` });
        }

        
        targetMember.role = newRole;
        await workspace.save();

        return res.json({
            message: "Member role updated successfully",
            userId: targetUserId,
            newRole
        });
    } catch (err) {
        console.error("CHANGE ROLE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.removeMember = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { userId: targetUserId } = req.body;
        const adminId = req.user?.sub;

        if (!targetUserId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        
        const admin = workspace.members.find(m => String(m.user) === String(adminId));
        if (!admin || (admin.role !== "admin" && admin.role !== "owner")) {
            return res.status(403).json({ message: "Only workspace admins can remove members" });
        }

        
        if (String(targetUserId) === String(adminId)) {
            return res.status(400).json({ message: "You cannot remove yourself. Use leave workspace instead." });
        }

        
        const targetMember = workspace.members.find(m => String(m.user) === String(targetUserId));
        if (!targetMember) {
            return res.status(404).json({ message: "User is not a member of this workspace" });
        }

        if (targetMember.role === "owner") {
            return res.status(403).json({ message: "Cannot remove workspace owner" });
        }

        
        workspace.members = workspace.members.filter(m => String(m.user) !== String(targetUserId));
        await workspace.save();

        
        await Channel.updateMany(
            { workspace: workspaceId },
            { $pull: { members: targetUserId } }
        );

        
        const DMSession = require("../../../models/DMSession");
        await DMSession.updateMany(
            { workspace: workspaceId, participants: targetUserId },
            { $set: { status: "closed" } }
        );

        
        const User = require("../../../models/User");
        await User.findByIdAndUpdate(targetUserId, {
            $pull: { workspaces: { workspace: workspaceId } }
        });

        return res.json({
            message: "Member removed successfully",
            removedUserId: targetUserId
        });
    } catch (err) {
        console.error("REMOVE MEMBER ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.bulkRevokeInvites = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { inviteIds, reason } = req.body;
        const userId = req.user?.sub;

        
        if (!Array.isArray(inviteIds) || inviteIds.length === 0) {
            return res.status(400).json({ message: "inviteIds must be a non-empty array" });
        }

        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        
        const member = workspace.members.find(m => String(m.user) === String(userId));
        if (!member || (member.role !== "admin" && member.role !== "owner")) {
            return res.status(403).json({ message: "Only workspace admins can revoke invites" });
        }

        const Invite = require("../../../models/Invite");

        
        const invites = await Invite.find({
            _id: { $in: inviteIds },
            workspace: workspaceId
        });

        if (invites.length === 0) {
            return res.status(404).json({ message: "No matching invites found" });
        }

        let revokedCount = 0;
        const errors = [];

        
        for (const invite of invites) {
            
            if (invite.status === "accepted") {
                errors.push({ id: invite._id, error: "Already accepted" });
                continue;
            }
            if (invite.status === "revoked") {
                errors.push({ id: invite._id, error: "Already revoked" });
                continue;
            }

            invite.status = "revoked";
            invite.revokedBy = userId;
            invite.revokedAt = new Date();
            invite.revokeReason = reason || "Bulk revoked by admin";
            await invite.save();
            revokedCount++;
        }

        return res.json({
            message: `Successfully revoked ${revokedCount} invitation(s)`,
            revokedCount,
            totalRequested: inviteIds.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (err) {
        console.error("BULK REVOKE INVITES ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.bulkDeleteInvites = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { inviteIds } = req.body;
        const userId = req.user?.sub;

        
        if (!Array.isArray(inviteIds) || inviteIds.length === 0) {
            return res.status(400).json({ message: "inviteIds must be a non-empty array" });
        }

        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        
        const member = workspace.members.find(m => String(m.user) === String(userId));
        if (!member || (member.role !== "admin" && member.role !== "owner")) {
            return res.status(403).json({ message: "Only workspace admins can delete invites" });
        }

        const Invite = require("../../../models/Invite");

        const _invitesToDelete = await Invite.find({
            _id: { $in: inviteIds },
            workspace: workspaceId
        }).lean();

        
        const now = new Date();
        const result = await Invite.deleteMany({
            _id: { $in: inviteIds },
            workspace: workspaceId,
            $or: [
                { status: "revoked" },
                { status: "expired" },
                { status: "accepted" },
                { used: true },  
                { status: "pending", expiresAt: { $lt: now } }
            ]
        });

        
        if (result.deletedCount === 0) {
            console.warn('⚠️ No invitations were deleted - they may be active pending invitations');
        }

        return res.json({
            message: result.deletedCount > 0
                ? `Successfully deleted ${result.deletedCount} invitation(s)`
                : 'No invitations were deleted (active pending invitations cannot be deleted)',
            deletedCount: result.deletedCount,
            totalRequested: inviteIds.length
        });
    } catch (err) {
        console.error("BULK DELETE INVITES ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.cleanupExpiredInvites = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user?.sub;

        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        
        const member = workspace.members.find(m => String(m.user) === String(userId));
        if (!member || (member.role !== "admin" && member.role !== "owner")) {
            return res.status(403).json({ message: "Only workspace admins can cleanup invites" });
        }

        const Invite = require("../../../models/Invite");
        const now = new Date();

        
        const result = await Invite.deleteMany({
            workspace: workspaceId,
            status: "pending",
            expiresAt: { $lt: now }
        });

        return res.json({
            message: `Successfully cleaned up ${result.deletedCount} expired invitation(s)`,
            deletedCount: result.deletedCount
        });
    } catch (err) {
        console.error("CLEANUP EXPIRED INVITES ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
