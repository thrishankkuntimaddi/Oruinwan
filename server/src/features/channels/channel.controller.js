// server/controllers/channelController.js
const Channel = require("./channel.model.js");
const User = require("../../../models/User");
const Workspace = require("../../../models/Workspace");
const Message = require("../messages/message.model.js");
const { saveWithRetry } = require("../../../utils/mongooseRetry");
const { handleError, _notFound, badRequest, forbidden } = require("../../../utils/responseHelpers");
const { _extractMemberId, isMember, normalizeMemberFormat } = require("../../../utils/memberHelpers");
const { _emitToWorkspace, _emitToChannel, _emitToUser, _emitToUsers } = require("../../../utils/socketHelpers");
const conversationKeysService = require("../../modules/conversations/conversationKeys.service");

/**
 * Check if a user is the owner of the workspace that contains a channel.
 * workspaceOwner sits above channelAdmin in the hierarchy.
 *
 * @param {string} userId
 * @param {string|ObjectId} workspaceId
 * @returns {Promise<boolean>}
 */
async function isWorkspaceOwner(userId, workspaceId) {
  if (!workspaceId) return false;
  const ws = await Workspace.findById(workspaceId).select('members').lean();
  if (!ws) return false;
  return ws.members.some(
    m => m.user?.toString() === userId.toString() &&
      (m.role === 'owner' || m.role === 'admin')
  );
}

/**
 * Create channel (public or private).
 * Body: { name, description?, isPrivate?, memberIds?: [id,...] }
 * Creator becomes createdBy and is added to members.
 */
exports.createChannel = async (req, res) => {
  console.log('🔄 [CHANNEL:MODULAR] Function invoked: createChannel');
  try {
    const userId = req.user.sub;
    const { name, description = "", isPrivate = false, isDiscoverable = true, memberIds = [], workspaceId } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ message: "Workspace ID is required" });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Channel name required" });
    }

    // Normalize members: include creator
    const distinctMemberIds = Array.from(new Set([userId, ...(memberIds || [])].map(String)));

    // ENFORCE MIN 3 RULE
    if (distinctMemberIds.length < 3) {
      return res.status(400).json({ message: "At least 3 members are required to create a channel." });
    }

    // New format: members: [{ user, joinedAt }]
    const members = distinctMemberIds.map(id => ({
      user: id,
      joinedAt: new Date()
    }));

    const channel = await Channel.create({
      workspace: workspaceId,
      name: name.trim(),
      description,
      members,
      createdBy: userId,
      isPrivate,
      isDiscoverable: isPrivate ? false : isDiscoverable, // Private channels cannot be discoverable
    });

    // 🔐 PHASE 5: Generate conversation key immediately at channel birth
    // This ensures every channel is encrypted BEFORE any member can join or send messages
    try {
      console.log(`🔐 [PHASE 5] Channel created, generating conversation key...`);

      // Generate conversation key server-side (PHASE 5)
      // Pass ALL initial member IDs for encryption (Phase 5 invariant)
      await conversationKeysService.generateConversationKeyServerSide(
        channel._id.toString(),
        'channel',
        workspaceId,
        distinctMemberIds,  // ALL initial members
        userId  // Creator ID for validation
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

    const payload = {
      _id: channel._id,
      name: channel.name,
      description: channel.description,
      members: channel.members,
      isPrivate: channel.isPrivate,
      createdBy: channel.createdBy,
      createdAt: channel.createdAt,
      workspace: channel.workspace,
    };

    const io = req.app?.get("io");
    if (io) {
      // Notify only invited members if private, or the whole workspace room if public
      if (isPrivate) {
        distinctMemberIds.forEach(mId => {
          io.to(`user_${mId}`).emit("channel-created", payload);
        });
      } else {
        io.to(`workspace_${workspaceId}`).emit("channel-created", payload);
      }
    }

    // ── System message: "John created #general" ──────────────────────────
    try {
      const creator = await User.findById(userId).select('username').lean();
      const systemMsg = await Message.create({
        type: 'system',
        systemEvent: 'channel_created',
        sender: userId,
        channel: channel._id,
        workspace: workspaceId,
        systemData: {
          userId,
          userName: creator?.username || 'Someone',
          channelId: channel._id,
          channelName: channel.name,
        },
      });

      if (io) {
        io.to(`channel:${channel._id}`).emit('new-message', systemMsg);
      }
      console.log(`📢 [SYSTEM] channel_created event emitted for #${channel.name}`);
    } catch (sysErr) {
      // Non-fatal: channel was created successfully, log and continue
      console.error('[SYSTEM MSG] Failed to create channel_created system message:', sysErr);
    }
    // ─────────────────────────────────────────────────────────────────────

    return res.status(201).json({ channel: payload });
  } catch (err) {
    return handleError(res, err, "CREATE CHANNEL ERROR");
  }
};

/**
 * Get channels for a specific workspace that the user is a member of
 * Query param: workspaceId (required)
 * 
 * Returns:
 * 1. Default channels (always visible)
 * 2. Public + discoverable channels (visible to all)
 * 3. Channels where user is a member (private or public non-discoverable)
 */
exports.getMyChannels = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ message: "Workspace ID is required" });
    }

    // Find channels that meet ANY of these criteria:
    // 1. Is a default channel (general, announcements)
    // 2. Is public AND discoverable
    // 3. User is a member
    const channels = await Channel.find({
      workspace: workspaceId,
      $or: [
        { isDefault: true },                                    // Rule 1: Default channels
        { isPrivate: false, isDiscoverable: true },            // Rule 2: Public + discoverable
        { 'members.user': userId }                              // Rule 3: User is member
      ]
    })
      .select("-__v")
      .lean();

    return res.json({ channels });
  } catch (err) {
    return handleError(res, err, "GET MY CHANNELS ERROR");
  }
};

/**
 * Get all public channels (for discovery)
 */
exports.getPublicChannels = async (req, res) => {
  try {
    // Return all public channels
    const channels = await Channel.find({ isPrivate: false })
      .select("_id name description members createdBy createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ channels });
  } catch (err) {
    return handleError(res, err, "GET PUBLIC CHANNELS ERROR");
  }
};

/**
 * Invite / add a member to a channel
 * POST /channels/:id/invite  { userId }
 * Only channel members (or createdBy) can invite (simple rule).
 */
exports.inviteToChannel = async (req, res) => {
  console.log('🔄 [CHANNEL:MODULAR] Function invoked: inviteToChannel');
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { userId: inviteeId } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    // ✅ PERMISSION CHECK: Enforce privacy rules
    if (channel.isPrivate) {
      // For private channels, only channel admins (creator + promoted admins) can invite
      if (!channel.isAdmin(userId)) {
        return res.status(403).json({
          message: "Only channel admins can invite members to private channels"
        });
      }
    } else {
      // For public channels, any member can invite
      const isUserMember = isMember(channel.members, userId);
      if (!isUserMember) {
        return forbidden(res, "Not a channel member");
      }
    }

    // Check if invitee is already a member
    const isAlreadyMember = isMember(channel.members, inviteeId);

    if (isAlreadyMember) {
      return res.status(400).json({ message: "User already a member" });
    }

    // 🔧 FIX: Convert all existing members to new format before adding new member
    channel.members = normalizeMemberFormat(channel.members, channel.createdAt);

    channel.members.push({
      user: inviteeId,
      joinedAt: new Date()
    });

    // 🎯 OWNER PROTECTION: If the invited user is the channel creator, restore them as admin
    const isChannelCreator = String(channel.createdBy) === String(inviteeId);
    if (isChannelCreator && !channel.admins.some(adminId => String(adminId) === String(inviteeId))) {
      channel.admins.push(inviteeId);

    }

    await saveWithRetry(channel);

    // 🔐 PHASE 4: Distribute conversation key to new member
    try {
      const hasKeys = await conversationKeysService.hasConversationKeys(channelId, 'channel');

      if (hasKeys) {
        const distributed = await conversationKeysService.distributeKeyToNewMember(
          channelId,
          'channel',
          inviteeId
        );

        if (distributed) {
          console.log(`✅ [PHASE 4] Distributed conversation key for #${channel.name} to user ${inviteeId}`);
        } else {
          console.warn(`⚠️ [PHASE 4] Could not distribute key for #${channel.name} to user ${inviteeId}`);
        }
      }
    } catch (keyError) {
      // Non-blocking: log error but don't fail the invite
      console.error(`❌ [PHASE 4] Key distribution failed for #${channel.name}:`, keyError.message);
    }

    // optional: emit socket event to channel room or to invitee
    const io = req.app?.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit("channel-member-added", {
        channelId,
        userId: inviteeId,
      });
      io.to(`user_${inviteeId}`).emit("invited-to-channel", { channelId, channelName: channel.name });
    }

    // ── System message: "Alice invited Bob to #design" ─────────────────
    try {
      const [inviter, invitee] = await Promise.all([
        User.findById(userId).select('username').lean(),
        User.findById(inviteeId).select('username').lean(),
      ]);

      const systemMsg = await Message.create({
        type: 'system',
        systemEvent: 'member_invited',
        sender: userId,
        channel: channelId,
        workspace: channel.workspace,
        systemData: {
          inviterId: userId,
          inviterName: inviter?.username || 'Someone',
          invitedUserId: inviteeId,
          invitedUserName: invitee?.username || 'Someone',
          channelId,
          channelName: channel.name,
        },
      });

      if (io) io.to(`channel:${channelId}`).emit('new-message', systemMsg);
    } catch (sysErr) {
      console.error('[SYSTEM MSG] member_invited failed:', sysErr);
    }
    // ────────────────────────────────────────────────────────────────────

    return res.json({ channelId, userId: inviteeId });
  } catch (err) {
    return handleError(res, err, "INVITE ERROR");
  }
};

/**
 * Remove a member from a channel
 * DELETE /channels/:id/member  { userId }
 * Only creator or admins (simple: creator) may remove
 */
exports.removeChannelMember = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { userId: victimId } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    // Only channel admins or workspace owners can remove members
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can remove members" });
    }

    // Workspace owners cannot be removed by channel admins
    if (await isWorkspaceOwner(victimId, channel.workspace) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Workspace owners cannot be removed from channels" });
    }

    // Channel admins cannot remove other channel admins (must demote first)
    if (channel.isAdmin(victimId) && String(channel.createdBy) !== String(userId)
      && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Cannot remove an admin. Demote them first." });
    }

    channel.members = channel.members.filter(
      (m) => m.user.toString() !== victimId.toString()
    );
    await saveWithRetry(channel);

    const io = req.app?.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit("channel-member-removed", { channelId, userId: victimId });
      io.to(`user_${victimId}`).emit("removed-from-channel", { channelId });
    }

    return res.json({ channelId, userId: victimId });
  } catch (err) {
    console.error("REMOVE MEMBER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Join a public channel
 * POST /channels/:id/join
 */
exports.joinChannel = async (req, res) => {
  console.log('🔄 [CHANNEL:MODULAR] Function invoked: joinChannel');
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    if (channel.isPrivate) return res.status(403).json({ message: "Cannot join private channel without an invitation" });

    // Public non-discoverable channels also require an invitation
    if (!channel.isDiscoverable && !channel.isDefault) {
      return res.status(403).json({
        message: "This channel is not open for self-service joining. Ask an admin to invite you.",
        code: "CHANNEL_NOT_DISCOVERABLE"
      });
    }

    // Check if already member
    const isAlreadyMember = isMember(channel.members, userId);

    if (!isAlreadyMember) {
      // 🔧 FIX: Convert all existing members to new format before adding new member
      channel.members = normalizeMemberFormat(channel.members, channel.createdAt);

      channel.members.push({
        user: userId,
        joinedAt: new Date()
      });
      await saveWithRetry(channel);
    }

    // 🔐 E2EE: Distribute conversation key to new member if encryption exists
    try {
      const hasKeys = await conversationKeysService.hasConversationKeys(channelId, 'channel');

      if (hasKeys) {
        const distributed = await conversationKeysService.distributeKeyToNewMember(
          channelId,
          'channel',
          userId,
          channel.workspace.toString()
        );

        if (distributed) {
          console.log(`🔐 [E2EE] Distributed conversation key to ${userId}`);
        } else {
          console.warn(`⚠️ [E2EE] Could not auto-distribute key to ${userId} - client-side handling required`);
        }
      }
    } catch (keyError) {
      // Non-blocking: log error but don't fail the join
      console.error('[E2EE] Key distribution failed (non-blocking):', keyError.message);
    }

    // optional socket: join user to room on server side handled by socket connection when client emits join-channel
    const io = req.app?.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit("channel-member-joined", { channelId, userId });
    }

    // ── System message: "John joined #general" ─────────────────────────
    try {
      const joiner = await User.findById(userId).select('username').lean();
      const systemMsg = await Message.create({
        type: 'system',
        systemEvent: 'member_joined',
        sender: userId,
        channel: channelId,
        workspace: channel.workspace,
        systemData: {
          userId,
          userName: joiner?.username || 'Someone',
          channelId,
          channelName: channel.name,
        },
      });
      const ioInst = req.app?.get('io');
      if (ioInst) ioInst.to(`channel:${channelId}`).emit('new-message', systemMsg);
    } catch (sysErr) {
      console.error('[SYSTEM MSG] member_joined (joinChannel) failed:', sysErr);
    }
    // ────────────────────────────────────────────────────────────────────

    return res.json({ channelId, joined: true });
  } catch (err) {
    return handleError(res, err, "JOIN CHANNEL ERROR");
  }
};

/**
 * Set channel topic / description (creator only for simplicity)
 * PUT /channels/:id
 * Body: { name?, description?, isPrivate? }
 */
exports.updateChannel = async (req, res) => {
  console.log('🔄 [CHANNEL:MODULAR] Function invoked: updateChannel');
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { name, description, isPrivate } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    // only creator can update (simple rule)
    if (String(channel.createdBy) !== String(userId)) {
      return res.status(403).json({ message: "Only creator can update channel" });
    }

    if (name) channel.name = name;
    if (description !== undefined) channel.description = description;
    if (isPrivate !== undefined) channel.isPrivate = !!isPrivate;

    await saveWithRetry(channel);

    const workspaceId = channel.workspace;
    const payload = { channelId: channel._id, name: channel.name, description: channel.description, isPrivate: channel.isPrivate, workspaceId };
    const io = req.app?.get("io");
    if (io) io.to(`workspace_${workspaceId}`).emit("channel-updated", payload);

    return res.json({ channel: payload });
  } catch (err) {
    return handleError(res, err, "UPDATE CHANNEL ERROR");
  }
};

/**
 * Get members of channel
 * GET /channels/:id/members?limit=50&offset=0
 */
exports.getChannelMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    const channel = await Channel.findById(id)
      .populate('members.user', 'username profilePicture email');

    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Map all members to include user data + admin flag
    const allMembers = channel.members.map(m => {
      const isAdmin = channel.admins.some(adminId => adminId.toString() === m.user._id.toString());
      return {
        _id: m.user._id,
        username: m.user.username,
        email: m.user.email,
        profilePicture: m.user.profilePicture,
        joinedAt: m.joinedAt,
        isAdmin
      };
    });

    const total = allMembers.length;
    const page = allMembers.slice(offset, offset + limit);

    return res.json({
      members: page,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (err) {
    return handleError(res, err, "GET CHANNEL MEMBERS ERROR");
  }
};
/**
 * Exit from a channel
 * POST /channels/:id/exit
 * Members can exit unless they're the only admin
 */
exports.exitChannel = async (req, res) => {
  console.log('🔄 [CHANNEL:MODULAR] Function invoked: exitChannel');
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;

    const channel = await Channel.findById(channelId).populate('members.user', 'username');
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Cannot exit default channels (general, announcements) - they are mandatory
    if (channel.isDefault) {
      return res.status(403).json({
        message: "Cannot exit default channels",
        isDefault: true
      });
    }

    // Check if user is a member
    const isUserMember = channel.members.some(m => {
      const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
      return memberId === userId.toString();
    });

    if (!isUserMember) {
      return badRequest(res, "You are not a member of this channel");
    }

    // Check if user is the ONLY admin and there are OTHER members
    // If they're the only member, let them exit (channel will auto-delete)
    if (channel.isOnlyAdmin(userId) && channel.members.length > 1) {
      return res.status(403).json({
        message: "You must assign another admin before exiting",
        requiresAdminAssignment: true
      });
    }

    // Get username for system message
    const exitingUser = await User.findById(userId).select('username');
    const username = exitingUser?.username || 'User';

    // Remove user from members
    channel.members = channel.members.filter(m => {
      const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
      return memberId !== userId.toString();
    });

    // Remove from admins if they were admin
    channel.admins = channel.admins.filter(adminId => adminId.toString() !== userId.toString());

    // Check if channel is now empty
    if (channel.members.length === 0) {
      // Delete channel and all its messages
      await Message.deleteMany({ channel: channelId });
      await channel.deleteOne();

      // Emit deletion event
      const io = req.app?.get("io");
      if (io) {
        io.to(`channel:${channelId}`).emit('channel-deleted', {
          channelId,
          channelName: channel.name,
          reason: 'empty'
        });
      }

      return res.json({
        message: "Successfully exited channel",
        channelDeleted: true
      });
    }

    await saveWithRetry(channel);

    // Create system message
    const systemMessage = await Message.create({
      channel: channelId,
      workspace: channel.workspace,
      type: 'system',
      systemEvent: 'member_left',
      sender: userId,
      systemData: {
        userId,
        userName: username,
        channelId,
        channelName: channel.name,
      },
    });

    // Emit socket events
    const io = req.app?.get("io");
    if (io) {
      // Timeline event — picked up by useChatSocket new-message handler
      io.to(`channel:${channelId}`).emit('new-message', systemMessage);
      // Presence/sidebar event — triggers member list refresh on clients
      io.to(`channel:${channelId}`).emit('member-left', {
        channelId,
        userId,
        username,
      });
    }

    return res.json({
      message: "Successfully exited channel",
      systemMessage
    });
  } catch (err) {
    return handleError(res, err, "EXIT CHANNEL ERROR");
  }
};

/**
 * Assign another member as admin
 * POST /channels/:id/assign-admin
 * Body: { userId }
 * Only current admins can assign new admins
 */
exports.assignAdmin = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: "Target user ID is required" });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Check if requester is a channel admin or workspace owner
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can assign admins" });
    }

    // Check if target user is a channel member
    const _isTargetMember = isMember(channel.members, targetUserId);

    if (!_isTargetMember) {
      return res.status(400).json({ message: "User is not a member of this channel" });
    }

    // Check if target is already an admin
    if (channel.isAdmin(targetUserId)) {
      return res.status(400).json({ message: "User is already an admin" });
    }

    // Add to admins
    channel.admins.push(targetUserId);
    await saveWithRetry(channel);

    // Get usernames for system message
    const [requesterUser, targetUser] = await Promise.all([
      User.findById(userId).select('username'),
      User.findById(targetUserId).select('username')
    ]);

    const requesterName = requesterUser?.username || 'Admin';
    const targetName = targetUser?.username || 'User';

    // Create system message
    const systemMessage = await Message.create({
      channel: channelId,
      workspace: channel.workspace,
      type: 'system',
      systemEvent: 'admin_assigned',
      systemData: {
        assignerId: userId,
        assignerName: requesterName,
        assignedUserId: targetUserId,
        assignedUserName: targetName,
        assignedAt: new Date()
      },
      text: `${requesterName} assigned ${targetName} as channel admin`,
      sender: userId
    });

    // Emit socket event
    const io = req.app?.get("io");
    if (io) {
      // Emit new-message so the system pill appears in the chat stream
      io.to(`channel:${channelId}`).emit('new-message', systemMessage);
      // Also emit admin-assigned for sidebar/permission refresh
      io.to(`channel:${channelId}`).emit('admin-assigned', {
        channelId,
        assignerId: userId,
        assignedUserId: targetUserId
      });
    }

    return res.json({
      message: "Admin assigned successfully",
      systemMessage
    });
  } catch (err) {
    return handleError(res, err, "ASSIGN ADMIN ERROR");
  }
};

/**
 * Permanently delete a channel
 * DELETE /channels/:id
 * Only admins can delete channels
 * All messages are deleted as well
 */
exports.deleteChannel = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Check if channel is a default channel
    if (channel.isDefault) {
      return res.status(403).json({ message: "Cannot delete default channels" });
    }

    // Check if user is a channel admin or workspace owner
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can delete channels" });
    }

    const channelName = channel.name;
    const workspaceId = channel.workspace;

    // Delete all messages in the channel
    const deletedMessages = await Message.deleteMany({ channel: channelId });

    // Delete the channel
    await channel.deleteOne();

    // Emit socket event to all members
    const io = req.app?.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit('channel-deleted', {
        channelId,
        channelName,
        workspaceId,
        deletedBy: userId,
        reason: 'admin_delete'
      });
    }

    return res.json({
      message: "Channel deleted successfully",
      deletedMessages: deletedMessages.deletedCount
    });
  } catch (err) {
    return handleError(res, err, "DELETE CHANNEL ERROR");
  }
};
/**
 * Get detailed channel information with members
 * GET /channels/:id/details
 */
exports.getChannelDetails = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;

    const channel = await Channel.findById(channelId)
      .populate('createdBy', 'username profilePicture email')
      .populate('members.user', 'username profilePicture email')
      .populate('admins', 'username profilePicture email')
      .lean();

    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Check if user is a member
    const isUserMember = channel.members.some(m => {
      const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
      return memberId === userId.toString();
    });

    if (!isUserMember) {
      return forbidden(res, "You are not a member of this channel");
    }

    // Format response
    const response = {
      id: channel._id,
      name: channel.name,
      description: channel.description,
      isPrivate: channel.isPrivate,
      isDefault: channel.isDefault,
      createdBy: channel.createdBy,
      createdAt: channel.createdAt,
      creatorName: channel.createdBy?.username || channel.createdBy?.firstName || 'Unknown',
      memberCount: channel.members.length,
      admins: channel.admins || [],
      members: channel.members.map(m => ({
        user: m.user,
        joinedAt: m.joinedAt
      }))
    };

    return res.json({ channel: response });
  } catch (err) {
    return handleError(res, err, "GET CHANNEL DETAILS ERROR");
  }
};

/**
 * Update channel info (name/description)
 * PUT /channels/:id/info
 * Only admins can update
 */
exports.updateChannelInfo = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { name, description } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Check if user is a channel admin or workspace owner
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can update channel info" });
    }

    // Cannot rename default channels
    if (channel.isDefault && name && name !== channel.name) {
      return res.status(403).json({ message: "Cannot rename default channels" });
    }

    const oldName = channel.name;
    const oldDesc = channel.description;

    // Update fields
    if (name && name.trim()) {
      channel.name = name.trim().toLowerCase();
    }
    if (description !== undefined) {
      channel.description = description;
    }

    await saveWithRetry(channel);

    const io = req.app?.get("io");
    const user = await User.findById(userId).select('username').lean();

    // System message: channel renamed
    if (name && name.trim().toLowerCase() !== oldName) {
      const systemMsg = await Message.create({
        channel: channelId,
        workspace: channel.workspace,
        type: 'system',
        systemEvent: 'channel_renamed',
        sender: userId,
        systemData: {
          userId,
          userName: user?.username || 'Admin',
          oldName,
          newName: channel.name,
          channelId,
        },
      });
      if (io) io.to(`channel:${channelId}`).emit('new-message', systemMsg);
    }

    // System message: description changed
    if (description !== undefined && description !== oldDesc) {
      const systemMsg = await Message.create({
        channel: channelId,
        workspace: channel.workspace,
        type: 'system',
        systemEvent: 'channel_desc_changed',
        sender: userId,
        systemData: {
          userId,
          userName: user?.username || 'Admin',
          oldDesc,
          newDesc: description,
          channelId,
        },
      });
      if (io) io.to(`channel:${channelId}`).emit('new-message', systemMsg);
    }

    // Always emit channel-updated for sidebar/header refresh
    if (io) {
      io.to(`channel:${channelId}`).emit('channel-updated', {
        channelId,
        name: channel.name,
        description: channel.description
      });
    }

    return res.json({
      message: "Channel updated successfully",
      channel: {
        id: channel._id,
        name: channel.name,
        description: channel.description
      }
    });
  } catch (err) {
    return handleError(res, err, "UPDATE CHANNEL INFO ERROR");
  }
};

/**
 * Demote admin to regular member
 * POST /channels/:id/demote-admin
 * Body: { userId }
 */
exports.demoteAdmin = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: "Target user ID is required" });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Check if requester is a channel admin or workspace owner
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can demote admins" });
    }

    // Cannot demote the creator
    if (String(channel.createdBy) === String(targetUserId)) {
      return res.status(403).json({ message: "Cannot demote the channel creator" });
    }

    // Check if target is actually an admin
    if (!channel.isAdmin(targetUserId)) {
      return res.status(400).json({ message: "User is not an admin" });
    }

    // Cannot demote yourself if you're the only admin
    if (String(userId) === String(targetUserId) && channel.admins.length === 1) {
      return res.status(403).json({ message: "Cannot demote yourself as the only admin" });
    }

    // Remove from admins
    channel.admins = channel.admins.filter(adminId => adminId.toString() !== targetUserId.toString());
    await saveWithRetry(channel);

    // Get usernames for system message
    const [requesterUser, targetUser] = await Promise.all([
      User.findById(userId).select('username'),
      User.findById(targetUserId).select('username')
    ]);

    const requesterName = requesterUser?.username || 'Admin';
    const targetName = targetUser?.username || 'User';

    // Create system message
    const systemMessage = await Message.create({
      channel: channelId,
      workspace: channel.workspace,
      type: 'system',
      systemEvent: 'admin_demoted',
      systemData: {
        demoterId: userId,
        demoterName: requesterName,
        demotedUserId: targetUserId,
        demotedUserName: targetName,
        demotedAt: new Date()
      },
      text: `${requesterName} removed ${targetName} as channel admin`,
      sender: userId
    });

    // Emit socket event
    const io = req.app?.get("io");
    if (io) {
      // Emit new-message so the system pill appears in the chat stream
      io.to(`channel:${channelId}`).emit('new-message', systemMessage);
      // Also emit admin-demoted for sidebar/permission refresh
      io.to(`channel:${channelId}`).emit('admin-demoted', {
        channelId,
        demoterId: userId,
        demotedUserId: targetUserId
      });
    }

    return res.json({
      message: "Admin demoted successfully",
      systemMessage
    });
  } catch (err) {
    console.error("DEMOTE ADMIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Remove member from channel
 * POST /channels/:id/remove-member
 * Body: { userId }
 */
exports.removeMember = async (req, res) => {
  console.log('🔄 [CHANNEL:MODULAR] Function invoked: removeMember');
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: "Target user ID is required" });
    }

    const channel = await Channel.findById(channelId).populate('members.user', 'username');
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Check if requester is an admin
    if (!channel.isAdmin(userId)) {
      return res.status(403).json({ message: "Only admins can remove members" });
    }

    // Cannot remove the creator
    if (String(channel.createdBy) === String(targetUserId)) {
      return res.status(403).json({ message: "Cannot remove the channel creator" });
    }

    // Check if target is a member
    const isMember = channel.members.some(m => {
      const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
      return memberId === targetUserId.toString();
    });

    if (!isMember) {
      return res.status(400).json({ message: "User is not a member of this channel" });
    }

    // Get target username before removing
    const targetUser = await User.findById(targetUserId).select('username');
    const targetName = targetUser?.username || 'User';

    // Remove from members
    channel.members = channel.members.filter(m => {
      const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
      return memberId !== targetUserId.toString();
    });

    // Also remove from admins if they were admin
    channel.admins = channel.admins.filter(adminId => adminId.toString() !== targetUserId.toString());

    await saveWithRetry(channel);

    // Get remover username
    const removerUser = await User.findById(userId).select('username');
    const removerName = removerUser?.username || 'Admin';

    // Create system message
    const systemMessage = await Message.create({
      channel: channelId,
      workspace: channel.workspace,
      type: 'system',
      systemEvent: 'member_removed',
      systemData: {
        removedById: userId,
        removedByUserId: userId,
        removedByName: removerName,
        removedUserId: targetUserId,
        removedUserName: targetName,
        removedAt: new Date()
      },
      text: `${removerName} removed ${targetName} from this channel`,
      sender: userId
    });

    // Emit socket events
    const io = req.app?.get("io");
    if (io) {
      // Emit new-message so the system pill appears in the chat stream
      io.to(`channel:${channelId}`).emit('new-message', systemMessage);
      // Also emit member-removed for sidebar refresh
      io.to(`channel:${channelId}`).emit('member-removed', {
        channelId,
        removerId: userId,
        removedUserId: targetUserId,
      });

      // Notify removed user specifically
      io.to(`user_${targetUserId}`).emit('removed-from-channel', {
        channelId,
        channelName: channel.name,
        removedBy: removerName
      });
    }

    return res.json({
      message: "Member removed successfully",
      systemMessage
    });
  } catch (err) {
    console.error("REMOVE MEMBER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Toggle channel privacy (Public <-> Private)
 * PATCH /api/channels/:id/privacy
 * Only admins can toggle
 */
exports.toggleChannelPrivacy = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { isPrivate } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Check if user is admin
    // Check if user is a channel admin or workspace owner
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can change channel privacy" });
    }

    // Cannot change privacy of default channels
    if (channel.isDefault) {
      return res.status(403).json({ message: "Cannot change privacy of default channels" });
    }

    const oldPrivacy = channel.isPrivate;
    channel.isPrivate = isPrivate;
    await saveWithRetry(channel);

    // Create system message
    const _user = await User.findById(userId).select('username');
    await Message.create({
      channel: channelId,
      workspace: channel.workspace,
      type: 'system',
      systemEvent: 'channel_privacy_changed',
      systemData: {
        userId,
        oldPrivacy,
        newPrivacy: isPrivate
      },
      text: `Channel made ${isPrivate ? 'Private' : 'Public'}`,
      sender: userId
    });

    // Emit socket event
    const io = req.app?.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit('channel-privacy-changed', {
        channelId,
        isPrivate: channel.isPrivate
      });
    }

    return res.json({
      message: `Channel is now ${isPrivate ? 'Private' : 'Public'}`,
      channel: {
        id: channel._id,
        name: channel.name,
        isPrivate: channel.isPrivate
      }
    });
  } catch (err) {
    console.error("TOGGLE PRIVACY ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
/**
 * Clear all messages in a channel
 * DELETE /api/channels/:id/messages
 * Only admins can clear messages
 */
exports.clearChannelMessages = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Check if user is an admin
    // Check if user is a channel admin or workspace owner
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can clear channel messages" });
    }

    // Delete all messages in the channel
    const result = await Message.deleteMany({ channel: channelId });

    // Create system message about the action
    const user = await User.findById(userId).select('username').lean();
    const systemMsg = await Message.create({
      channel: channelId,
      workspace: channel.workspace,
      type: 'system',
      systemEvent: 'messages_cleared',
      sender: userId,
      systemData: {
        userId,
        userName: user?.username || 'Admin',
        channelId,
      },
    });

    // Emit socket events
    const io = req.app?.get("io");
    if (io) {
      // Timeline event — shows "Admin cleared message history" in chat
      io.to(`channel:${channelId}`).emit('new-message', systemMsg);
      // Client cache clear — instructs clients to wipe local message list
      io.to(`channel:${channelId}`).emit('messages-cleared', {
        channelId,
        clearedBy: userId,
        clearedByName: user?.username || 'Admin',
        count: result.deletedCount
      });
    }

    return res.json({
      message: "All messages cleared successfully",
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error("CLEAR MESSAGES ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Join channel via link (with workspace validation)
 * POST /api/channels/:id/join-via-link
 */
exports.joinChannelViaLink = async (req, res) => {
  try {
    const channelId = req.params.id;
    const userId = req.user?.sub;

    // 1. Find channel and populate workspace
    const channel = await Channel.findById(channelId).populate('workspace');
    if (!channel) {

      return res.status(404).json({ message: "Channel not found" });
    }

    // 2. Block private channels from being joined via link
    if (channel.isPrivate) {
      return res.status(403).json({ message: "Cannot join private channel via link" });
    }

    // 3. Check if user is workspace member
    const workspace = channel.workspace;
    const isWorkspaceMember = workspace.members.some(m => String(m.user) === String(userId));

    if (!isWorkspaceMember) {

      return res.status(403).json({
        message: "You must be a member of this workspace to join this channel",
        workspaceName: workspace.name
      });
    }

    // 3. Check if already a member
    const isChannelMember = channel.members.some(m => {
      const memberId = m.user ? m.user.toString() : m.toString();
      return memberId === userId.toString();
    });

    if (isChannelMember) {

      return res.json({
        message: "You are already a member of this channel",
        channel: {
          id: channel._id,
          name: channel.name,
          workspaceId: workspace._id
        }
      });
    }

    // 4. Add user to channel
    channel.members.push({
      user: userId,
      joinedAt: new Date()
    });

    // 🎯 OWNER PROTECTION: If the rejoining user is the channel creator, restore them as admin
    const isChannelCreator = String(channel.createdBy) === String(userId);
    if (isChannelCreator && !channel.admins.some(adminId => String(adminId) === String(userId))) {
      channel.admins.push(userId);

    }

    await saveWithRetry(channel);

    // 🔐 PHASE 4: Distribute conversation key to new member
    try {
      const hasKeys = await conversationKeysService.hasConversationKeys(channelId, 'channel');

      if (hasKeys) {
        const distributed = await conversationKeysService.distributeKeyToNewMember(
          channelId,
          'channel',
          userId
        );

        if (distributed) {
          console.log(`✅ [PHASE 4] Distributed conversation key for #${channel.name} to user ${userId}`);
        } else {
          console.warn(`⚠️ [PHASE 4] Could not distribute key for #${channel.name} to user ${userId}`);
        }
      }
    } catch (keyError) {
      // Non-blocking: log error but don't fail the join
      console.error(`❌ [PHASE 4] Key distribution failed for #${channel.name}:`, keyError.message);
    }

    // 5. Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(`workspace_${workspace._id}`).emit("channel-member-added", {
        channelId: channel._id,
        userId
      });
    }

    // ── System message: "John joined #general" ─────────────────────────
    try {
      const joiner = await User.findById(userId).select('username').lean();
      const systemMsg = await Message.create({
        type: 'system',
        systemEvent: 'member_joined',
        sender: userId,
        channel: channel._id,
        workspace: workspace._id,
        systemData: {
          userId,
          userName: joiner?.username || 'Someone',
          channelId: channel._id,
          channelName: channel.name,
        },
      });
      if (io) io.to(`channel:${channel._id}`).emit('new-message', systemMsg);
    } catch (sysErr) {
      console.error('[SYSTEM MSG] member_joined (joinChannelViaLink) failed:', sysErr);
    }
    // ────────────────────────────────────────────────────────────────────

    return res.json({
      message: "Successfully joined channel",
      channel: {
        id: channel._id,
        name: channel.name,
        workspaceId: workspace._id
      }
    });
  } catch (err) {
    console.error("JOIN CHANNEL VIA LINK ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
/**
 * Add a new tab to a channel
 * POST /channels/:id/tabs
 * Body: { name, type, content }
 */
exports.addTab = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { name, type = "canvas", content = "" } = req.body;

    if (!name) return res.status(400).json({ message: "Tab name is required" });

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    // Check if user is a member
    const isMember = channel.members.some(m => {
      const memberId = m.user ? m.user.toString() : m.toString();
      return memberId === userId.toString();
    });

    if (!isMember) {
      return res.status(403).json({ message: "Not a member of this channel" });
    }

    // Check tab limit (max 5 tabs per channel)
    if (channel.tabs && channel.tabs.length >= 5) {
      return res.status(400).json({ message: "Maximum 5 canvases allowed per channel" });
    }

    const newTab = {
      name,
      type,
      content,
      createdBy: userId,
      createdAt: new Date()
    };

    channel.tabs.push(newTab);
    await saveWithRetry(channel);

    // The newly created tab will have an _id assigned by Mongoose
    const createdTab = channel.tabs[channel.tabs.length - 1];

    const io = req.app?.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit("tab-added", {
        channelId,
        tab: createdTab
      });
    }

    return res.status(201).json({ tab: createdTab });
  } catch (err) {
    console.error("ADD TAB ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Update a tab content or name
 * PUT /channels/:id/tabs/:tabId
 * Body: { name?, content? }
 */
exports.updateTab = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { id: channelId, tabId } = req.params;
    const { name, content, drawingData } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    const tab = channel.tabs.id(tabId);
    if (!tab) return res.status(404).json({ message: "Tab not found" });

    // Check if user is a member
    const isMember = channel.members.some(m => {
      const memberId = m.user ? m.user.toString() : m.toString();
      return memberId === userId.toString();
    });

    if (!isMember) {
      return res.status(403).json({ message: "Not a member of this channel" });
    }

    if (name) tab.name = name;
    if (content !== undefined) tab.content = content;
    if (drawingData !== undefined) tab.drawingData = drawingData;

    await saveWithRetry(channel);

    const io = req.app?.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit("tab-updated", {
        channelId,
        tabId,
        name: tab.name,
        content: tab.content,
        drawingData: tab.drawingData,
        updatedBy: userId
      });
    }

    return res.json({ tab });
  } catch (err) {
    console.error("UPDATE TAB ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Delete a tab
 * DELETE /channels/:id/tabs/:tabId
 */
exports.deleteTab = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { id: channelId, tabId } = req.params;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    // Only generic tabs can be deleted, not built-in ones (if any)
    const tab = channel.tabs.id(tabId);
    if (!tab) return res.status(404).json({ message: "Tab not found" });

    // Check if user is creator of tab or channel admin
    const isAdmin = channel.isAdmin(userId);
    const isCreator = String(tab.createdBy) === String(userId);

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: "Not authorized to delete this tab" });
    }

    channel.tabs.pull(tabId);
    await saveWithRetry(channel);

    const io = req.app?.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit("tab-deleted", {
        channelId,
        tabId
      });
    }

    return res.json({ message: "Tab deleted", tabId });
  } catch (err) {
    console.error("DELETE TAB ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get all tabs for a channel
 * GET /channels/:id/tabs
 */
exports.getTabs = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;

    const channel = await Channel.findById(channelId).select("tabs members isPrivate");
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    // Check membership
    const isMember = channel.members.some(m => {
      const memberId = m.user ? m.user.toString() : m.toString();
      return memberId === userId.toString();
    });

    if (!isMember && channel.isPrivate) {
      return res.status(403).json({ message: "Not authorized" });
    }

    return res.json({ tabs: channel.tabs || [] });
  } catch (err) {
    console.error("GET TABS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Join a public discoverable channel (self-service)
 * POST /api/channels/:id/join-discoverable
 * 
 * This endpoint allows workspace members to self-join public discoverable channels.
 * GUARDS:
 * 1. Channel must be public (!isPrivate)
 * 2. Channel must be discoverable (isDiscoverable === true)
 * 3. User must be workspace member
 * 4. User must NOT already be channel member
 */
exports.joinDiscoverableChannel = async (req, res) => {
  console.log('🔄 [CHANNEL:MODULAR] Function invoked: joinDiscoverableChannel');
  try {
    const { id: channelId } = req.params;
    const userId = req.user.sub;
    const mongoose = require('mongoose');
    const Workspace = require('../../../models/Workspace');

    // Step 1: Fetch channel
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // GUARD 1: Must be public
    if (channel.isPrivate) {
      console.log(`❌ [CHANNEL:JOIN_DISCOVERABLE] Rejected: Channel ${channelId} is private`);
      return res.status(403).json({
        message: "Cannot join private channels without invitation",
        code: "CHANNEL_PRIVATE"
      });
    }

    // GUARD 2: Must be discoverable
    if (!channel.isDiscoverable) {
      console.log(`❌ [CHANNEL:JOIN_DISCOVERABLE] Rejected: Channel ${channelId} is not discoverable`);
      return res.status(403).json({
        message: "This channel is not open for self-service joining",
        code: "CHANNEL_NOT_DISCOVERABLE"
      });
    }

    // GUARD 3: User must be workspace member
    const workspace = await Workspace.findById(channel.workspace);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    const isWorkspaceMember = workspace.members.some(m => {
      const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
      return memberId === userId.toString();
    });

    if (!isWorkspaceMember) {
      console.log(`❌ [CHANNEL:JOIN_DISCOVERABLE] Rejected: User ${userId} not a workspace member`);
      return res.status(403).json({
        message: "You must be a workspace member to join this channel",
        code: "NOT_WORKSPACE_MEMBER"
      });
    }

    // GUARD 4: User must NOT already be a channel member
    const isChannelMember = channel.members.some(m => {
      const memberId = m.user ? m.user.toString() : m.toString();
      return memberId === userId.toString();
    });

    if (isChannelMember) {
      console.log(`⚠️ [CHANNEL:JOIN_DISCOVERABLE] User ${userId} already a member of channel ${channelId}`);
      return res.status(400).json({
        message: "You are already a member of this channel",
        code: "ALREADY_MEMBER"
      });
    }

    // ALL GUARDS PASSED - Add user to channel
    console.log(`✅ [CHANNEL:JOIN_DISCOVERABLE] Adding user ${userId} to channel ${channelId}`);

    channel.members.push({
      user: new mongoose.Types.ObjectId(userId),
      joinedAt: new Date()
    });

    await saveWithRetry(channel);

    // PHASE 4: Distribute existing conversation key to new member
    // This reuses existing Phase 4 logic - NO CHANGES to key distribution
    try {
      await conversationKeysService.distributeKeyToNewMember(
        channelId,
        'channel',
        userId
      );
      console.log(`✅ [CHANNEL:JOIN_DISCOVERABLE] Distributed key to user ${userId} for channel ${channelId}`);
    } catch (keyError) {
      console.error(`❌ [CHANNEL:JOIN_DISCOVERABLE] Key distribution failed:`, keyError.message);
      // Non-blocking - user is still added to members
    }

    // Socket events are handled by existing server-side listeners
    // DO NOT add direct io.emit() calls here to avoid duplication

    // ── System message: "John joined #general" ─────────────────────────
    // (This is a system timeline event, distinct from channel-member-added socket)
    try {
      const joiner = await User.findById(userId).select('username').lean();
      const systemMsg = await Message.create({
        type: 'system',
        systemEvent: 'member_joined',
        sender: userId,
        channel: channel._id,
        workspace: channel.workspace,
        systemData: {
          userId,
          userName: joiner?.username || 'Someone',
          channelId,
          channelName: channel.name,
        },
      });
      const ioInst = req.app?.get('io');
      if (ioInst) ioInst.to(`channel:${channelId}`).emit('new-message', systemMsg);
    } catch (sysErr) {
      console.error('[SYSTEM MSG] member_joined (joinDiscoverableChannel) failed:', sysErr);
    }
    // ────────────────────────────────────────────────────────────────────

    return res.json({
      message: "Successfully joined channel",
      channelId,
      channelName: channel.name
    });

  } catch (err) {
    console.error("JOIN DISCOVERABLE CHANNEL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
