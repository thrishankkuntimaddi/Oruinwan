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
        { members: { $elemMatch: { user: userId } } }, // New format
        { members: userId } // Legacy support
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

    channel.members.push({
      user: inviteeId,
      joinedAt: new Date()
    });
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
    const channelId = req.params.id;
    const channel = await Channel.findById(channelId).populate("members", "_id username profilePicture");
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    return res.json({ members: channel.members });
  } catch (err) {
    console.error("GET CHANNEL MEMBERS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
