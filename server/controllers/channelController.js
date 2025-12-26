// server/controllers/channelController.js
const Channel = require("../models/Channel");
const User = require("../models/User");
const Message = require("../models/Message");

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
    console.error("CREATE CHANNEL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
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
    console.error("GET MY CHANNELS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
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
    console.error("GET PUBLIC CHANNELS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
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

    // permission: only members can invite (handle both formats)
    const isMember = channel.members.some(m => {
      const memberId = m.user ? m.user.toString() : m.toString();
      return memberId === userId.toString();
    });

    if (!isMember) {
      return res.status(403).json({ message: "Not a channel member" });
    }

    const isAlreadyMember = channel.members.some(m => {
      const memberId = m.user ? m.user.toString() : m.toString();
      return memberId === inviteeId.toString();
    });

    if (isAlreadyMember) {
      return res.status(400).json({ message: "User already a member" });
    }

    // 🔧 FIX: Convert all existing members to new format before adding new member
    channel.members = channel.members.map(m => {
      if (m.user) return m;
      return {
        user: m,
        joinedAt: channel.createdAt || new Date()
      };
    });

    channel.members.push({
      user: inviteeId,
      joinedAt: new Date()
    });

    // 🎯 OWNER PROTECTION: If the invited user is the channel creator, restore them as admin
    const isChannelCreator = String(channel.createdBy) === String(inviteeId);
    if (isChannelCreator && !channel.admins.some(adminId => String(adminId) === String(inviteeId))) {
      channel.admins.push(inviteeId);
      console.log(`✨ Channel creator ${inviteeId} restored as admin`);
    }

    await channel.save();

    // optional: emit socket event to channel room or to invitee
    const io = req.app?.get("io");
    if (io) {
      io.to(`channel_${channelId}`).emit("channel-member-added", {
        channelId,
        userId: inviteeId,
      });
      io.to(`user_${inviteeId}`).emit("invited-to-channel", { channelId, channelName: channel.name });
    }

    return res.json({ channelId, userId: inviteeId });
  } catch (err) {
    console.error("INVITE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
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
    await channel.save();

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
    const userId = req.user.sub;
    const channelId = req.params.id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    if (channel.isPrivate) return res.status(403).json({ message: "Cannot join private channel" });

    // Check if already member (handle both formats)
    const isAlreadyMember = channel.members.some(m => {
      const memberId = m.user ? m.user.toString() : m.toString();
      return memberId === userId.toString();
    });

    if (!isAlreadyMember) {
      // 🔧 FIX: Convert all existing members to new format before adding new member
      channel.members = channel.members.map(m => {
        if (m.user) return m;
        return {
          user: m,
          joinedAt: channel.createdAt || new Date()
        };
      });

      channel.members.push({
        user: userId,
        joinedAt: new Date()
      });
      await channel.save();
    }

    // optional socket: join user to room on server side handled by socket connection when client emits join-channel
    const io = req.app?.get("io");
    if (io) {
      io.to(`channel_${channelId}`).emit("channel-member-joined", { channelId, userId });
    }

    return res.json({ channelId, joined: true });
  } catch (err) {
    console.error("JOIN CHANNEL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
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

    await channel.save();

    const payload = { channelId: channel._id, name: channel.name, description: channel.description, isPrivate: channel.isPrivate };
    const io = req.app?.get("io");
    if (io) io.emit("channel-updated", payload);

    return res.json({ channel: payload });
  } catch (err) {
    console.error("UPDATE CHANNEL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
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

    console.log(`📋 Channel #${channel.name} members:`, formattedMembers.map(m => `${m.username} (admin: ${m.isAdmin})`));

    return res.json({ members: formattedMembers });
  } catch (err) {
    console.error("GET CHANNEL MEMBERS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
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
    const isMember = channel.members.some(m => {
      const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
      return memberId === userId.toString();
    });

    if (!isMember) {
      return res.status(400).json({ message: "You are not a member of this channel" });
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

      console.log(`🗑️ Channel #${channel.name} deleted - last member exited`);

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

    await channel.save();

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

    console.log(`👋 User ${username} exited channel #${channel.name}`);

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
    console.error("EXIT CHANNEL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
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
    const isMember = channel.members.some(m => {
      const memberId = m.user ? m.user.toString() : m.toString();
      return memberId === targetUserId.toString();
    });

    if (!isMember) {
      return res.status(400).json({ message: "User is not a member of this channel" });
    }

    // Check if target is already an admin
    if (channel.isAdmin(targetUserId)) {
      return res.status(400).json({ message: "User is already an admin" });
    }

    // Add to admins
    channel.admins.push(targetUserId);
    await channel.save();

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

    console.log(`👑 User ${targetName} assigned as admin in #${channel.name} by ${requesterName}`);

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
    console.error("ASSIGN ADMIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
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
    console.log(`🗑️ Deleted ${deletedMessages.deletedCount} messages from #${channelName}`);

    // Delete the channel
    await channel.deleteOne();

    console.log(`🗑️ Channel #${channelName} permanently deleted by admin`);

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
    console.error("DELETE CHANNEL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
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
    const isMember = channel.members.some(m => {
      const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
      return memberId === userId.toString();
    });

    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this channel" });
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
    console.error("GET CHANNEL DETAILS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
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

    await channel.save();

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

    console.log(`📝 Channel #${channel.name} info updated`);

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
    console.error("UPDATE CHANNEL INFO ERROR:", err);
    return res.status(500).json({ message: "Server error" });
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
    await channel.save();

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

    console.log(`👤 User ${targetName} demoted from admin in #${channel.name}`);

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

    await channel.save();

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

    console.log(`🚫 User ${targetName} removed from #${channel.name} by ${removerName}`);

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
    await channel.save();

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
      text: `${user?.username || 'Admin'} changed this channel to ${isPrivate ? 'Private' : 'Public'}`,
      sender: userId
    });

    console.log(`🔒 Channel #${channel.name} privacy changed: ${isPrivate ? 'Private' : 'Public'}`);

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

    console.log(`🗑️ Cleared ${result.deletedCount} messages from #${channel.name}`);

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

    console.log(`🔗 User ${userId} attempting to join channel ${channelId} via link`);

    // 1. Find channel and populate workspace
    const channel = await Channel.findById(channelId).populate('workspace');
    if (!channel) {
      console.log('❌ Channel not found');
      return res.status(404).json({ message: "Channel not found" });
    }

    // 2. Check if user is workspace member
    const workspace = channel.workspace;
    const isWorkspaceMember = workspace.members.some(m => String(m.user) === String(userId));

    if (!isWorkspaceMember) {
      console.log(`❌ User not a workspace member of ${workspace.name}`);
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
      console.log('✅ User already a member');
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
      console.log(`✨ Channel creator restored as admin`);
    }

    await channel.save();

    console.log(`✅ User added to channel #${channel.name}`);

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
