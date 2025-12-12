// server/controllers/workspaceController.js
const Workspace = require("../models/Workspace");
const Channel = require("../models/Channel");
const User = require("../models/User");
const { createInvite } = require("../utils/invite");
const sendEmail = require("../utils/sendEmail");

/**
 * Create new workspace (Personal or Company)
 * POST /api/workspaces
 */
exports.createWorkspace = async (req, res) => {
  try {
    const { companyId, name, description, icon, color } = req.body;
    const userId = req.user?.sub;

    if (!name) return res.status(400).json({ message: "Workspace name is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Determine workspace type
    const isPersonalWorkspace = !companyId;

    // If company workspace, verify user belongs to company
    if (companyId) {
      if (String(user.companyId) !== String(companyId)) {
        return res.status(403).json({ message: "Not a company member" });
      }

      // Check if user has permission to create workspaces
      const role = user.companyRole;
      if (!role || (role !== "admin" && role !== "owner" && role !== "manager")) {
        return res.status(403).json({ message: "Only company admins/managers may create workspaces" });
      }
    }

    // Create workspace
    const workspace = await Workspace.create({
      company: companyId || null,
      type: isPersonalWorkspace ? "personal" : "company",
      name: name.trim(),
      description: description || "",
      icon: icon || null,
      color: color || null,
      createdBy: userId,
      members: [{ user: userId, role: "owner" }],
      settings: {
        isPrivate: true, // Workspaces are private by default
        allowMemberInvite: true
      }
    });

    console.log(`✅ Workspace created: ${workspace.name} (${workspace.type})`);

    // Create default channels (#general and #announcements)
    const generalChannel = await Channel.create({
      workspace: workspace._id,
      company: companyId || null,
      name: "general",
      description: "General discussion",
      isPrivate: false,
      isDefault: true,
      createdBy: userId,
      members: [userId]
    });

    const announcementsChannel = await Channel.create({
      workspace: workspace._id,
      company: companyId || null,
      name: "announcements",
      description: "Announcements and updates",
      isPrivate: false,
      isDefault: true,
      createdBy: userId,
      members: [userId]
    });

    console.log(`   ✅ Default channels created: #general, #announcements`);

    // Update workspace with default channels
    workspace.defaultChannels = [generalChannel._id, announcementsChannel._id];
    await workspace.save();

    // Add workspace to user's workspaces list
    user.workspaces.push({
      workspace: workspace._id,
      role: "owner"
    });

    // If personal workspace, set as personalWorkspace
    if (isPersonalWorkspace && !user.personalWorkspace) {
      user.personalWorkspace = workspace._id;
    }

    await user.save();

    return res.status(201).json({
      message: "Workspace created successfully",
      workspace: {
        id: workspace._id,
        name: workspace.name,
        type: workspace.type,
        icon: workspace.icon,
        color: workspace.color,
        defaultChannels: workspace.defaultChannels
      }
    });
  } catch (err) {
    console.error("CREATE WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * List workspaces for current user (ONLY workspaces user is a member of)
 * GET /api/workspaces/my
 */
exports.listMyWorkspaces = async (req, res) => {
  try {
    const userId = req.user?.sub;

    const user = await User.findById(userId).populate({
      path: 'workspaces.workspace',
      select: 'name description icon color type company members defaultChannels'
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    // Filter to only return workspaces where user is actually a member
    const workspaces = user.workspaces
      .filter(ws => ws.workspace) // Remove null/deleted workspaces
      .map(ws => ({
        id: ws.workspace._id,
        name: ws.workspace.name,
        description: ws.workspace.description,
        icon: ws.workspace.icon,
        color: ws.workspace.color,
        type: ws.workspace.type,
        role: ws.role,
        memberCount: ws.workspace.members?.length || 0,
        isPersonal: ws.workspace.type === 'personal'
      }));

    return res.json({ workspaces });
  } catch (err) {
    console.error("LIST MY WORKSPACES ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.listWorkspaces = async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const userId = req.user?.sub;

    const user = await User.findById(userId);
    if (!user || String(user.companyId) !== String(companyId)) return res.status(403).json({ message: "Not a company member" });

    const workspaces = await Workspace.find({ company: companyId }).select("-__v").lean();
    return res.json({ workspaces });
  } catch (err) {
    console.error("LIST WORKSPACES ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.inviteToWorkspace = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { email, role = "member", daysValid = 7 } = req.body;
    const inviterId = req.user?.sub;

    const ws = await Workspace.findById(workspaceId);
    if (!ws) return res.status(404).json({ message: "Workspace not found" });

    const inviter = await User.findById(inviterId);
    if (!inviter || String(inviter.companyId) !== String(ws.company)) return res.status(403).json({ message: "Not allowed" });

    const inviterRoleCompany = inviter.rolesPerCompany ? inviter.rolesPerCompany[ws.company] : null;
    const isWorkspaceMember = ws.members.some(m => String(m.user) === String(inviterId));
    if (!(inviterRoleCompany === "admin" || inviterRoleCompany === "owner" || isWorkspaceMember)) {
      return res.status(403).json({ message: "Not allowed to invite" });
    }

    const { rawToken, invite } = await createInvite({
      email,
      companyId: ws.company,
      workspaceId: ws._id,
      role,
      invitedBy: inviterId,
      daysValid
    });

    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${rawToken}&email=${encodeURIComponent(email)}`;

    try {
      await sendEmail({
        to: email,
        subject: `Invite to workspace ${ws.name}`,
        html: `You were invited to workspace ${ws.name}. Click to accept: <a href="${inviteLink}">${inviteLink}</a>`
      });
    } catch (e) { console.warn("Email send failed:", e?.message || e); }

    return res.json({ message: "Invite created", inviteId: invite._id, inviteLink });
  } catch (err) {
    console.error("INVITE TO WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get workspace members (for DM filtering - only show people in same workspace)
 * GET /api/workspaces/:workspaceId/members
 */
exports.getWorkspaceMembers = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?.sub;

    const workspace = await Workspace.findById(workspaceId).populate({
      path: 'members.user',
      select: 'username email profilePicture isOnline lastLoginAt'
    });

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // Verify user is a member of this workspace
    const isMember = workspace.members.some(m => String(m.user._id) === String(userId));
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    // Return all members except current user (for DM list)
    const members = workspace.members
      .filter(m => String(m.user._id) !== String(userId))
      .map(m => ({
        id: m.user._id,
        name: m.user.username,
        email: m.user.email,
        avatar: m.user.profilePicture,
        status: m.user.isOnline ? 'online' : 'offline',
        lastSeen: m.user.lastLoginAt,
        role: m.role
      }));

    return res.json({ members });
  } catch (err) {
    console.error("GET WORKSPACE MEMBERS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
