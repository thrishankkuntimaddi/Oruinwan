// server/controllers/workspaceController.js
const Workspace = require("../models/Workspace");
const Channel = require("../models/Channel");
const User = require("../models/User");
const Message = require("../models/Message");
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

    // ✅ Check if user already OWNS a workspace with this name (not just member of)
    const existingWorkspace = await Workspace.findOne({
      name: name.trim(),
      createdBy: userId  // Only check workspaces this user created
    });

    if (existingWorkspace) {
      return res.status(400).json({
        message: `Workspace name already exists in your account`
      });
    }

    // Create workspace with icon and color
    const workspace = await Workspace.create({
      company: companyId || null,
      type: isPersonalWorkspace ? "personal" : "company",
      name: name.trim(),
      description: description || "",
      icon: icon || "🚀", // Default icon
      color: color || "#2563eb", // Workspace brand color
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
      members: [{ user: userId, joinedAt: new Date() }]
    });

    const announcementsChannel = await Channel.create({
      workspace: workspace._id,
      company: companyId || null,
      name: "announcements",
      description: "Announcements and updates",
      isPrivate: false,
      isDefault: true,
      createdBy: userId,
      members: [{ user: userId, joinedAt: new Date() }]
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
        color: workspace.color || "#2563eb",
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
    console.log('🔍 listMyWorkspaces called for user:', userId);

    const user = await User.findById(userId).populate({
      path: 'workspaces.workspace',
      select: '-__v'
    });

    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({ message: "User not found" });
    }

    console.log('👤 User found:', user.username);
    console.log('📋 User workspaces array:', user.workspaces);

    // Filter to only return workspaces where user is actually a member
    const workspacesWithOwner = await Promise.all(
      user.workspaces
        .filter(ws => ws.workspace) // Remove null/deleted workspaces
        .map(async (ws) => {
          // Populate the createdBy field separately
          const workspace = await Workspace.findById(ws.workspace._id)
            .populate('createdBy', 'username')
            .lean();

          console.log(`📊 Workspace "${ws.workspace.name}": createdBy =`, workspace?.createdBy);

          return {
            id: ws.workspace._id,
            name: ws.workspace.name,
            description: ws.workspace.description,
            icon: ws.workspace.icon,
            color: ws.workspace.color || "#2563eb",
            type: ws.workspace.type,
            role: ws.role,
            memberCount: ws.workspace.members?.length || 0,
            isPersonal: ws.workspace.type === 'personal',
            ownerName: workspace?.createdBy?.username || 'Unknown',  // ✅ Owner name
            isOwner: String(workspace?.createdBy?._id) === String(userId)  // ✅ Is owner check
          };
        })
    );

    console.log('✅ Returning workspaces with owner info:', workspacesWithOwner);
    return res.json({ workspaces: workspacesWithOwner });
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

/**
 * Get workspace members
 * GET /api/workspaces/:id/members
 */
exports.getWorkspaceMembers = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user.sub;

    const workspace = await Workspace.findById(workspaceId)
      .populate('members.user', 'username email profilePicture');

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // Check if requester is a member
    const isMember = workspace.members.some(m => String(m.user._id) === String(userId));
    if (!isMember) {
      return res.status(403).json({ message: "Not a workspace member" });
    }

    // Format members with user data
    const formattedMembers = workspace.members.map(m => ({
      _id: m.user._id,
      username: m.user.username,
      email: m.user.email,
      profilePicture: m.user.profilePicture,
      role: m.role,
      joinedAt: m.joinedAt
    }));

    return res.json({ members: formattedMembers });
  } catch (err) {
    console.error("GET WORKSPACE MEMBERS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Delete workspace (only owner can delete)
 * DELETE /api/workspaces/:id
 */
exports.deleteWorkspace = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user?.sub;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // Check if user is the owner
    const memberData = workspace.members.find(m => String(m.user) === String(userId));
    if (!memberData || memberData.role !== "owner") {
      return res.status(403).json({ message: "Only workspace owner can delete the workspace" });
    }

    console.log(`🗑️ Deleting workspace: ${workspace.name}`);

    // Delete all channels in this workspace
    const deletedChannels = await Channel.deleteMany({ workspace: workspaceId });
    console.log(`   ✅ Deleted ${deletedChannels.deletedCount} channels`);

    // Delete all messages in this workspace
    const deletedMessages = await Message.deleteMany({ workspace: workspaceId });
    console.log(`   ✅ Deleted ${deletedMessages.deletedCount} messages`);

    // Remove workspace from all users
    await User.updateMany(
      { "workspaces.workspace": workspaceId },
      { $pull: { workspaces: { workspace: workspaceId } } }
    );
    console.log(`   ✅ Removed workspace from all users`);

    // Remove as personalWorkspace if applicable
    await User.updateMany(
      { personalWorkspace: workspaceId },
      { $unset: { personalWorkspace: "" } }
    );

    // Delete the workspace itself
    await Workspace.findByIdAndDelete(workspaceId);
    console.log(`   ✅ Workspace deleted successfully`);

    return res.json({ message: "Workspace deleted successfully" });
  } catch (err) {
    console.error("DELETE WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Create workspace invites (supports both email and link-based invites)
 * POST /api/workspaces/:id/invite
 */
exports.inviteToWorkspace = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { emails, inviteType = "link", role = "member", daysValid = 7 } = req.body;
    const inviterId = req.user?.sub;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    // Check if inviter is a member of the workspace
    const isWorkspaceMember = workspace.members.some(m => String(m.user) === String(inviterId));
    if (!isWorkspaceMember) {
      return res.status(403).json({ message: "You must be a member to invite others" });
    }

    const invites = [];
    const Invite = require("../models/Invite");
    const crypto = require("crypto");
    const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");

    if (inviteType === "email" && emails) {
      // Email-based invites
      const emailList = emails.split(',').map(e => e.trim()).filter(Boolean);

      for (const email of emailList) {
        // Check if user exists in database
        const userExists = await User.findOne({ email });

        const raw = crypto.randomBytes(32).toString("hex");
        const tokenHash = sha256(raw);
        const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);

        const invite = await Invite.create({
          email,
          tokenHash,
          workspace: workspace._id,
          company: workspace.company,
          role,
          invitedBy: inviterId,
          expiresAt,
          inviteType: "email"
        });

        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join-workspace?token=${raw}`;

        // Send email
        try {
          await sendEmail({
            to: email,
            subject: `You're invited to join ${workspace.name} on Chttrix`,
            html: `
              <h2>You've been invited to join ${workspace.name}!</h2>
              <p>Click the link below to accept the invitation:</p>
              <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px;">Join Workspace</a>
              <p style="margin-top: 20px; color: #666;">This link will expire in ${daysValid} days and can only be used once.</p>
            `
          });
          console.log(`✅ Invitation email sent to: ${email}${userExists ? ' (existing user)' : ' (new user)'}`);
        } catch (e) {
          console.warn("⚠️ SMTP not configured — Email not sent");
          console.log('\n' + '='.repeat(80));
          console.log('📧 WORKSPACE INVITATION LINK (Copy and share manually)');
          console.log('='.repeat(80));
          console.log(`To: ${email}${userExists ? ' (existing user)' : ' (new user - will create account)'}`);
          console.log(`Workspace: ${workspace.name}`);
          console.log(`Role: ${role}`);
          console.log(`\nInvitation Link:`);
          console.log(`👉 ${inviteLink}`);
          console.log('\n' + '='.repeat(80) + '\n');
        }

        invites.push({ email, inviteLink, userExists: !!userExists });
      }

      return res.json({
        message: "Email invites sent successfully",
        invites
      });
    } else {
      // Link-based invite (one-time use)
      const raw = crypto.randomBytes(32).toString("hex");
      const tokenHash = sha256(raw);
      const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);

      const invite = await Invite.create({
        tokenHash,
        workspace: workspace._id,
        company: workspace.company,
        role,
        invitedBy: inviterId,
        expiresAt,
        inviteType: "link"
      });

      const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join-workspace?token=${raw}`;

      console.log('\n' + '='.repeat(80));
      console.log('🔗 SHAREABLE WORKSPACE INVITATION LINK GENERATED');
      console.log('='.repeat(80));
      console.log(`Workspace: ${workspace.name}`);
      console.log(`Role: ${role}`);
      console.log(`Expires: ${expiresAt.toLocaleString()}`);
      console.log(`\nInvitation Link:`);
      console.log(`👉 ${inviteLink}`);
      console.log('\n' + '='.repeat(80) + '\n');

      return res.json({
        message: "Invite link generated",
        inviteLink,
        expiresAt
      });
    }
  } catch (err) {
    console.error("INVITE TO WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get workspace details for invite preview
 * GET /api/workspaces/invite/:token
 */
exports.getInviteDetails = async (req, res) => {
  try {
    const { token } = req.params;
    const crypto = require("crypto");
    const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
    const Invite = require("../models/Invite");

    const tokenHash = sha256(token);
    const invite = await Invite.findOne({ tokenHash })
      .populate('workspace', 'name description icon metadata')
      .populate('invitedBy', 'username profilePicture');

    if (!invite) {
      return res.status(404).json({ message: "Invalid invitation link" });
    }

    if (invite.used) {
      return res.status(400).json({ message: "This invitation link has already been used" });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ message: "This invitation link has expired" });
    }

    const workspace = await Workspace.findById(invite.workspace);
    const memberCount = workspace.members.length;

    return res.json({
      workspaceName: workspace.name,
      workspaceDescription: workspace.description,
      workspaceIcon: workspace.icon,
      workspaceColor: workspace.color || "#2563eb",
      invitedBy: invite.invitedBy ? invite.invitedBy.username : 'Someone',
      memberCount,
      role: invite.role
    });
  } catch (err) {
    console.error("GET INVITE DETAILS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Accept workspace invite and join
 * POST /api/workspaces/join
 */
exports.joinWorkspace = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user?.sub;
    const crypto = require("crypto");
    const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
    const Invite = require("../models/Invite");

    console.log('🔍 JOIN WORKSPACE REQUEST:');
    console.log('  - Token received:', token ? 'Yes' : 'No');
    console.log('  - User ID:', userId);

    if (!token) {
      console.log('❌ No token provided');
      return res.status(400).json({ message: "Invite token is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const tokenHash = sha256(token);
    const invite = await Invite.findOne({ tokenHash });

    if (!invite) {
      return res.status(404).json({ message: "Invalid invitation link" });
    }

    if (invite.used) {
      return res.status(400).json({ message: "This invitation link has already been used" });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ message: "This invitation link has expired" });
    }

    // Get workspace
    const workspace = await Workspace.findById(invite.workspace);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // Check if user is already a member
    const alreadyMember = workspace.members.some(m => String(m.user) === String(userId));
    if (alreadyMember) {
      return res.status(400).json({ message: "You are already a member of this workspace" });
    }

    // Add user to workspace
    workspace.members.push({
      user: userId,
      role: invite.role,
      joinedAt: new Date()
    });
    await workspace.save();

    // Add workspace to user's workspaces
    user.workspaces.push({
      workspace: workspace._id,
      role: invite.role,
      joinedAt: new Date()
    });
    await user.save();

    // Auto-join default channels (#general and #announcements)
    const defaultChannels = await Channel.find({
      workspace: workspace._id,
      isDefault: true
    });

    for (const channel of defaultChannels) {
      // Check if already member (handle both old and new format)
      const isAlreadyMember = channel.members.some(m => {
        const memberId = m.user ? m.user.toString() : m.toString();
        return memberId === userId.toString();
      });

      if (!isAlreadyMember) {
        // 🔧 FIX: Convert all existing members to new format before adding new member
        // This prevents validation errors when Mongoose validates the entire array
        channel.members = channel.members.map(m => {
          // If it's already in new format, keep it
          if (m.user) return m;
          // If it's old format (just an ID), convert it
          return {
            user: m,
            joinedAt: channel.createdAt || new Date()
          };
        });

        // Now add the new member
        channel.members.push({
          user: userId,
          joinedAt: new Date()
        });

        await channel.save();
      }
    }

    // Mark invite as used
    invite.used = true;
    invite.usedBy = userId;
    invite.usedAt = new Date();
    await invite.save();

    // 📣 Real-time notification: Notify the workspace room that someone joined
    const io = req.app.get("io");
    if (io) {
      io.to(`workspace_${workspace._id.toString()}`).emit("workspace-joined", {
        workspaceId: workspace._id,
        userId: userId,
        username: user.username,
        role: invite.role
      });
    }

    console.log(`✅ User ${user.username} joined workspace ${workspace.name}`);

    return res.json({
      message: "Successfully joined workspace",
      workspace: {
        id: workspace._id,
        name: workspace.name,
        icon: workspace.icon,
        color: workspace.color || "#2563eb"
      }
    });
  } catch (err) {
    console.error("JOIN WORKSPACE ERROR:", err);
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
        _id: m.user._id,  // Changed from 'id' to '_id'
        username: m.user.username,  // Changed from 'name' to 'username'
        email: m.user.email,
        profilePicture: m.user.profilePicture,  // Changed from 'avatar' to 'profilePicture'
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

/**
 * Get workspace channels (only channels for this workspace)
 * GET /api/workspaces/:workspaceId/channels
 */
exports.getWorkspaceChannels = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?.sub;

    console.log(`📡 Fetching channels for workspace: ${workspaceId}, user: ${userId}`);

    // Verify workspace exists
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // Verify user is a member of this workspace
    const isMember = workspace.members.some(m => String(m.user) === String(userId));
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    // Fetch ALL channels for this workspace
    const allChannels = await Channel.find({ workspace: workspaceId })
      .select('name description isPrivate isDefault members createdBy createdAt workspace')
      .sort({ isDefault: -1, createdAt: 1 }) // Default channels first, then by creation time
      .lean();

    // 🔒 CRITICAL: Filter channels based on privacy
    // - Public channels (isPrivate = false): Show to all workspace members
    // - Private channels (isPrivate = true): Show ONLY to members of that channel
    const visibleChannels = allChannels.filter(channel => {
      if (!channel.isPrivate) {
        // Public channel - visible to all workspace members
        console.log(`  📢 #${channel.name} - PUBLIC - showing to all`);
        return true;
      } else {
        // Private channel - only visible if user is a member
        const isMemberOfChannel = channel.members.some(m => {
          const memberId = m.user ? m.user.toString() : m.toString();
          return memberId === userId.toString();
        });

        console.log(`  🔒 #${channel.name} - PRIVATE - user ${userId} is ${isMemberOfChannel ? 'MEMBER ✅' : 'NOT member ❌'}`);
        console.log(`     Members (${channel.members.length}):`, channel.members.map(m => {
          const id = m.user ? m.user.toString() : m.toString();
          return id.substring(id.length - 4); // Last 4 chars for brevity
        }));

        return isMemberOfChannel;
      }
    });

    console.log(`✅ Found ${allChannels.length} total channels, ${visibleChannels.length} visible to user ${userId}`);

    // 🔍 DEBUG: Log each channel's visibility
    console.log('\n🔍 CHANNEL VISIBILITY:');
    allChannels.forEach((ch, idx) => {
      const isVisible = visibleChannels.some(vc => vc._id.toString() === ch._id.toString());
      console.log(`${idx + 1}. #${ch.name} - ${ch.isPrivate ? '🔒 PRIVATE' : '🌐 PUBLIC'} - ${isVisible ? '✅ VISIBLE' : '❌ HIDDEN'}`);
    });

    return res.json({ channels: visibleChannels });
  } catch (err) {
    console.error("GET WORKSPACE CHANNELS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Create channel in workspace
 * POST /api/workspaces/:workspaceId/channels
 */
exports.createWorkspaceChannel = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, description, isPrivate, members: channelMembers } = req.body;
    const userId = req.user?.sub;

    if (!name) {
      return res.status(400).json({ message: "Channel name is required" });
    }

    console.log(`📡 Creating channel "${name}" in workspace: ${workspaceId}`);

    // Verify workspace exists
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // Verify user is a member of this workspace
    const isMember = workspace.members.some(m => String(m.user) === String(userId));
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    // Check if channel name already exists in this workspace
    const existingChannel = await Channel.findOne({
      workspace: workspaceId,
      name: name.toLowerCase().trim()
    });

    if (existingChannel) {
      return res.status(400).json({ message: "A channel with this name already exists" });
    }

    // 🔒 CRITICAL VALIDATION: Channel members must be subset of workspace members
    // This prevents adding users who are not in the workspace
    if (channelMembers && channelMembers.length > 0) {
      const workspaceMemberIds = workspace.members.map(m => String(m.user));
      const invalidMembers = channelMembers.filter(memberId =>
        !workspaceMemberIds.includes(String(memberId))
      );

      if (invalidMembers.length > 0) {
        console.error('🚨 [createWorkspaceChannel] SECURITY: Attempt to add non-workspace members to channel!', {
          workspaceId,
          invalidMembers
        });
        return res.status(403).json({
          message: "Cannot add users who are not workspace members to this channel",
          invalidMembers
        });
      }
    }

    // ✨ NEW LOGIC: Determine channel type based on member selection
    const isPublicChannel = !channelMembers || channelMembers.length === 0;

    let finalMembers;
    if (isPublicChannel) {
      // 🌐 PUBLIC CHANNEL: Include ALL workspace members (current + future)
      console.log('🌐 Creating PUBLIC channel - including all workspace members');
      finalMembers = workspace.members.map(m => ({
        user: m.user,
        joinedAt: new Date()
      }));
    } else {
      // 🔒 PRIVATE CHANNEL: Only selected members + creator
      console.log(`🔒 Creating PRIVATE channel - ${channelMembers.length} selected members + creator`);

      // Ensure creator is always included
      const finalMemberIds = [...new Set([userId, ...channelMembers])];

      finalMembers = finalMemberIds.map(memberId => ({
        user: memberId,
        joinedAt: new Date()
      }));
    }

    // Create channel
    const channel = await Channel.create({
      workspace: workspaceId,
      company: workspace.company || null,
      name: name.toLowerCase().trim(),
      description: description || "",
      isPrivate: !isPublicChannel, // ✨ Determined by member selection
      isDefault: false, // User-created channels are not default
      createdBy: userId,
      members: finalMembers,
      admins: [userId] // Creator is initial admin
    });

    console.log(`✅ Channel created: #${channel.name} (${isPublicChannel ? 'PUBLIC' : 'PRIVATE'}) with ${finalMembers.length} members`);

    return res.status(201).json({
      message: "Channel created successfully",
      channel: {
        _id: channel._id,
        name: channel.name,
        description: channel.description,
        isPrivate: channel.isPrivate,
        isDefault: channel.isDefault,
        members: channel.members
      }
    });
  } catch (err) {
    console.error("CREATE WORKSPACE CHANNEL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get ALL workspace members including current user (for settings modal)
 * GET /api/workspaces/:workspaceId/all-members
 */
exports.getAllWorkspaceMembers = async (req, res) => {
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

    // Return ALL members including current user
    const members = workspace.members
      .map(m => ({
        id: m.user._id,
        name: m.user.username,
        email: m.user.email,
        avatar: m.user.profilePicture,
        status: m.user.isOnline ? 'online' : 'offline',
        lastSeen: m.user.lastLoginAt,
        role: m.role,
        isCurrentUser: String(m.user._id) === String(userId)
      }))
      // Sort by role (owner first, then admin, then members) and then by name
      .sort((a, b) => {
        const roleOrder = { owner: 0, admin: 1, member: 2 };
        const roleCompare = (roleOrder[a.role] || 2) - (roleOrder[b.role] || 2);
        if (roleCompare !== 0) return roleCompare;
        return a.name.localeCompare(b.name);
      });

    return res.json({ members });
  } catch (err) {
    console.error("GET ALL WORKSPACE MEMBERS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Rename workspace (admin/owner only)
 * PUT /api/workspaces/:id/rename
 */
exports.renameWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user?.sub;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Workspace name is required" });
    }

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // Check if user is admin or owner
    const member = workspace.members.find(m => String(m.user) === String(userId));
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
      return res.status(403).json({ message: "Only admins and owners can rename the workspace" });
    }

    // Check if user already has another workspace with this name
    const existingWorkspace = await Workspace.findOne({
      _id: { $ne: id }, // Exclude current workspace
      name: name.trim(),
      'members.user': userId
    });

    if (existingWorkspace) {
      return res.status(400).json({
        message: `You already have a workspace named "${name.trim()}". Please choose a different name.`
      });
    }

    // Update workspace name
    workspace.name = name.trim();
    await workspace.save();

    console.log(`✅ Workspace renamed to: ${workspace.name}`);

    return res.json({
      message: "Workspace renamed successfully",
      workspace: {
        id: workspace._id,
        name: workspace.name
      }
    });
  } catch (err) {
    console.error("RENAME WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


/**
 * Update workspace settings (admin/owner only)
 * PUT /api/workspaces/:id
 */
exports.updateWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const { icon, description, settings } = req.body;
    const userId = req.user?.sub;

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // Check if user is admin or owner
    const member = workspace.members.find(m => String(m.user) === String(userId));
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
      return res.status(403).json({ message: "Only admins and owners can update workspace settings" });
    }

    // Update fields if provided
    if (icon !== undefined) workspace.icon = icon;
    if (req.body.color !== undefined) workspace.color = req.body.color;
    if (description !== undefined) workspace.description = description;
    if (settings) {
      if (settings.allowMemberChannelCreation !== undefined) {
        workspace.settings.allowMemberChannelCreation = settings.allowMemberChannelCreation;
      }
      if (settings.allowMemberInvite !== undefined) {
        workspace.settings.allowMemberInvite = settings.allowMemberInvite;
      }
      if (settings.requireAdminApproval !== undefined) {
        workspace.settings.requireAdminApproval = settings.requireAdminApproval;
      }
      if (settings.isDiscoverable !== undefined) {
        workspace.settings.isDiscoverable = settings.isDiscoverable;
      }
    }

    await workspace.save();

    console.log(`✅ Workspace updated: ${workspace.name}`);

    return res.json({
      message: "Workspace updated successfully",
      workspace: {
        id: workspace._id,
        name: workspace.name,
        icon: workspace.icon,
        description: workspace.description,
        settings: workspace.settings
      }
    });
  } catch (err) {
    console.error("UPDATE WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get workspace statistics
 * GET /api/workspaces/:id/stats
 */
exports.getWorkspaceStats = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.sub;

    const workspace = await Workspace.findById(id).populate('createdBy', 'username email');
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // Verify user is a member
    const isMember = workspace.members.some(m => String(m.user) === String(userId));
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    // Get channel count
    const channelCount = await Channel.countDocuments({ workspace: id });

    // Get message count
    const messageCount = await Message.countDocuments({ workspace: id });

    return res.json({
      memberCount: workspace.members.length,
      channelCount,
      messageCount,
      createdAt: workspace.createdAt,
      creator: {
        username: workspace.createdBy?.username,
        email: workspace.createdBy?.email
      },
      description: workspace.description,
      settings: workspace.settings
    });
  } catch (err) {
    console.error("GET WORKSPACE STATS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
