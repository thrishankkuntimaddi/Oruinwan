// server/controllers/channelController.js
const Channel = require("../models/Channel");
const User = require("../models/User");
const Message = require("../models/Message");
const { saveWithRetry } = require("../utils/mongooseRetry");
const { handleError, notFound, badRequest, forbidden } = require("../utils/responseHelpers");
const { extractMemberId, isMember, normalizeMemberFormat } = require("../utils/memberHelpers");
const { emitToWorkspace, emitToChannel, emitToUser, emitToUsers } = require("../utils/socketHelpers");

/**
 * Create channel (public or private).
 * Body: { name, description?, isPrivate?, memberIds?: [id,...] }
 * Creator becomes createdBy and is added to members.
 */
exports.createChannel = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { name, description = "", isPrivate = false, memberIds = [], workspaceId } = req.body;

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
    });

    // ============================================================
    // 🔐 PHASE 5: ENCRYPTION-AT-BIRTH
    // Generate conversation key immediately after channel creation
    // ============================================================
    const UserIdentityKey = require('../models/UserIdentityKey');
    const conversationKeysService = require('../src/modules/conversations/conversationKeys.service');

    try {
      const creatorIdentityKey = await UserIdentityKey.findByUserId(userId);

      if (!creatorIdentityKey || !creatorIdentityKey.publicKey) {
        // Rollback channel creation
        await channel.deleteOne();
        return res.status(400).json({
          message: "You must set up E2EE encryption keys before creating channels. Please complete your security setup first."
        });
      }

      // Generate conversation key for creator
      const keyGenerated = await conversationKeysService.generateConversationKeyServerSide(
        channel._id.toString(),
        'channel',
        workspaceId,
        userId,
        creatorIdentityKey.publicKey
      );

      if (!keyGenerated) {
        await channel.deleteOne();
        return res.status(500).json({
          message: "Failed to generate encryption key for channel. Please try again."
        });
      }

      console.log(`✅ [PHASE 5] Conversation key generated for channel ${channel._id}`);

      // ============================================================
      // 🔐 PHASE 6: KEY DISTRIBUTION FOR INVITED MEMBERS
      // Distribute keys to invited members (excluding creator)
      // ============================================================
      if (memberIds && memberIds.length > 0) {
        const invitedMemberIds = memberIds.filter(id => String(id) !== String(userId));

        for (const memberId of invitedMemberIds) {
          const distributed = await conversationKeysService.distributeKeyToNewMember(
            channel._id.toString(),
            'channel',
            memberId
          );

          if (!distributed) {
            console.warn(`⚠️ [PHASE 6] Failed to distribute key to member ${memberId} (they may not have E2EE keys set up)`);
            // Don't fail - user can still join, key will be distributed when they set up E2EE
          }
        }
        console.log(`✅ [PHASE 6] Keys distributed to ${invitedMemberIds.length} invited members`);
      }

    } catch (keyError) {
      console.error('[PHASE 5/6] Key generation/distribution error:', keyError);
      // Rollback channel creation
      await channel.deleteOne();
      return res.status(500).json({
        message: "Failed to set up encryption for channel. Please try again."
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

    return res.status(201).json({ channel: payload });
  } catch (err) {
    return handleError(res, err, "CREATE CHANNEL ERROR");
  }
};

/**
 * Get channels for a specific workspace that the user is a member of
 * Query param: workspaceId (required)
 */
exports.getMyChannels = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ message: "Workspace ID is required" });
    }

    // Find channels:
    // 1. Belong to workspace
    // 2. AND (is NOT private OR user is a member)
    const channels = await Channel.find({
      workspace: workspaceId,
      $or: [
        { isPrivate: false },
        { 'members.user': userId } // Query using the populated user field
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
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { userId: inviteeId } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    // ✅ PERMISSION CHECK: Enforce privacy rules
    if (channel.isPrivate) {
      // For private channels, only creator can invite
      const isCreator = String(channel.createdBy) === String(userId);
      if (!isCreator) {
        return res.status(403).json({
          message: "Only the channel creator can invite members to private channels"
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

    // ============================================================
    // 🔐 PHASE 6: DISTRIBUTE CONVERSATION KEY TO INVITED MEMBER
    // ============================================================
    const conversationKeysService = require('../src/modules/conversations/conversationKeys.service');

    try {
      const distributed = await conversationKeysService.distributeKeyToNewMember(
        channelId,
        'channel',
        inviteeId
      );

      if (!distributed) {
        console.warn(`⚠️ [PHASE 6] Failed to distribute key to invited user ${inviteeId} in channel ${channelId}`);
        // Don't fail the invite - user successfully joined, key distribution can be retried
      } else {
        console.log(`✅ [PHASE 6] Distributed conversation key to invited user ${inviteeId} in channel ${channelId}`);
      }
    } catch (keyError) {
      console.error('[PHASE 6] Key distribution error on invite:', keyError);
      // Don't fail the invite - user successfully joined the channel
    }

    // Get invitee username for system message
    const inviteeUser = await User.findById(inviteeId).select('username');
    const inviteeName = inviteeUser?.username || 'User';
    const joinDate = new Date();

    // Create system message for join
    const systemMessage = await Message.create({
      channel: channelId,
      workspace: channel.workspace,
      type: 'system',
      systemEvent: 'member_joined',
      systemData: {
        userId: inviteeId,
        username: inviteeName,
        joinedAt: joinDate
      },
      payload: {
        text: `${inviteeName} joined on ${joinDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
      },
      sender: inviteeId // System messages still need a sender for queries
    });

    // optional: emit socket event to channel room or to invitee
    const io = req.app?.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit("member-joined", {
        channelId,
        userId: inviteeId,
        username: inviteeName,
        joinedAt: joinDate,
        systemMessage: {
          _id: systemMessage._id,
          payload: systemMessage.payload,
          type: systemMessage.type,
          createdAt: systemMessage.createdAt
        }
      });
      io.to(`user_${inviteeId}`).emit("invited-to-channel", { channelId, channelName: channel.name });
    }

    return res.json({ channelId, userId: inviteeId, systemMessage });
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

    // only creator can remove
    if (String(channel.createdBy) !== String(userId)) {
      return res.status(403).json({ message: "Only channel creator can remove members" });
    }

    channel.members = channel.members.filter((m) => String(m) !== String(victimId));
    await saveWithRetry(channel);

    const io = req.app?.get("io");
    if (io) {
      io.to(`channel_${channelId}`).emit("channel-member-removed", { channelId, userId: victimId });
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
  try {
    const { id: channelId } = req.params;
    const userId = req.user.sub;

    const channel = await Channel.findById(channelId);
    if (!channel) return notFound(res, "Channel not found");

    const isChannelMember = isMember(channel.members, userId);
    if (isChannelMember) {
      return res.status(400).json({ message: "Already a member of this channel" });
    }

    // Normalize members + add new user
    channel.members = normalizeMemberFormat(channel.members, channel.createdAt);
    channel.members.push({ user: userId, joinedAt: new Date() });
    await channel.save();

    // ============================================================
    // 🔐 PHASE 6: DISTRIBUTE CONVERSATION KEY TO NEW MEMBER
    // ============================================================
    const conversationKeysService = require('../src/modules/conversations/conversationKeys.service');

    try {
      const distributed = await conversationKeysService.distributeKeyToNewMember(
        channelId,
        'channel',
        userId
      );

      if (!distributed) {
        console.warn(`⚠️ [PHASE 6] Failed to distribute key to user ${userId} joining channel ${channelId}`);
        // Don't fail the join - user successfully joined, key distribution can be retried
      } else {
        console.log(`✅ [PHASE 6] Distributed conversation key to user ${userId} joining channel ${channelId}`);
      }
    } catch (keyError) {
      console.error('[PHASE 6] Key distribution error on join:', keyError);
      // Don't fail the join - user successfully joined the channel
    }

    const io = req.app?.get("io");
    if (io) {
      const populatedUser = await User.findById(userId).select("username profilePicture");
      const memberPayload = {
        user: userId,
        username: populatedUser?.username || "Unknown",
        profilePicture: populatedUser?.profilePicture || null,
        joinedAt: new Date()
      };

      io.to(`channel_${channelId}`).emit("channel:member-joined", {
        channelId,
        member: memberPayload
      });

      // Get username for system message
      const username = populatedUser?.username || 'User';
      const joinDate = new Date();

      // Create system message for join
      const systemMessage = await Message.create({
        channel: channelId,
        workspace: channel.workspace,
        type: 'system',
        systemEvent: 'member_joined',
        systemData: {
          userId,
          username,
          joinedAt: joinDate
        },
        payload: {
          text: `${username} joined on ${joinDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
        },
        sender: userId
      });

      // optional socket: join user to room on server side handled by socket connection when client emits join-channel
      io.to(`channel:${channelId}`).emit("member-joined", {
        channelId,
        userId,
        username,
        joinedAt: joinDate,
        systemMessage: {
          _id: systemMessage._id,
          payload: systemMessage.payload,
          type: systemMessage.type,
          createdAt: systemMessage.createdAt
        }
      });
    }

    return res.status(200).json({
      message: "Successfully joined channel",
      channel: {
        _id: channel._id,
        name: channel.name,
        workspace: channel.workspace
      }
    });
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

    const payload = { channelId: channel._id, name: channel.name, description: channel.description, isPrivate: channel.isPrivate };
    const io = req.app?.get("io");
    if (io) io.emit("channel-updated", payload);

    return res.json({ channel: payload });
  } catch (err) {
    return handleError(res, err, "UPDATE CHANNEL ERROR");
  }
};

/**
 * Get members of channel
 * GET /channels/:id/members
 */
exports.getChannelMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const channel = await Channel.findById(id)
      .populate('members.user', 'username profilePicture email');

    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Map members to include user data
    const formattedMembers = channel.members.map(m => {
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

    return res.json({ members: formattedMembers });
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
        io.to(`channel_${channelId}`).emit('channel-deleted', {
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
      systemData: {
        userId,
        username,
        exitedAt: new Date()
      },
      text: `${username} exited from this channel on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      sender: userId // System messages still need a sender for queries
    });

    // Emit socket event
    const io = req.app?.get("io");
    if (io) {
      io.to(`channel_${channelId}`).emit('member-left', {
        channelId,
        userId,
        username,
        systemMessage: {
          _id: systemMessage._id,
          text: systemMessage.text,
          type: systemMessage.type,
          createdAt: systemMessage.createdAt
        }
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

    // Check if requester is an admin
    if (!channel.isAdmin(userId)) {
      return res.status(403).json({ message: "Only admins can assign other admins" });
    }

    // Check if target user is a channel member
    const isTargetMember = isMember(channel.members, targetUserId);

    if (!isMember) {
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
        assignedUserId: targetUserId,
        assignedAt: new Date()
      },
      text: `${requesterName} assigned ${targetName} as channel admin`,
      sender: userId
    });

    // Emit socket event
    const io = req.app?.get("io");
    if (io) {
      io.to(`channel_${channelId}`).emit('admin-assigned', {
        channelId,
        assignerId: userId,
        assignedUserId: targetUserId,
        systemMessage: {
          _id: systemMessage._id,
          text: systemMessage.text,
          type: systemMessage.type,
          createdAt: systemMessage.createdAt
        }
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

    // Check if user is an admin
    if (!channel.isAdmin(userId)) {
      return res.status(403).json({ message: "Only admins can delete channels" });
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
      io.to(`channel_${channelId}`).emit('channel-deleted', {
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

    // Check if user is admin
    if (!channel.isAdmin(userId)) {
      return res.status(403).json({ message: "Only admins can update channel info" });
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

    // Create system message if changed
    if (name && name !== oldName) {
      const user = await User.findById(userId).select('username');
      await Message.create({
        channel: channelId,
        workspace: channel.workspace,
        type: 'system',
        systemEvent: 'channel_renamed',
        systemData: {
          userId,
          oldName,
          newName: channel.name
        },
        text: `${user?.username || 'Admin'} renamed this channel from #${oldName} to #${channel.name}`,
        sender: userId
      });
    }

    // Emit socket event
    const io = req.app?.get("io");
    if (io) {
      io.to(`channel_${channelId}`).emit('channel-updated', {
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

    // Check if requester is an admin
    if (!channel.isAdmin(userId)) {
      return res.status(403).json({ message: "Only admins can demote other admins" });
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
        demotedUserId: targetUserId,
        demotedAt: new Date()
      },
      text: `${requesterName} removed ${targetName} as channel admin`,
      sender: userId
    });

    // Emit socket event
    const io = req.app?.get("io");
    if (io) {
      io.to(`channel_${channelId}`).emit('admin-demoted', {
        channelId,
        demoterId: userId,
        demotedUserId: targetUserId,
        systemMessage: {
          _id: systemMessage._id,
          text: systemMessage.text,
          type: systemMessage.type,
          createdAt: systemMessage.createdAt
        }
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
        removerId: userId,
        removedUserId: targetUserId,
        removedAt: new Date()
      },
      text: `${removerName} removed ${targetName} from this channel on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      sender: userId
    });

    // Emit socket events
    const io = req.app?.get("io");
    if (io) {
      // Notify channel members
      io.to(`channel_${channelId}`).emit('member-removed', {
        channelId,
        removerId: userId,
        removedUserId: targetUserId,
        systemMessage: {
          _id: systemMessage._id,
          text: systemMessage.text,
          type: systemMessage.type,
          createdAt: systemMessage.createdAt
        }
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
    if (!channel.isAdmin(userId)) {
      return res.status(403).json({ message: "Only admins can change channel privacy" });
    }

    // Cannot change privacy of default channels
    if (channel.isDefault) {
      return res.status(403).json({ message: "Cannot change privacy of default channels" });
    }

    const oldPrivacy = channel.isPrivate;
    channel.isPrivate = isPrivate;
    await saveWithRetry(channel);

    // Create system message
    const user = await User.findById(userId).select('username');
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
      io.to(`channel_${channelId}`).emit('channel-privacy-changed', {
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
    if (!channel.isAdmin(userId)) {
      return res.status(403).json({ message: "Only admins can clear messages" });
    }

    // Delete all messages in the channel
    const result = await Message.deleteMany({ channel: channelId });

    // Create system message about the action
    const user = await User.findById(userId).select('username');
    await Message.create({
      channel: channelId,
      workspace: channel.workspace,
      type: 'system',
      systemEvent: 'messages_cleared',
      systemData: {
        userId,
        clearedCount: result.deletedCount,
        clearedAt: new Date()
      },
      text: `${user?.username || 'Admin'} cleared all message history`,
      sender: userId
    });

    // Emit socket event
    const io = req.app?.get("io");
    if (io) {
      io.to(`channel_${channelId}`).emit('messages-cleared', {
        channelId,
        clearedBy: userId,
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

    // 2. Check if user is workspace member
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

    // ============================================================
    // 🔐 PHASE 6: DISTRIBUTE CONVERSATION KEY TO NEW MEMBER
    // ============================================================
    const conversationKeysService = require('../src/modules/conversations/conversationKeys.service');

    try {
      const distributed = await conversationKeysService.distributeKeyToNewMember(
        channelId,
        'channel',
        userId
      );

      if (!distributed) {
        console.warn(`⚠️ [PHASE 6] Failed to distribute key to user ${userId} joining via link in channel ${channelId}`);
        // Don't fail the join - user successfully joined, key distribution can be retried
      } else {
        console.log(`✅ [PHASE 6] Distributed conversation key to user ${userId} joining via link in channel ${channelId}`);
      }
    } catch (keyError) {
      console.error('[PHASE 6] Key distribution error on join via link:', keyError);
      // Don't fail the join - user successfully joined the channel
    }

    // 5. Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(`workspace_${workspace._id}`).emit("channel-member-added", {
        channelId: channel._id,
        userId
      });
    }

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
      io.to(`channel_${channelId}`).emit("tab-added", {
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
    const { name, content } = req.body;

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

    await saveWithRetry(channel);

    const io = req.app?.get("io");
    if (io) {
      io.to(`channel_${channelId}`).emit("tab-updated", {
        channelId,
        tabId,
        name: tab.name,
        content: tab.content,
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
      io.to(`channel_${channelId}`).emit("tab-deleted", {
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
