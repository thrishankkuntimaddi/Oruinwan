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
    const { name, description = "", isPrivate = false, memberIds = [] } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Channel name required" });
    }

    // normalize members: include creator
    const members = Array.from(new Set([userId, ...(memberIds || [])].map(String)));

    const channel = await Channel.create({
      name: name.trim(),
      description,
      members,
      createdBy: userId,
      isPrivate,
    });

    // Return channel populated minimally
    const payload = {
      _id: channel._id,
      name: channel.name,
      description: channel.description,
      members: channel.members,
      isPrivate: channel.isPrivate,
      createdBy: channel.createdBy,
      createdAt: channel.createdAt,
    };

    // If app has io, broadcast new-channel so clients can update
    const io = req.app?.get("io");
    if (io) {
      io.emit("channel-created", payload);
    }

    return res.status(201).json({ channel: payload });
  } catch (err) {
    console.error("CREATE CHANNEL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get channels the user is a member of
 */
exports.getMyChannels = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channels = await Channel.find({ members: userId }).select("-__v").lean();
    return res.json({ channels });
  } catch (err) {
    console.error("GET MY CHANNELS ERROR:", err);
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

    // permission: only members can invite
    if (!channel.members.map(String).includes(String(userId))) {
      return res.status(403).json({ message: "Not a channel member" });
    }

    if (channel.members.map(String).includes(String(inviteeId))) {
      return res.status(400).json({ message: "User already a member" });
    }

    channel.members.push(inviteeId);
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

    if (!channel.members.map(String).includes(String(userId))) {
      channel.members.push(userId);
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
