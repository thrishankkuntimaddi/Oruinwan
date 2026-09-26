const Message = require("../modules/messages/message.model");
const Channel = require("../features/channels/channel.model");
const DMSession = require("../../models/DMSession");
const Workspace = require("../../models/Workspace");
const User = require("../../models/User");
const logger = require("../../utils/logger");
const messagesService = require("../modules/messages/messages.service");
const ROOMS = require("../shared/utils/rooms");
const { extractMemberId } = require("../../utils/memberHelpers");


const activityService = require("../features/activity/activity.service");
const { ACTIVITY_TYPES, ACTIVITY_SUBTYPES } = require("../../../platform/sdk/events/activityEvents");

// ---------------------------------------------------------------------------
// Authorization helpers (server-side derivation; never trust client ids)
// ---------------------------------------------------------------------------
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

function isChannelMember(channel, uid) {
  if (!channel || !Array.isArray(channel.members)) return false;
  return channel.members.some(m => sameId(extractMemberId(m), uid));
}

function isDMParticipant(dm, uid) {
  if (!dm || !Array.isArray(dm.participants)) return false;
  return dm.participants.some(p => sameId(p?._id ?? p, uid));
}

function isWorkspaceMember(workspace, uid) {
  if (!workspace || !Array.isArray(workspace.members)) return false;
  return workspace.members.some(m => sameId(extractMemberId(m), uid));
}

/**
 * Load a message and verify the user can access its conversation.
 * Returns { message, room, channel, dm } or null when not found / not allowed.
 */
async function loadAuthorizedMessage(messageId, uid, select = "channel dm workspace") {
  if (!messageId) return null;
  const message = await Message.findById(messageId).select(select);
  if (!message) return null;
  if (message.channel) {
    const channel = await Channel.findById(message.channel).select("members workspace").lean();
    if (!isChannelMember(channel, uid)) return null;
    return { message, channel, dm: null, room: `channel:${message.channel}` };
  }
  if (message.dm) {
    const dm = await DMSession.findById(message.dm).select("participants workspace").lean();
    if (!isDMParticipant(dm, uid)) return null;
    return { message, channel: null, dm, room: `dm:${message.dm}` };
  }
  return null;
}

module.exports = function registerChatHandlers(io, socket) {
  const userId = socket.user.id; 

  
  // Socket handlers owned by src/modules (huddles today).
  require("../modules").registerModuleSockets(io, socket);

  
  socket.join(`user_${userId}`);

  // Room restoration runs in the background. Nothing here may be awaited before
  // the socket.on(...) registrations below: events a client emits right after
  // connecting (chat:join, typing, votes) would otherwise arrive with no
  // listener and be silently dropped.
  (async () => {
    const joinedRooms = [];

    try {
      const user = await User.findById(userId).select('companyId').lean();
      if (user && user.companyId) {
        const companyId = user.companyId.toString();
        socket.join(`company_${companyId}`);
        socket.join(ROOMS.companyUpdates(companyId));
      }
    } catch (err) {
      logger.error("Error auto-joining company room:", err);
    }

    try {
      
      const [dmSessions, channels] = await Promise.all([
        DMSession.find({ participants: userId })
          .select('_id')
          .lean(),
        Channel.find({ 'members.user': userId })
          .select('_id')
          .lean()
      ]);

      
      for (const dm of dmSessions) {
        const room = `dm:${dm._id}`;
        socket.join(room);
        joinedRooms.push(room);
      }

      
      for (const ch of channels) {
        const room = `channel:${ch._id}`;
        socket.join(room);
        joinedRooms.push(room);
      }

      logger.info(`✅ [RECONNECT] User ${userId} restored ${joinedRooms.length} rooms`);

    } catch (err) {
      
      logger.error(`❌ [RECONNECT] Room restoration failed for user ${userId}:`, err.message);
    }

    
    
    socket.emit('reconnected', {
      userId,
      restoredRooms: joinedRooms.length,
      timestamp: new Date().toISOString()
    });
  })();

  
  socket.on("join-dm", async ({ dmSessionId }) => {
    try {
      logger.socket('[JOIN][RECEIVE]', {
        event: 'join-dm',
        receivedIdOrPayload: { dmSessionId },
        userId: socket.user?.id
      });

      if (!dmSessionId) {
        logger.error("join-dm: missing dmSessionId");
        socket.emit("join-error", { event: "join-dm", code: "MISSING_ID", message: "dmSessionId is required" });
        return;
      }

      
      const dmSession = await DMSession.findById(dmSessionId).select("participants").lean();
      if (!dmSession) {
        socket.emit("join-error", { event: "join-dm", code: "NOT_FOUND", message: "DM session not found" });
        return;
      }

      const isParticipant = dmSession.participants.some(p => p.toString() === userId.toString());
      if (!isParticipant) {
        logger.error(`[SECURITY] Unauthorized join-dm attempt by user ${userId} on session ${dmSessionId}`);
        socket.emit("join-error", { event: "join-dm", code: "UNAUTHORIZED", message: "You are not a participant of this DM" });
        return;
      }

      const room = `dm:${dmSessionId}`;
      socket.join(room);
      logger.info(`✅ [join-dm] User ${socket.user?.id} joined ${room}`);
    } catch (err) {
      logger.error("Error joining DM room:", err);
      socket.emit("join-error", { event: "join-dm", code: "SERVER_ERROR", message: "Failed to join DM room" });
    }
  });

  
  socket.on("join-channel", async ({ channelId } = {}) => {
    try {
      if (!channelId) {
        logger.error("join-channel: missing channelId");
        return;
      }
      const channel = await Channel.findById(channelId).select("members").lean();
      if (!isChannelMember(channel, userId)) {
        logger.warn(`[SECURITY] Unauthorized join-channel attempt by user ${userId} on channel ${channelId}`);
        socket.emit("join-error", { event: "join-channel", code: "UNAUTHORIZED", message: "Not a member of this channel" });
        return;
      }
      socket.join(`channel:${channelId}`);
    } catch (err) {
      logger.error("Error joining channel room:", err);
      socket.emit("join-error", { event: "join-channel", code: "SERVER_ERROR", message: "Failed to join channel room" });
    }
  });

  
  socket.on("chat:join", async (channelId, callback) => {
    try {
      logger.socket('[DEBUG][JOIN][RECEIVE]', {
        event: 'chat:join',
        receivedIdOrPayload: channelId,
        userId: socket.user?.id
      });

      if (!channelId) {
        logger.error("chat:join: missing channelId");
        if (callback) callback({ error: 'Channel ID is required', code: 'MISSING_CHANNEL_ID' });
        return;
      }

      const channel = await Channel.findById(channelId);

      if (!channel) {
        if (callback) callback({
          error: 'Channel not found',
          code: 'CHANNEL_NOT_FOUND',
          channelId
        });
        return;
      }

      const isMember = channel.members.some(m => {
        const memberId =
          m?.user?._id?.toString() ??
          m?.user?.toString() ??
          m?.toString();
        return memberId === userId.toString();
      });

      if (!isMember) {
        if (callback) callback({
          error: 'Not a member of this channel',
          code: 'UNAUTHORIZED',
          channelId
        });
        return;
      }

      const room = `channel:${channelId}`;
      socket.join(room);
      logger.info(`✅ [chat:join] User ${userId} joined ${room}`);

      if (callback) callback({ success: true });

    } catch (err) {
      logger.error("Error joining channel room (chat:join):", err);
      if (callback) callback({
        error: 'Internal server error',
        code: 'SERVER_ERROR'
      });
    }
  });

  
  socket.on("join-workspace", async ({ workspaceId }) => {
    try {
      if (!workspaceId) {
        logger.error("join-workspace: missing workspaceId");
        socket.emit("join-error", { event: "join-workspace", code: "MISSING_ID", message: "workspaceId is required" });
        return;
      }

      
      const workspace = await Workspace.findById(workspaceId).select("members").lean();
      if (!workspace) {
        socket.emit("join-error", { event: "join-workspace", code: "NOT_FOUND", message: "Workspace not found" });
        return;
      }

      const isMember = workspace.members.some(m => {
        const memberId = m?.user?.toString() ?? m?.toString();
        return memberId === userId.toString();
      });

      if (!isMember) {
        logger.error(`[SECURITY] Unauthorized join-workspace attempt by user ${userId} on workspace ${workspaceId}`);
        socket.emit("join-error", { event: "join-workspace", code: "UNAUTHORIZED", message: "You are not a member of this workspace" });
        return;
      }

      const room = `workspace:${workspaceId}`;
      socket.join(room);
      logger.info(`✅ [join-workspace] User ${userId} joined ${room}`);
    } catch (err) {
      logger.error("Error joining workspace room:", err);
      socket.emit("join-error", { event: "join-workspace", code: "SERVER_ERROR", message: "Failed to join workspace room" });
    }
  });

  
  socket.on("join-company-updates", async (companyId) => {
    try {
      if (!companyId) return;

      
      const user = await User.findById(userId).select('companyId').lean();
      if (!user || user.companyId?.toString() !== companyId.toString()) {
        logger.error(`[SECURITY] Unauthorized join-company-updates by user ${userId}`);
        return;
      }

      const room = ROOMS.companyUpdates(companyId);
      socket.join(room);
      logger.info(`✅ [join-company-updates] User ${userId} joined ${room}`);
    } catch (err) {
      logger.error("Error joining company-updates room:", err);
    }
  });

  socket.on("leave-company-updates", (companyId) => {
    if (!companyId) return;
    const room = ROOMS.companyUpdates(companyId);
    socket.leave(room);
    logger.debug(`[leave-company-updates] User ${userId} left ${room}`);
  });

  
  socket.on("send-message", async (data = {}) => {
    const clientTempId = data?.clientTempId;
    const fail = (code, message) => socket.emit("send-error", { clientTempId, code, message });

    try {
      const {
        dmSessionId,
        receiverId,
        channelId,
        workspaceId,
        ciphertext,
        messageIv,
        attachments = [],
        replyTo = null,
        parentId: rawParentId = null,
        quotedMessageId = null,
      } = data;

      if (!dmSessionId && !channelId && !receiverId) {
        return fail("MISSING_TARGET", "dmSessionId, channelId or receiverId required");
      }

      // E2EE is mandatory for text messages (mirrors messages.service.createMessage / REST path).
      if (!ciphertext || !messageIv) {
        return fail("E2EE_REQUIRED", "Encrypted payload required (ciphertext + messageIv)");
      }

      let channelDoc = null;
      let dmDoc = null;
      let createdDM = false;

      if (channelId) {
        channelDoc = await Channel.findById(channelId).select("members workspace company").lean();
        if (!channelDoc) return fail("NOT_FOUND", "Channel not found");
        if (!isChannelMember(channelDoc, userId)) return fail("FORBIDDEN", "Not a member of this channel");
      } else if (dmSessionId) {
        dmDoc = await DMSession.findById(dmSessionId).select("participants workspace company").lean();
        if (!dmDoc) return fail("NOT_FOUND", "DM session not found");
        if (!isDMParticipant(dmDoc, userId)) return fail("FORBIDDEN", "Not a participant of this DM");
      } else {
        // New DM via receiverId: both users must belong to the given workspace.
        if (!workspaceId) return fail("MISSING_WORKSPACE", "workspaceId required");
        if (sameId(receiverId, userId)) return fail("INVALID_TARGET", "Cannot DM yourself");
        const ws = await Workspace.findById(workspaceId).select("members company").lean();
        if (!ws) return fail("NOT_FOUND", "Workspace not found");
        if (!isWorkspaceMember(ws, userId) || !isWorkspaceMember(ws, receiverId)) {
          return fail("FORBIDDEN", "Both users must be members of this workspace");
        }
        const session = await messagesService.findOrCreateDMSession(userId, receiverId, workspaceId);
        dmDoc = {
          _id: session._id,
          participants: session.participants,
          workspace: session.workspace || workspaceId,
          company: session.company || ws.company || null,
        };
        createdDM = true;
      }

      const targetChannel = channelDoc ? channelDoc._id : null;
      const targetDM = dmDoc ? dmDoc._id : null;
      const workspace = (channelDoc || dmDoc).workspace || null;
      const company = (channelDoc || dmDoc).company || null;

      // Thread parent must live in the same conversation.
      const parentId = rawParentId || replyTo || null;
      if (parentId) {
        const parent = await Message.findById(parentId).select("channel dm").lean();
        const sameConv = parent && (targetChannel ? sameId(parent.channel, targetChannel) : sameId(parent.dm, targetDM));
        if (!sameConv) return fail("INVALID_PARENT", "Parent message not found in this conversation");
      }
      if (quotedMessageId) {
        const quoted = await Message.findById(quotedMessageId).select("channel dm").lean();
        const sameConv = quoted && (targetChannel ? sameId(quoted.channel, targetChannel) : sameId(quoted.dm, targetDM));
        if (!sameConv) return fail("INVALID_QUOTE", "Quoted message not found in this conversation");
      }

      if (createdDM) {
        const otherId = (dmDoc.participants || []).map(p => String(p?._id ?? p)).find(p => p !== String(userId)) || String(receiverId);
        io.to(`user_${userId}`).emit("new-dm-session", { dmSessionId: targetDM, otherUserId: otherId });
        io.to(`user_${otherId}`).emit("new-dm-session", { dmSessionId: targetDM, otherUserId: userId });
        socket.join(`dm:${targetDM}`);
      }

      const saved = await messagesService.createMessage({
        type: "message",
        company,
        workspace,
        channel: targetChannel,
        dm: targetDM,
        sender: userId,
        attachments: Array.isArray(attachments) ? attachments : [],
        parentId,
        quotedMessageId,
        ciphertext,
        messageIv,
      });

      if (parentId) {
        await Message.findByIdAndUpdate(parentId, {
          $inc: { replyCount: 1 },
          $set: { lastReplyAt: new Date() },
        });
      }

      const populated = saved && typeof saved.toObject === "function" ? saved.toObject() : saved;

      const eventName = parentId ? "thread-reply" : "new-message";
      const payload = parentId
        ? { parentId, reply: populated, clientTempId }
        : { message: populated, clientTempId };

      if (targetDM) {
        io.to(`dm:${targetDM}`).emit(eventName, payload);
        (dmDoc.participants || []).forEach(participantId => {
          io.to(`user_${participantId?._id ?? participantId}`).emit(eventName, payload);
        });
      } else {
        io.to(`channel:${targetChannel}`).emit(eventName, payload);
      }

      socket.emit("message-sent", { message: populated, clientTempId });

      activityService.emitWithIo(io, {
        type:        ACTIVITY_TYPES.MESSAGE,
        subtype:     ACTIVITY_SUBTYPES.SENT,
        actor:       userId,
        workspaceId: workspace || null,
        payload: {
          context:   targetChannel ? "channel" : "dm",
          contextId: targetChannel || targetDM,
          preview:   "",
        },
      }).catch(() => {});
    } catch (err) {
      logger.error("❌ [SOCKET] send-message failed:", err);
      fail("SERVER_ERROR", "Failed to send message");
    }
  });

  
  socket.on("mark-chat-read", async ({ type, id } = {}) => {
    try {
      const readerId = userId;
      if (!id) return;

      if (type === "dm") {
        const dm = await DMSession.findById(id).select("participants").lean();
        if (!isDMParticipant(dm, readerId)) return;

        await Message.updateMany(
          { dm: id, sender: { $ne: readerId }, readBy: { $ne: readerId } },
          { $addToSet: { readBy: readerId } }
        );

        io.to(`dm:${id}`).emit("read-update", { readerId, dmSessionId: id });
        // Other tabs/devices of the reader drop their unread badge too.
        io.to(`user:${readerId}`).emit("conversation:read", { conversationType: "dm", conversationId: String(id) });

      } else if (type === "channel") {
        const channel = await Channel.findById(id).select("members").lean();
        if (!isChannelMember(channel, readerId)) return;

        await Message.updateMany(
          { channel: id, sender: { $ne: readerId }, readBy: { $ne: readerId } },
          { $addToSet: { readBy: readerId } }
        );

        io.to(`channel:${id}`).emit("read-update", { readerId, channelId: id });
        io.to(`user:${readerId}`).emit("conversation:read", { conversationType: "channel", conversationId: String(id) });
      }
    } catch (err) {
      logger.error("MARK READ ERROR:", err);
    }
  });

  
  socket.on("message-read", async ({ messageId } = {}) => {
    try {
      const readerId = userId;
      const ctx = await loadAuthorizedMessage(messageId, readerId);
      if (!ctx) return;

      await Message.updateOne({ _id: messageId }, { $addToSet: { readBy: readerId } });

      io.to(ctx.room).emit("read-update", { readerId, messageIds: [messageId] });
    } catch (err) {
      logger.error("message-read ERROR:", err);
    }
  });

  
  socket.on("typing", async ({ dmSessionId, channelId } = {}) => {
    try {
      const room = dmSessionId ? `dm:${dmSessionId}` : channelId ? `channel:${channelId}` : null;
      // Only rooms this socket was admitted to (join handlers enforce membership).
      if (!room || !socket.rooms.has(room)) return;

      if (socket.data.username === undefined) {
        const u = await User.findById(userId).select("username").lean();
        socket.data.username = u?.username || null;
      }
      const fromName = socket.data.username || "Someone";

      const payload = { from: userId, fromName };
      if (dmSessionId) payload.dmSessionId = dmSessionId;
      else payload.channelId = channelId;

      socket.to(room).emit("typing", payload);
    } catch (err) {
      logger.error("TYPING ERROR:", err);
    }
  });

  
  socket.on("add-reaction", async ({ messageId, emoji } = {}) => {
    try {
      if (!emoji || typeof emoji !== "string" || emoji.length > 64) {
        socket.emit("reaction-error", { messageId, code: "INVALID_EMOJI", error: "Invalid emoji" });
        return;
      }
      const ctx = await loadAuthorizedMessage(messageId, userId);
      if (!ctx) {
        socket.emit("reaction-error", { messageId, code: "NOT_FOUND", error: "Message not found" });
        return;
      }

      await Message.updateOne({ _id: messageId }, { $pull: { reactions: { userId } } });
      const updated = await Message.findOneAndUpdate(
        { _id: messageId },
        { $push: { reactions: { emoji, userId } } },
        { new: true, select: "reactions channel dm" }
      );
      if (!updated) {
        socket.emit("reaction-error", { messageId, code: "NOT_FOUND", error: "Message not found" });
        return;
      }

      io.to(ctx.room).emit("reaction-added", {
        messageId,
        userId,
        emoji,
        reactions: updated.reactions,
      });

      activityService.emitWithIo(io, {
        type:    ACTIVITY_TYPES.REACTION,
        subtype: ACTIVITY_SUBTYPES.ADDED,
        actor:   userId,
        payload: { messageId, emoji },
      }).catch(() => {});
    } catch (err) {
      logger.error("ADD REACTION ERROR:", err);
      socket.emit("reaction-error", { messageId, code: "SERVER_ERROR", error: "Failed to add reaction" });
    }
  });

  
  socket.on("remove-reaction", async ({ messageId } = {}) => {
    try {
      const ctx = await loadAuthorizedMessage(messageId, userId);
      if (!ctx) {
        socket.emit("reaction-error", { messageId, code: "NOT_FOUND", error: "Message not found" });
        return;
      }

      const updated = await Message.findOneAndUpdate(
        { _id: messageId },
        { $pull: { reactions: { userId } } },
        { new: true, select: "reactions channel dm" }
      );
      if (!updated) {
        socket.emit("reaction-error", { messageId, code: "NOT_FOUND", error: "Message not found" });
        return;
      }

      io.to(ctx.room).emit("reaction-removed", {
        messageId,
        userId,
        reactions: updated.reactions,
      });
    } catch (err) {
      logger.error("REMOVE REACTION ERROR:", err);
      socket.emit("reaction-error", { messageId, code: "SERVER_ERROR", error: "Failed to remove reaction" });
    }
  });

  
  socket.on("delete-message", async ({ messageId, localOnly = false } = {}) => {
    try {
      const ctx = await loadAuthorizedMessage(messageId, userId, "channel dm workspace sender hiddenFor");
      if (!ctx) {
        socket.emit("delete-error", { messageId, code: "NOT_FOUND", error: "Message not found" });
        return;
      }
      const { message } = ctx;

      const isOwnMessage = sameId(message.sender, userId);
      let isAdmin = false;

      // Admin rights derive from the message's own channel -> workspace, never from client input.
      if (ctx.channel && ctx.channel.workspace) {
        const workspace = await Workspace.findById(ctx.channel.workspace).select("members").lean();
        const member = workspace?.members?.find(m => sameId(extractMemberId(m), userId));
        isAdmin = !!member && (member.role === "admin" || member.role === "owner");
      }

      const hideLocally = async () => {
        if (!(message.hiddenFor || []).some(h => sameId(h, userId))) {
          message.hiddenFor.push(userId);
        }
        await message.save();
        socket.emit("message-deleted", { messageId, isLocal: true });
      };

      if (localOnly || !(isAdmin || isOwnMessage)) {
        await hideLocally();
        return;
      }

      const currentUser = await User.findById(userId).select("username").lean();
      const deleterName = currentUser ? currentUser.username : "Unknown";

      message.isDeletedUniversally = true;
      message.deletedBy = userId;
      message.deletedByName = deleterName;
      message.deletedAt = new Date();
      await message.save();

      io.to(ctx.room).emit("message-deleted", {
        messageId,
        deletedBy: userId,
        deletedByName: deleterName,
        isUniversal: true,
      });
    } catch (err) {
      logger.error("DELETE MESSAGE ERROR:", err);
      socket.emit("delete-error", { messageId, code: "SERVER_ERROR", error: "Failed to delete message" });
    }
  });

  
  socket.on("pin-message", async ({ messageId } = {}) => {
    try {
      const ctx = await loadAuthorizedMessage(messageId, userId);
      if (!ctx || !ctx.channel) {
        socket.emit("pin-error", { messageId, code: "NOT_FOUND", error: "Message not found" });
        return;
      }
      const channelId = ctx.message.channel;

      const pinnedCount = await Message.countDocuments({ channel: channelId, isPinned: true });
      if (pinnedCount >= 3) {
        socket.emit("pin-error", {
          messageId,
          code: "PIN_LIMIT",
          error: "Maximum 3 pins allowed per channel. Unpin a message first.",
        });
        return;
      }

      const message = await Message.findOneAndUpdate(
        { _id: messageId, channel: channelId },
        { isPinned: true, pinnedBy: userId, pinnedAt: new Date() },
        { new: true }
      ).populate("pinnedBy", "username");

      const pinner = await User.findById(userId).select("username").lean();

      io.to(`channel:${channelId}`).emit("message-pinned", {
        messageId,
        pinnedBy: userId,
        pinnedByName: pinner?.username || "Unknown",
        message,
      });
    } catch (err) {
      logger.error("PIN MESSAGE ERROR:", err);
      socket.emit("pin-error", { messageId, code: "SERVER_ERROR", error: "Failed to pin message" });
    }
  });

  
  socket.on("unpin-message", async ({ messageId } = {}) => {
    try {
      const ctx = await loadAuthorizedMessage(messageId, userId);
      if (!ctx || !ctx.channel) {
        socket.emit("pin-error", { messageId, code: "NOT_FOUND", error: "Message not found" });
        return;
      }
      const channelId = ctx.message.channel;

      await Message.updateOne(
        { _id: messageId, channel: channelId },
        { isPinned: false, pinnedBy: null, pinnedAt: null }
      );

      io.to(`channel:${channelId}`).emit("message-unpinned", { messageId });
    } catch (err) {
      logger.error("UNPIN MESSAGE ERROR:", err);
      socket.emit("pin-error", { messageId, code: "SERVER_ERROR", error: "Failed to unpin message" });
    }
  });

  
  socket.on("knowledge:join", async ({ pageId } = {}) => {
    try {
      if (!pageId) return;
      const KnowledgePage = require("../features/knowledge/KnowledgePage");
      const page = await KnowledgePage.findById(pageId).select("workspaceId").lean();
      if (!page) return;
      const ws = await Workspace.findById(page.workspaceId).select("members").lean();
      if (!isWorkspaceMember(ws, userId)) return;
      socket.join(`knowledge:${pageId}`);
      socket.to(`knowledge:${pageId}`).emit("knowledge:presence", {
        pageId,
        userId,
        action: "joined",
      });
    } catch (err) {
      logger.error("knowledge:join ERROR:", err);
    }
  });

  socket.on("knowledge:leave", ({ pageId }) => {
    if (!pageId) return;
    socket.leave(`knowledge:${pageId}`);
    socket.to(`knowledge:${pageId}`).emit("knowledge:presence", {
      pageId,
      userId,
      action: "left",
    });
  });

  socket.on("knowledge:cursor", ({ pageId, position } = {}) => {
    if (!pageId || !socket.rooms.has(`knowledge:${pageId}`)) return;
    socket.to(`knowledge:${pageId}`).emit("knowledge:cursors", {
      pageId,
      userId,
      position,
    });
  });

  
  socket.on("file:join", async ({ fileId } = {}) => {
    try {
      if (!fileId) return;
      const WorkspaceFile = require("../features/files/WorkspaceFile");
      const file = await WorkspaceFile.findById(fileId).select("workspaceId").lean();
      if (!file) return;
      const ws = await Workspace.findById(file.workspaceId).select("members").lean();
      if (!isWorkspaceMember(ws, userId)) return;
      socket.join(`file:${fileId}`);
      socket.to(`file:${fileId}`).emit("file:presence", {
        fileId,
        userId,
        action: "viewing",
      });
    } catch (err) {
      logger.error("file:join ERROR:", err);
    }
  });

  socket.on("file:leave", ({ fileId }) => {
    if (!fileId) return;
    socket.leave(`file:${fileId}`);
    socket.to(`file:${fileId}`).emit("file:presence", {
      fileId,
      userId,
      action: "left",
    });
  });

  
  
  
  
  
  
  
  
  
  
  
  
  
};
