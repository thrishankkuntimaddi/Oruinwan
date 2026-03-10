// server/controllers/workspaceController.js
const Workspace = require("../../../models/Workspace");
const Channel = require("../channels/channel.model.js");
const User = require("../../../models/User");
const Message = require("../messages/message.model.js");
const DMSession = require("../../../models/DMSession");
const Task = require("../../../models/Task");
const Note = require("../../../models/Note");
const Update = require("../../../models/Update");
const Favorite = require("../../../models/Favorite");
const Invite = require("../../../models/Invite");
const { _createInvite } = require("../../../utils/invite");
const sendEmail = require("../../../utils/sendEmail");
const { handleError, _notFound, _badRequest, _forbidden } = require("../../../utils/responseHelpers");
const { _isMember, normalizeMemberFormat } = require("../../../utils/memberHelpers");
const conversationKeysService = require("../../modules/conversations/conversationKeys.service");

/**
 * Create new workspace (Personal or Company)
 * POST /api/workspaces
 */
exports.createWorkspace = async (req, res) => {
  try {
    const {
      companyId,
      name,
      description,
      icon,
      color,
      rules
    } = req.body;
    const userId = req.user?.sub;

    if (!name) return res.status(400).json({ message: "Workspace name is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // IMPORTANT: Always derive the company from the authenticated user's DB record.
    // We intentionally do NOT trust req.body.companyId as the source of truth:
    //   1. The /me endpoint returns companyId as a populated Company object, so if the
    //      frontend sends it back, String(companyId) = "[object Object]" — a mismatch.
    //   2. Security: a client should never be able to claim membership of a different company.
    // The raw ObjectId is always correct on the DB record fetched by User.findById above.
    const resolvedCompanyId = user.companyId ? String(user.companyId) : null;

    // Determine workspace type — based on DB record, not client payload
    const isCompanyWorkspace = !!resolvedCompanyId;
    const isPersonalWorkspace = !isCompanyWorkspace;

    // If company workspace, verify the user has permission to create workspaces
    if (isCompanyWorkspace) {
      const role = user.companyRole;
      if (!role || (role !== "admin" && role !== "owner" && role !== "manager")) {
        return res.status(403).json({ message: "Only company admins/managers may create workspaces" });
      }
    }

    // LIMIT CHECK: Only for personal (non-company) users
    if (isPersonalWorkspace) {
      const ownedWorkspacesCount = await Workspace.countDocuments({ createdBy: userId });
      if (ownedWorkspacesCount >= 3) {
        return res.status(403).json({
          message: "Free plan limit reached. You can only create up to 3 workspaces.",
          isLimitReached: true
        });
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
      company: resolvedCompanyId || null,
      type: isPersonalWorkspace ? "personal" : "company",
      name: name.trim(),
      description: description || "",
      icon: icon || "🚀", // Default icon
      color: color || "#2563eb", // Workspace brand color
      rules: rules || "", // Workspace rules and guidelines
      createdBy: userId,
      members: [{ user: userId, role: "owner" }],
      settings: {
        isPrivate: true, // Workspaces are private by default
        allowMemberInvite: true
      }
    });

    console.log("🏗 [PHASE 2] Workspace created:", workspace._id.toString());

    // Create default channels (#general and #announcements)
    const creationDate = new Date();
    const generalChannel = await Channel.create({
      workspace: workspace._id,
      company: resolvedCompanyId || null,
      name: "general",
      description: "General discussion",
      isPrivate: false,
      isDefault: true,
      createdBy: userId,
      members: [{ user: userId, joinedAt: creationDate }],
      systemEvents: [{
        type: 'channel_created',
        userId: userId,
        timestamp: creationDate
      }]
    });

    const announcementsChannel = await Channel.create({
      workspace: workspace._id,
      company: resolvedCompanyId || null,
      name: "announcements",
      description: "Announcements and updates",
      isPrivate: false,
      isDefault: true,
      createdBy: userId,
      members: [{ user: userId, joinedAt: creationDate }],
      systemEvents: [{
        type: 'channel_created',
        userId: userId,
        timestamp: creationDate
      }]
    });

    console.log("📢 [PHASE 2] Default channels created: general, announcements");

    // 🔐 PHASE 5: Generate conversation keys for default channels
    // This ensures ALL channels have encryption keys at creation time
    console.log(`🔐 [PHASE 5] Generating conversation keys for default channels...`);

    const channelsToBootstrap = [
      { channel: generalChannel, name: 'general' },
      { channel: announcementsChannel, name: 'announcements' }
    ];

    for (const { channel, name } of channelsToBootstrap) {
      try {
        await conversationKeysService.bootstrapConversationKey({
          conversationId: channel._id.toString(),
          conversationType: 'channel',
          workspaceId: workspace._id.toString(),
          members: [userId]
        });
        console.log(`✅ [PHASE 5] Bootstrapped conversation key for #${name}`);
      } catch (keyError) {
        // NON-FATAL: Log the error but do NOT rollback workspace creation.
        // Keys can be distributed later via the automatic repair mechanism.
        // This prevents a single crypto service failure from blocking workspace creation.
        console.error(`⚠️ [PHASE 5] Failed to bootstrap key for #${name} (non-fatal):`, keyError.message);
        console.warn(`   Workspace will be created without E2EE keys for #${name}.`);
        console.warn(`   Keys will be distributed via repair when E2EE is configured.`);
      }
    }

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

    console.log("👤 [PHASE 2] User added as member:", userId);

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
    return handleError(res, err, "CREATE WORKSPACE ERROR");
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
      select: '-__v'
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filter to only return workspaces where user is actually a member
    const workspacesWithOwner = await Promise.all(
      user.workspaces
        .filter(ws => ws.workspace) // Remove null/deleted workspaces
        .map(async (ws) => {
          // Populate the createdBy field separately
          const workspace = await Workspace.findById(ws.workspace._id)
            .populate('createdBy', 'username')
            .lean();

          return {
            id: ws.workspace._id,
            name: ws.workspace.name,
            description: ws.workspace.description,
            icon: ws.workspace.icon,
            color: ws.workspace.color || "#2563eb",
            rules: ws.workspace.rules || "",
            type: ws.workspace.type,
            role: ws.role,
            memberCount: ws.workspace.members?.length || 0,
            isPersonal: ws.workspace.type === 'personal',
            ownerName: workspace?.createdBy?.username || 'Unknown',  // ✅ Owner name
            isOwner: String(workspace?.createdBy?._id) === String(userId)  // ✅ Is owner check
          };
        })
    );

    return res.json({ workspaces: workspacesWithOwner });
  } catch (err) {
    return handleError(res, err, "LIST MY WORKSPACES ERROR");
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
    return handleError(res, err, "LIST WORKSPACES ERROR");
  }
};

/**
 * Get workspace members
 * GET /api/workspaces/:id/members
 */
exports.getWorkspaceMembers = async (req, res) => {
  try {
    // Support both :workspaceId (new routes) and :id (legacy routes)
    const workspaceId = req.params.workspaceId || req.params.id;
    const userId = req.user.sub;

    const workspace = await Workspace.findById(workspaceId)
      .populate('members.user', 'username email phone profilePicture isOnline userStatus profile');

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // Check if requester is a member
    const isMember = workspace.members.some(m => String(m.user._id) === String(userId));
    if (!isMember) {
      return res.status(403).json({ message: "Not a workspace member" });
    }

    // Format members — normalise to the shape expected by the settings modal
    const formattedMembers = workspace.members.map(m => ({
      _id: m.user._id,
      username: m.user.username,
      email: m.user.email,
      phone: m.user.phone,
      profilePicture: m.user.profilePicture,
      isOnline: m.user.isOnline,
      profile: m.user.profile,
      role: m.role,
      status: m.status || 'active',
      joinedAt: m.joinedAt
    }));

    return res.json({ members: formattedMembers });
  } catch (err) {
    return handleError(res, err, "GET WORKSPACE MEMBERS ERROR");
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

    // Delete all channels in this workspace
    const _deletedChannels = await Channel.deleteMany({ workspace: workspaceId });

    // Delete all messages in this workspace
    const _deletedMessages = await Message.deleteMany({ workspace: workspaceId });

    // Delete all DM sessions in this workspace
    const _deletedDMSessions = await DMSession.deleteMany({ workspace: workspaceId });

    // Delete all tasks in this workspace
    const _deletedTasks = await Task.deleteMany({ workspace: workspaceId });

    // Delete all notes in this workspace
    const _deletedNotes = await Note.deleteMany({ workspace: workspaceId });

    // Delete all updates in this workspace
    const _deletedUpdates = await Update.deleteMany({ workspace: workspaceId });

    // Delete all favorites in this workspace
    const _deletedFavorites = await Favorite.deleteMany({ workspace: workspaceId });

    // Delete all pending invites for this workspace
    const _deletedInvites = await Invite.deleteMany({ workspace: workspaceId });

    // Remove workspace from all users
    await User.updateMany(
      { "workspaces.workspace": workspaceId },
      { $pull: { workspaces: { workspace: workspaceId } } }
    );

    // Remove as personalWorkspace if applicable
    await User.updateMany(
      { personalWorkspace: workspaceId },
      { $unset: { personalWorkspace: "" } }
    );

    // Emit socket event BEFORE deletion so clients can react
    const io = req.app?.get("io");
    if (io) {
      io.to(`workspace_${workspaceId}`).emit("workspace-deleted", { workspaceId });
    }

    // Delete the workspace itself
    await Workspace.findByIdAndDelete(workspaceId);

    return res.json({ message: "Workspace deleted successfully" });
  } catch (err) {
    return handleError(res, err, "DELETE WORKSPACE ERROR");
  }
};

/**
 * Create workspace invites (supports both email and link-based invites)
 * POST /api/workspaces/:id/invite
 */
exports.inviteToWorkspace = async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.id;
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
    const Invite = require("../../../models/Invite");
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

        const _invite = await Invite.create({
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

        // Get inviter's name for the email
        const inviter = await User.findById(req.user.sub).select('username');
        const inviterName = inviter ? inviter.username : 'A team member';

        // Send email using professional template
        try {
          const { workspaceInvitationTemplate } = require('../../../utils/emailTemplates');
          const template = workspaceInvitationTemplate(
            workspace.name,
            inviterName,
            inviteLink,
            'Member',
            daysValid
          );

          await sendEmail({
            to: email,
            subject: template.subject,
            html: template.html,
            text: template.text
          });

        } catch (_e) {
          console.warn("⚠️ SMTP not configured — Email not sent");

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

      const _invite = await Invite.create({
        tokenHash,
        workspace: workspace._id,
        company: workspace.company,
        role,
        invitedBy: inviterId,
        expiresAt,
        inviteType: "link"
      });

      const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join-workspace?token=${raw}`;

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
    const Invite = require("../../../models/Invite");

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
    return handleError(res, err, "GET INVITE DETAILS ERROR");
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
    const Invite = require("../../../models/Invite");

    if (!token) {

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
        channel.members = normalizeMemberFormat(channel.members, channel.createdAt);

        // Now add the new member
        channel.members.push({
          user: userId,
          joinedAt: new Date()
        });

        await channel.save();
      }
    }

    // 🔐 PHASE 4: Distribute conversation keys to new member
    // After adding user to default channels, distribute existing conversation keys
    // This uses SERVER_KEK to unwrap workspace-encrypted keys and re-encrypt for new user
    console.log(`🔐 [PHASE 4] Distributing conversation keys to user ${userId}...`);
    for (const channel of defaultChannels) {
      try {
        // Check if conversation keys exist for this channel
        const hasKeys = await conversationKeysService.hasConversationKeys(channel._id, 'channel');

        if (hasKeys) {
          // Distribute existing key to new user (idempotent)
          const distributed = await conversationKeysService.distributeKeyToNewMember(
            channel._id,
            'channel',
            userId
          );

          if (distributed) {
            console.log(`✅ [PHASE 4] Distributed conversation key for #${channel.name} to user ${userId}`);
          } else {
            console.warn(`⚠️ [PHASE 4] Could not distribute key for #${channel.name} to user ${userId}`);
          }
        } else {
          console.log(`ℹ️ [PHASE 4] No conversation key exists for #${channel.name} yet (will be created on first message)`);
        }
      } catch (keyError) {
        // Non-blocking: log error but don't fail workspace join
        console.error(`❌ [PHASE 4] Key distribution failed for #${channel.name}:`, keyError.message);
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
      select: 'username email phone profilePicture isOnline userStatus profile lastLoginAt'
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
        phone: m.user.phone,  // Include phone
        profilePicture: m.user.profilePicture,  // Changed from 'avatar' to 'profilePicture'
        userStatus: m.user.userStatus,  // Include user status
        profile: m.user.profile,  // Include profile
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
      .select('name description isPrivate isDefault isDiscoverable members createdBy createdAt workspace admins systemEvents')
      .populate('createdBy', 'firstName lastName')
      .sort({ isDefault: -1, createdAt: 1 }) // Default channels first, then by creation time
      .lean();

    // Populate systemEvents user names
    const User = require('../../../models/User');
    for (const channel of allChannels) {
      // Add creator name
      if (channel.createdBy) {
        channel.creatorName = `${channel.createdBy.firstName || ''} ${channel.createdBy.lastName || ''}`.trim() || 'Unknown';
      }

      //Populate systemEvents with user names (only if not already set)
      if (channel.systemEvents && channel.systemEvents.length > 0) {
        for (const event of channel.systemEvents) {
          if (event.userId && !event.userName) {
            const user = await User.findById(event.userId).select('firstName lastName username').lean();
            if (user) {
              event.userName = user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
            }
          }
        }
      }
    }

    // 🔒 CRITICAL: Filter channels based on privacy AND discoverability
    // - Public channels (isPrivate = false):
    //   - If isDiscoverable = true: Show to all workspace members
    //   - If isDiscoverable = false: Show ONLY to channel members
    // - Private channels (isPrivate = true): Show ONLY to members of that channel
    const visibleChannels = allChannels.filter(channel => {
      // Check if user is a member of this channel
      const isMemberOfChannel = channel.members.some(m => {
        const memberId = m.user ? m.user.toString() : m.toString();
        return memberId === userId.toString();
      });

      if (!channel.isPrivate) {
        // Public channel
        if (channel.isDiscoverable) {
          // Discoverable public channel - visible to all workspace members
          return true;
        } else {
          // Non-discoverable public channel - only visible to members
          return isMemberOfChannel;
        }
      } else {
        // Private channel - only visible if user is a member
        return isMemberOfChannel;
      }
    });

    // Add isMember flag to each visible channel
    const channelsWithMembershipInfo = visibleChannels.map(channel => {
      const isMember = channel.members.some(m => {
        const memberId = m.user ? m.user.toString() : m.toString();
        return memberId === userId.toString();
      });

      return {
        ...channel,
        isMember // Add membership flag for frontend
      };
    });

    return res.json({ channels: channelsWithMembershipInfo });
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
    const { name, description, isPrivate, isDiscoverable, members: channelMembers } = req.body;
    const userId = req.user?.sub;

    if (!name) {
      return res.status(400).json({ message: "Channel name is required" });
    }

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

    // Determine if channel is private based on explicit isPrivate flag
    const isPrivateChannel = isPrivate === true;

    // For BOTH public and private channels: only add selected members + creator
    // The difference is in discoverability (controlled by isPrivate flag)
    // Public channels: discoverable + self-joinable by workspace members
    // Private channels: invite-only, not visible to non-members

    console.log(`🔍 [DEBUG] Channel creation request:`, {
      channelMembers,
      channelMembersType: typeof channelMembers,
      channelMembersLength: channelMembers?.length,
      userId,
      isPrivate: isPrivateChannel
    });

    // Ensure creator is always included
    const finalMemberIds = channelMembers && channelMembers.length > 0
      ? [...new Set([userId, ...channelMembers])]
      : [userId]; // If no members specified, just the creator

    console.log(`🔍 [DEBUG] finalMemberIds:`, finalMemberIds);

    const finalMembers = finalMemberIds.map(memberId => ({
      user: memberId,
      joinedAt: new Date()
    }));

    // Create channel
    const channel = await Channel.create({
      workspace: workspaceId,
      company: workspace.company || null,
      name: name.toLowerCase().trim(),
      description: description || "",
      isPrivate: isPrivateChannel, // Use explicit flag from request
      isDiscoverable: isPrivateChannel ? false : (isDiscoverable !== undefined ? isDiscoverable : true), // Private channels are never discoverable
      isDefault: false, // User-created channels are not default
      createdBy: userId,
      members: finalMembers,
      admins: [userId] // Creator is initial admin
    });

    // 🔐 PHASE 5: Generate conversation key immediately at channel birth
    // This ensures every channel is encrypted BEFORE any member can join or send messages
    // Encrypts for ALL initial members (Phase 5 invariant)
    try {
      console.log(`🔐 [PHASE 5] Channel created, generating conversation key for "${channel.name}"...`);

      // Generate conversation key server-side (PHASE 5)
      // Pass ALL initial member IDs for encryption (Phase 5 invariant)
      await conversationKeysService.generateConversationKeyServerSide(
        channel._id.toString(),
        'channel',
        workspaceId,
        finalMemberIds,  // ALL initial members (not just creator)
        userId           // Creator ID for validation
      );

      console.log(`✅ [PHASE 5] Conversation key created for channel: ${channel.name}`);

    } catch (keyError) {
      console.error(`❌ [PHASE 5] Failed to generate conversation key:`, keyError);

      // Rollback channel creation
      await Channel.findByIdAndDelete(channel._id);

      // Check for specific error types
      if (keyError.message && keyError.message.includes('IDENTITY_KEY_REQUIRED')) {
        return res.status(400).json({
          message: 'Cannot create encrypted channel: Identity key not found. Please ensure E2EE is initialized.',
          error: 'IDENTITY_KEY_REQUIRED'
        });
      }

      return res.status(500).json({
        message: 'Failed to initialize channel encryption',
        error: 'KEY_GENERATION_FAILED'
      });
    }

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
        _id: m.user._id,  // Primary ID field
        id: m.user._id,   // Add 'id' as alias for frontend compatibility
        name: m.user.username,  // Add 'name' mapped from username for MessageInfoModal
        username: m.user.username,  // Keep username for backward compatibility
        email: m.user.email,
        profilePicture: m.user.profilePicture,  // Changed from 'avatar' to 'profilePicture' for consistency
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
        return a.username.localeCompare(b.username);  // Changed from 'name' to 'username'
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

    const io = req.app?.get("io");
    if (io) {
      io.to(`workspace_${id}`).emit("workspace-updated", {
        workspaceId: workspace._id,
        name: workspace.name
      });
    }

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

    const io = req.app?.get("io");
    if (io) {
      io.to(`workspace_${id}`).emit("workspace-updated", {
        workspaceId: workspace._id,
        name: workspace.name,
        icon: workspace.icon,
        color: workspace.color,
        description: workspace.description,
        settings: workspace.settings
      });
    }

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
    const id = req.params.workspaceId || req.params.id;
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
