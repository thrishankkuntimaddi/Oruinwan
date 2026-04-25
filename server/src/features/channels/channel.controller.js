'use strict';

const Channel = require('./channel.model.js');
const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');
const Message = require('../messages/message.model.js');
const { saveWithRetry } = require('../../../utils/mongooseRetry');
const { handleError, _notFound, badRequest, forbidden } = require('../../../utils/responseHelpers');
const { _extractMemberId, isMember, normalizeMemberFormat } = require('../../../utils/memberHelpers');
const { _emitToWorkspace, _emitToChannel, _emitToUser, _emitToUsers } = require('../../../utils/socketHelpers');
const conversationKeysService = require('../../modules/conversations/conversationKeys.service');
const logger = require('../../shared/utils/logger');

async function isWorkspaceOwner(userId, workspaceId) {
  if (!workspaceId) return false;
  const ws = await Workspace.findById(workspaceId).select('members').lean();
  if (!ws) return false;
  return ws.members.some(
    m => m.user?.toString() === userId.toString() &&
      (m.role === 'owner' || m.role === 'admin')
  );
}

exports.createChannel = async (req, res) => {
  logger.debug('createChannel invoked');
  try {
    const userId = req.user.sub;
    const { name, description = "", isPrivate = false, isDiscoverable = true, memberIds = [], workspaceId } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ message: "Workspace ID is required" });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Channel name required" });
    }

    
    const distinctMemberIds = Array.from(new Set([userId, ...(memberIds || [])].map(String)));

    
    if (distinctMemberIds.length < 3) {
      return res.status(400).json({ message: "At least 3 members are required to create a channel." });
    }

    
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
      isDiscoverable: isPrivate ? false : isDiscoverable, 
    });

    try {
      logger.debug({ channelId: channel._id, channelName: channel.name }, '[PHASE 5] Generating conversation key');
      await conversationKeysService.generateConversationKeyServerSide(
        channel._id.toString(),
        'channel',
        workspaceId,
        distinctMemberIds,
        userId
      );
      logger.info({ channelId: channel._id, channelName: channel.name }, '[PHASE 5] Conversation key created');
    } catch (keyError) {
      logger.error({ err: keyError, channelId: channel._id }, '[PHASE 5] Failed to generate conversation key');

      
      await Channel.findByIdAndDelete(channel._id);

      
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
      
      if (isPrivate) {
        distinctMemberIds.forEach(mId => {
          io.to(`user_${mId}`).emit("channel-created", payload);
        });
      } else {
        io.to(`workspace_${workspaceId}`).emit("channel-created", payload);
      }
    }

    
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
      logger.debug({ channelName: channel.name }, '[SYSTEM] channel_created event emitted');
    } catch (sysErr) {
      logger.error({ err: sysErr }, '[SYSTEM MSG] Failed to create channel_created system message');
    }
    

    return res.status(201).json({ channel: payload });
  } catch (err) {
    return handleError(res, err, "CREATE CHANNEL ERROR");
  }
};

exports.getMyChannels = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ message: "Workspace ID is required" });
    }

    
    
    
    
    const channels = await Channel.find({
      workspace: workspaceId,
      $or: [
        { isDefault: true },                                    
        { isPrivate: false, isDiscoverable: true },            
        { 'members.user': userId }                              
      ]
    })
      .select("-__v")
      .lean();

    return res.json({ channels });
  } catch (err) {
    return handleError(res, err, "GET MY CHANNELS ERROR");
  }
};

exports.getPublicChannelList = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [channels, total] = await Promise.all([
      Channel.find({ isPublic: true, isArchived: false })
        .select("_id name description topic workspace createdBy createdAt memberCount")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Channel.countDocuments({ isPublic: true, isArchived: false })
    ]);

    
    const enriched = channels.map(ch => ({
      ...ch,
      memberCount: ch.memberCount || 0
    }));

    return res.json({ channels: enriched, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return handleError(res, err, "GET PUBLIC CHANNEL LIST ERROR");
  }
};

exports.getPublicChannelById = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id)
      .select("_id name description topic workspace createdBy createdAt isPublic isArchived")
      .populate("createdBy", "username")
      .lean();

    if (!channel) return res.status(404).json({ message: "Channel not found" });
    if (!channel.isPublic) return res.status(403).json({ message: "This channel is private" });

    return res.json({ channel });
  } catch (err) {
    return handleError(res, err, "GET PUBLIC CHANNEL ERROR");
  }
};

exports.togglePublicChannel = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { isPublic } = req.body;

    if (typeof isPublic !== "boolean") {
      return res.status(400).json({ message: "isPublic (boolean) is required" });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can change public status" });
    }

    
    if (isPublic && channel.isPrivate) {
      return res.status(400).json({ message: "Make the channel non-private before sharing publicly" });
    }

    channel.isPublic = isPublic;
    await channel.save();

    const io = req.app?.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit("channel-updated", {
        channelId,
        isPublic: channel.isPublic
      });
    }

    return res.json({ message: `Channel is now ${isPublic ? "public" : "private"}`, isPublic: channel.isPublic });
  } catch (err) {
    return handleError(res, err, "TOGGLE PUBLIC CHANNEL ERROR");
  }
};

exports.getPublicChannels = async (req, res) => {
  try {
    const channels = await Channel.find({ isPrivate: false })
      .select("_id name description members createdBy createdAt")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ channels });
  } catch (err) {
    return handleError(res, err, "GET PUBLIC CHANNELS ERROR");
  }
};

exports.inviteToChannel = async (req, res) => {
  logger.debug('inviteToChannel invoked');
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { userId: inviteeId } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    
    if (channel.isPrivate) {
      
      if (!channel.isAdmin(userId)) {
        return res.status(403).json({
          message: "Only channel admins can invite members to private channels"
        });
      }
    } else {
      
      const isUserMember = isMember(channel.members, userId);
      if (!isUserMember) {
        return forbidden(res, "Not a channel member");
      }
    }

    
    const isAlreadyMember = isMember(channel.members, inviteeId);

    if (isAlreadyMember) {
      return res.status(400).json({ message: "User already a member" });
    }

    
    channel.members = normalizeMemberFormat(channel.members, channel.createdAt);

    channel.members.push({
      user: inviteeId,
      joinedAt: new Date()
    });

    
    const isChannelCreator = String(channel.createdBy) === String(inviteeId);
    if (isChannelCreator && !channel.admins.some(adminId => String(adminId) === String(inviteeId))) {
      channel.admins.push(inviteeId);

    }

    await saveWithRetry(channel);

    
    try {
      const hasKeys = await conversationKeysService.hasConversationKeys(channelId, 'channel');

      if (hasKeys) {
        const distributed = await conversationKeysService.distributeKeyToNewMember(
          channelId,
          'channel',
          inviteeId
        );

        if (distributed) {
          logger.info({ channelName: channel.name, userId: inviteeId }, '[PHASE 4] Conversation key distributed');
        } else {
          logger.warn({ channelName: channel.name, userId: inviteeId }, '[PHASE 4] Could not distribute key — client-side handling required');
        }
      }
    } catch (keyError) {
      logger.error({ err: keyError.message, channelName: channel.name }, '[PHASE 4] Key distribution failed (non-blocking)');
    }

    
    const io = req.app?.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit("channel-member-added", {
        channelId,
        userId: inviteeId,
      });
      io.to(`user_${inviteeId}`).emit("invited-to-channel", { channelId, channelName: channel.name });
    }

    
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
      logger.error({ err: sysErr }, '[SYSTEM MSG] member_invited failed');
    }
    

    return res.json({ channelId, userId: inviteeId });
  } catch (err) {
    return handleError(res, err, "INVITE ERROR");
  }
};

exports.removeChannelMember = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { userId: victimId } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can remove members" });
    }

    
    if (await isWorkspaceOwner(victimId, channel.workspace) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Workspace owners cannot be removed from channels" });
    }

    
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
    logger.error({ err }, 'REMOVE MEMBER ERROR');
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.joinChannel = async (req, res) => {
  logger.debug('joinChannel invoked');
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    if (channel.isPrivate) return res.status(403).json({ message: "Cannot join private channel without an invitation" });

    
    if (!channel.isDiscoverable && !channel.isDefault) {
      return res.status(403).json({
        message: "This channel is not open for self-service joining. Ask an admin to invite you.",
        code: "CHANNEL_NOT_DISCOVERABLE"
      });
    }

    
    const isAlreadyMember = isMember(channel.members, userId);

    if (!isAlreadyMember) {
      
      channel.members = normalizeMemberFormat(channel.members, channel.createdAt);

      channel.members.push({
        user: userId,
        joinedAt: new Date()
      });
      await saveWithRetry(channel);
    }

    
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
          logger.info({ userId }, '[E2EE] Conversation key distributed to joining member');
        } else {
          logger.warn({ userId }, '[E2EE] Could not auto-distribute key — client-side handling required');
        }
      }
    } catch (keyError) {
      logger.error({ err: keyError.message }, '[E2EE] Key distribution failed (non-blocking)');
    }

    
    const io = req.app?.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit("channel-member-joined", { channelId, userId });
    }

    
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
      logger.error({ err: sysErr }, '[SYSTEM MSG] member_joined (joinChannel) failed');
    }
    

    return res.json({ channelId, joined: true });
  } catch (err) {
    return handleError(res, err, "JOIN CHANNEL ERROR");
  }
};

exports.updateChannel = async (req, res) => {
  logger.debug('updateChannel invoked');
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { name, description, isPrivate } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    
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

exports.exitChannel = async (req, res) => {
  logger.debug('exitChannel invoked');
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;

    const channel = await Channel.findById(channelId).populate('members.user', 'username');
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    
    if (channel.isDefault) {
      return res.status(403).json({
        message: "Cannot exit default channels",
        isDefault: true
      });
    }

    
    const isUserMember = channel.members.some(m => {
      const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
      return memberId === userId.toString();
    });

    if (!isUserMember) {
      return badRequest(res, "You are not a member of this channel");
    }

    
    
    if (channel.isOnlyAdmin(userId) && channel.members.length > 1) {
      return res.status(403).json({
        message: "You must assign another admin before exiting",
        requiresAdminAssignment: true
      });
    }

    
    const exitingUser = await User.findById(userId).select('username');
    const username = exitingUser?.username || 'User';

    
    channel.members = channel.members.filter(m => {
      const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
      return memberId !== userId.toString();
    });

    
    channel.admins = channel.admins.filter(adminId => adminId.toString() !== userId.toString());

    
    if (channel.members.length === 0) {
      
      await Message.deleteMany({ channel: channelId });
      await channel.deleteOne();

      
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

    
    const io = req.app?.get("io");
    if (io) {
      
      io.to(`channel:${channelId}`).emit('new-message', systemMessage);
      
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

    
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can assign admins" });
    }

    
    const _isTargetMember = isMember(channel.members, targetUserId);

    if (!_isTargetMember) {
      return res.status(400).json({ message: "User is not a member of this channel" });
    }

    
    if (channel.isAdmin(targetUserId)) {
      return res.status(400).json({ message: "User is already an admin" });
    }

    
    channel.admins.push(targetUserId);
    await saveWithRetry(channel);

    
    const [requesterUser, targetUser] = await Promise.all([
      User.findById(userId).select('username'),
      User.findById(targetUserId).select('username')
    ]);

    const requesterName = requesterUser?.username || 'Admin';
    const targetName = targetUser?.username || 'User';

    
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

    
    const io = req.app?.get("io");
    if (io) {
      
      io.to(`channel:${channelId}`).emit('new-message', systemMessage);
      
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

exports.deleteChannel = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    
    if (channel.isDefault) {
      return res.status(403).json({ message: "Cannot delete default channels" });
    }

    
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can delete channels" });
    }

    const channelName = channel.name;
    const workspaceId = channel.workspace;

    
    const deletedMessages = await Message.deleteMany({ channel: channelId });

    
    await channel.deleteOne();

    
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

    
    const isUserMember = channel.members.some(m => {
      const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
      return memberId === userId.toString();
    });

    if (!isUserMember) {
      return forbidden(res, "You are not a member of this channel");
    }

    
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

exports.updateChannelInfo = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { name, description } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can update channel info" });
    }

    
    if (channel.isDefault && name && name !== channel.name) {
      return res.status(403).json({ message: "Cannot rename default channels" });
    }

    const oldName = channel.name;
    const oldDesc = channel.description;

    
    if (name && name.trim()) {
      channel.name = name.trim().toLowerCase();
    }
    if (description !== undefined) {
      channel.description = description;
    }

    await saveWithRetry(channel);

    const io = req.app?.get("io");
    const user = await User.findById(userId).select('username').lean();

    
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

    
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can demote admins" });
    }

    
    if (String(channel.createdBy) === String(targetUserId)) {
      return res.status(403).json({ message: "Cannot demote the channel creator" });
    }

    
    if (!channel.isAdmin(targetUserId)) {
      return res.status(400).json({ message: "User is not an admin" });
    }

    
    if (String(userId) === String(targetUserId) && channel.admins.length === 1) {
      return res.status(403).json({ message: "Cannot demote yourself as the only admin" });
    }

    
    channel.admins = channel.admins.filter(adminId => adminId.toString() !== targetUserId.toString());
    await saveWithRetry(channel);

    
    const [requesterUser, targetUser] = await Promise.all([
      User.findById(userId).select('username'),
      User.findById(targetUserId).select('username')
    ]);

    const requesterName = requesterUser?.username || 'Admin';
    const targetName = targetUser?.username || 'User';

    
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

    
    const io = req.app?.get("io");
    if (io) {
      
      io.to(`channel:${channelId}`).emit('new-message', systemMessage);
      
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

    
    if (!channel.isAdmin(userId)) {
      return res.status(403).json({ message: "Only admins can remove members" });
    }

    
    if (String(channel.createdBy) === String(targetUserId)) {
      return res.status(403).json({ message: "Cannot remove the channel creator" });
    }

    
    const isMember = channel.members.some(m => {
      const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
      return memberId === targetUserId.toString();
    });

    if (!isMember) {
      return res.status(400).json({ message: "User is not a member of this channel" });
    }

    
    const targetUser = await User.findById(targetUserId).select('username');
    const targetName = targetUser?.username || 'User';

    
    channel.members = channel.members.filter(m => {
      const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
      return memberId !== targetUserId.toString();
    });

    
    channel.admins = channel.admins.filter(adminId => adminId.toString() !== targetUserId.toString());

    await saveWithRetry(channel);

    
    const removerUser = await User.findById(userId).select('username');
    const removerName = removerUser?.username || 'Admin';

    
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

    
    const io = req.app?.get("io");
    if (io) {
      
      io.to(`channel:${channelId}`).emit('new-message', systemMessage);
      
      io.to(`channel:${channelId}`).emit('member-removed', {
        channelId,
        removerId: userId,
        removedUserId: targetUserId,
      });

      
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

exports.toggleChannelPrivacy = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { isPrivate } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    
    
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can change channel privacy" });
    }

    
    if (channel.isDefault) {
      return res.status(403).json({ message: "Cannot change privacy of default channels" });
    }

    const oldPrivacy = channel.isPrivate;
    channel.isPrivate = isPrivate;
    await saveWithRetry(channel);

    
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

exports.clearChannelMessages = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    
    
    if (!channel.isAdmin(userId) && !await isWorkspaceOwner(userId, channel.workspace)) {
      return res.status(403).json({ message: "Only channel admins or workspace owners can clear channel messages" });
    }

    
    const result = await Message.deleteMany({ channel: channelId });

    
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

    
    const io = req.app?.get("io");
    if (io) {
      
      io.to(`channel:${channelId}`).emit('new-message', systemMsg);
      
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

exports.joinChannelViaLink = async (req, res) => {
  try {
    const channelId = req.params.id;
    const userId = req.user?.sub;

    
    const channel = await Channel.findById(channelId).populate('workspace');
    if (!channel) {

      return res.status(404).json({ message: "Channel not found" });
    }

    
    if (channel.isPrivate) {
      return res.status(403).json({ message: "Cannot join private channel via link" });
    }

    
    const workspace = channel.workspace;
    const isWorkspaceMember = workspace.members.some(m => String(m.user) === String(userId));

    if (!isWorkspaceMember) {

      return res.status(403).json({
        message: "You must be a member of this workspace to join this channel",
        workspaceName: workspace.name
      });
    }

    
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

    
    channel.members.push({
      user: userId,
      joinedAt: new Date()
    });

    
    const isChannelCreator = String(channel.createdBy) === String(userId);
    if (isChannelCreator && !channel.admins.some(adminId => String(adminId) === String(userId))) {
      channel.admins.push(userId);

    }

    await saveWithRetry(channel);

    
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
      
      console.error(`❌ [PHASE 4] Key distribution failed for #${channel.name}:`, keyError.message);
    }

    
    const io = req.app.get("io");
    if (io) {
      io.to(`workspace_${workspace._id}`).emit("channel-member-added", {
        channelId: channel._id,
        userId
      });
    }

    
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

exports.addTab = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;
    const { name, type = "canvas", content = "", coverColor = "#6366F1", emoji = "📄" } = req.body;

    if (!name) return res.status(400).json({ message: "Tab name is required" });

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    
    const isMember = channel.members.some(m => {
      const memberId = m.user ? m.user.toString() : m.toString();
      return memberId === userId.toString();
    });

    if (!isMember) {
      return res.status(403).json({ message: "Not a member of this channel" });
    }

    
    if (channel.tabs && channel.tabs.length >= 5) {
      return res.status(400).json({ message: "Maximum 5 canvases allowed per channel" });
    }

    const newTab = {
      name,
      type,
      content,
      coverColor,
      emoji,
      lastEditedBy: userId,
      lastEditedAt: new Date(),
      createdBy: userId,
      createdAt: new Date()
    };

    channel.tabs.push(newTab);
    await saveWithRetry(channel);

    
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

exports.updateTab = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { id: channelId, tabId } = req.params;
    const { name, content, drawingData, emoji, coverColor, wordCount } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    const tab = channel.tabs.id(tabId);
    if (!tab) return res.status(404).json({ message: "Tab not found" });

    
    const isMember = channel.members.some(m => {
      const memberId = m.user ? m.user.toString() : m.toString();
      return memberId === userId.toString();
    });

    if (!isMember) {
      return res.status(403).json({ message: "Not a member of this channel" });
    }

    if (name !== undefined) tab.name = name;
    if (content !== undefined) tab.content = content;
    if (drawingData !== undefined) tab.drawingData = drawingData;
    if (emoji !== undefined) tab.emoji = emoji;
    if (coverColor !== undefined) tab.coverColor = coverColor;
    if (wordCount !== undefined) tab.wordCount = wordCount;

    
    tab.lastEditedBy = userId;
    tab.lastEditedAt = new Date();

    await saveWithRetry(channel);

    
    const populatedChannel = await Channel.findById(channelId)
      .select('tabs')
      .populate('tabs.lastEditedBy', 'username profilePicture');
    const populatedTab = populatedChannel?.tabs?.id(tabId);

    const io = req.app?.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit("tab-updated", {
        channelId,
        tabId,
        name: tab.name,
        content: tab.content,
        drawingData: tab.drawingData,
        emoji: tab.emoji,
        coverColor: tab.coverColor,
        wordCount: tab.wordCount,
        lastEditedBy: populatedTab?.lastEditedBy || null,
        lastEditedAt: tab.lastEditedAt,
        updatedBy: userId
      });
    }

    return res.json({ tab: populatedTab || tab });
  } catch (err) {
    console.error("UPDATE TAB ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.deleteTab = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { id: channelId, tabId } = req.params;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    
    const tab = channel.tabs.id(tabId);
    if (!tab) return res.status(404).json({ message: "Tab not found" });

    
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

exports.getTabs = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.id;

    const channel = await Channel.findById(channelId).select("tabs members isPrivate");
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    
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

exports.joinDiscoverableChannel = async (req, res) => {
  console.log('🔄 [CHANNEL:MODULAR] Function invoked: joinDiscoverableChannel');
  try {
    const { id: channelId } = req.params;
    const userId = req.user.sub;
    const mongoose = require('mongoose');
    const Workspace = require('../../../models/Workspace');

    
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    
    if (channel.isPrivate) {
      console.log(`❌ [CHANNEL:JOIN_DISCOVERABLE] Rejected: Channel ${channelId} is private`);
      return res.status(403).json({
        message: "Cannot join private channels without invitation",
        code: "CHANNEL_PRIVATE"
      });
    }

    
    if (!channel.isDiscoverable) {
      console.log(`❌ [CHANNEL:JOIN_DISCOVERABLE] Rejected: Channel ${channelId} is not discoverable`);
      return res.status(403).json({
        message: "This channel is not open for self-service joining",
        code: "CHANNEL_NOT_DISCOVERABLE"
      });
    }

    
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

    
    console.log(`✅ [CHANNEL:JOIN_DISCOVERABLE] Adding user ${userId} to channel ${channelId}`);

    channel.members.push({
      user: new mongoose.Types.ObjectId(userId),
      joinedAt: new Date()
    });

    await saveWithRetry(channel);

    
    
    try {
      await conversationKeysService.distributeKeyToNewMember(
        channelId,
        'channel',
        userId
      );
      console.log(`✅ [CHANNEL:JOIN_DISCOVERABLE] Distributed key to user ${userId} for channel ${channelId}`);
    } catch (keyError) {
      console.error(`❌ [CHANNEL:JOIN_DISCOVERABLE] Key distribution failed:`, keyError.message);
      
    }

    
    

    
    
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
