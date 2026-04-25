const Message = require("../features/messages/message.model");
const Channel = require("../features/channels/channel.model");
const DMSession = require("../../models/DMSession");
const Workspace = require("../../models/Workspace");
const User = require("../../models/User");
const logger = require("../../utils/logger");
const messagesService = require("../modules/messages/messages.service");
const ROOMS = require("../shared/utils/rooms");

const registerHuddleHandlers = require("./handlers/huddles.socket");

const activityService = require("../features/activity/activity.service");
const { ACTIVITY_TYPES, ACTIVITY_SUBTYPES } = require("../../../platform/sdk/events/activityEvents");

module.exports = async function registerChatHandlers(io, socket) {
  const userId = socket.user.id; 

  
  registerHuddleHandlers(io, socket);

  
  socket.join(`user_${userId}`);

  
  try {
    const user = await User.findById(userId).select('companyId');
    if (user && user.companyId) {
      const companyId = user.companyId.toString();
      const companyRoom = `company_${companyId}`;
      socket.join(companyRoom);
      
      const updatesRoom = ROOMS.companyUpdates(companyId);
      socket.join(updatesRoom);
      logger.debug(`✅ [AUTO-JOIN] User ${userId} joined ${companyRoom} and ${updatesRoom}`);
    }
  } catch (err) {
    console.error("Error auto-joining company room:", err);
  }

  
  
  
  
  
  
  (async () => {
    const joinedRooms = [];

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

  
  socket.on("join-channel", ({ channelId }) => {
    try {
      if (!channelId) {
        logger.error("join-channel: missing channelId");
        return;
      }
      const room = `channel:${channelId}`;
      socket.join(room);
    } catch (err) {
      logger.error("Error joining channel room:", err);
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

  
  socket.on("send-message", async (data) => {
    try {
      const {
        dmSessionId,
        receiverId,
        channelId,
        workspaceId,
        text = "",
        attachments = [],
        replyTo = null,
        clientTempId
      } = data;

      console.log("🔍 [SOCKET] Parsed data - channelId:", channelId, "dmSessionId:", dmSessionId, "clientTempId:", clientTempId);

      if (!dmSessionId && !channelId && !receiverId) {
        console.log("❌ [SOCKET] Validation failed: missing dmSessionId/channelId/receiverId");
        socket.emit("send-error", {
          clientTempId,
          message: "dmSessionId, channelId or receiverId required",
        });
        return;
      }

      if (!workspaceId) {
        socket.emit("send-error", {
          clientTempId,
          message: "workspaceId required",
        });
        return;
      }

      let actualDMSessionId = dmSessionId;

      
      
      
      
      
      if (receiverId && !actualDMSessionId) {
        const dmSession = await messagesService.findOrCreateDMSession(
          userId,
          receiverId,
          workspaceId
        );

        actualDMSessionId = dmSession._id;

        
        io.to(`user_${userId}`).emit("new-dm-session", {
          dmSessionId: dmSession._id,
          otherUserId: receiverId
        });
        io.to(`user_${receiverId}`).emit("new-dm-session", {
          dmSessionId: dmSession._id,
          otherUserId: userId
        });

        
        socket.join(`dm:${actualDMSessionId}`);
      }

      
      let companyId = null;

      if (actualDMSessionId) {
        const dmSession = await DMSession.findById(actualDMSessionId);
        companyId = dmSession?.company;
      } else if (channelId) {
        const channel = await Channel.findById(channelId);
        companyId = channel?.company;
      }

      const doc = {
        sender: userId,
        company: companyId,
        workspace: workspaceId,
        text,
        attachments,
        threadParent: replyTo || null,
      };

      if (actualDMSessionId) {
        doc.dm = actualDMSessionId;
      } else {
        doc.channel = channelId;
      }

      
      const saved = await Message.create(doc);

      console.log(`✉️ [PHASE 3] Encrypted message saved for ${channelId ? `channel:${channelId}` : `dm:${actualDMSessionId}`}`);

      const populated = await Message.findById(saved._id)
        .populate("sender", "username profilePicture")
        .populate({
          path: "threadParent",
          populate: { path: "sender", select: "username profilePicture" }
        });

      
      const eventName = replyTo ? "thread-reply" : "new-message";
      const payload = replyTo
        ? { parentId: replyTo, reply: populated, clientTempId }
        : { message: populated, clientTempId };

      if (actualDMSessionId) {
        
        io.to(`dm:${actualDMSessionId}`).emit(eventName, payload);

        
        const dmSession = await DMSession.findById(actualDMSessionId);
        if (dmSession) {
          dmSession.participants.forEach(participantId => {
            io.to(`user_${participantId}`).emit(eventName, payload);
          });
        }
      } else if (channelId) {
        io.to(`channel:${channelId}`).emit(eventName, payload);
      }

      
      socket.emit("message-sent", {
        message: populated,
        clientTempId,
      });

      
      activityService.emitWithIo(io, {
        type:        ACTIVITY_TYPES.MESSAGE,
        subtype:     ACTIVITY_SUBTYPES.SENT,
        actor:       userId,
        workspaceId: workspaceId || null,
        payload: {
          context:   channelId ? 'channel' : 'dm',
          contextId: channelId || actualDMSessionId,
          preview:   (text || '').substring(0, 120),
        },
      }).catch(() => {});
      

    } catch (err) {
      console.error("❌ [SOCKET] ERROR in send-message handler:", err);
      console.error("❌ [SOCKET] Stack trace:", err.stack);
      logger.error("❌ SOCKET SEND ERROR:", err);
      socket.emit("send-error", {
        clientTempId: data.clientTempId,
        message: err.message || "Failed to send message",
      });
    }
  });

  
  socket.on("mark-chat-read", async ({ type, id }) => {
    try {
      const readerId = userId;

      if (type === "dm") {
        const dmSessionId = id;

        const result = await Message.updateMany(
          {
            dm: dmSessionId,
            sender: { $ne: readerId },
            readBy: { $ne: readerId }
          },
          { $addToSet: { readBy: readerId } }
        );

        io.to(`dm:${dmSessionId}`).emit("read-update", {
          readerId,
          dmSessionId: dmSessionId,
        });

      } else if (type === "channel") {
        const channelId = id;
        const channel = await Channel.findById(channelId).select("members");
        if (!channel) return;

        if (!channel.members.some(m => String(m) === String(readerId))) return;

        const result = await Message.updateMany(
          {
            channel: channelId,
            sender: { $ne: readerId },
            readBy: { $ne: readerId }
          },
          { $addToSet: { readBy: readerId } }
        );

        io.to(`channel:${channelId}`).emit("read-update", {
          readerId,
          channelId: channelId,
        });
      }

    } catch (err) {
      logger.error("MARK READ ERROR:", err);
    }
  });

  
  socket.on("message-read", async ({ messageId }) => {
    try {
      const readerId = userId;

      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { readBy: readerId }
      });

      const msg = await Message.findById(messageId)
        .select("channelId receiverId senderId dm"); 

      if (!msg) return;

      if (msg.channelId) {
        io.to(`channel:${msg.channelId}`).emit("read-update", {
          readerId,
          messageIds: [messageId],
        });
      } else if (msg.dm) { 
        io.to(`dm:${msg.dm.toString()}`).emit("read-update", { 
          readerId,
          messageIds: [messageId],
        });
      }

    } catch (err) {
      logger.error("message-read ERROR:", err);
    }
  });

  
  socket.on("typing", async ({ dmSessionId, channelId }) => {
    try {
      
      const fromName = socket.user?.username || "Someone";

      if (dmSessionId) {
        io.to(`dm:${dmSessionId}`).emit("typing", { from: userId, fromName });
      } else if (channelId) {
        io.to(`channel:${channelId}`).emit("typing", { from: userId, fromName });
      }
    } catch (err) {
      logger.error("TYPING ERROR:", err);
    }
  });

  
  socket.on("add-reaction", async ({ messageId, emoji }) => {
    try {
      
      
      await Message.findOneAndUpdate(
        { _id: messageId, "reactions.userId": userId },
        { $pull: { reactions: { userId } } }
      );

      
      
      
      const updated = await Message.findOneAndUpdate(
        { _id: messageId },
        { $push: { reactions: { emoji, userId } } },
        { new: true, select: "reactions channel dm" }
      );

      if (!updated) {
        socket.emit("reaction-error", { messageId, error: "Message not found" });
        return;
      }

      const room = updated.channel
        ? `channel:${updated.channel}`
        : `dm:${updated.dm}`;

      io.to(room).emit("reaction-added", {
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
      socket.emit("reaction-error", { messageId, error: err.message });
    }
  });

  
  socket.on("remove-reaction", async ({ messageId }) => {
    try {
      
      const updated = await Message.findOneAndUpdate(
        { _id: messageId },
        { $pull: { reactions: { userId } } },
        { new: true, select: "reactions channel dm" }
      );

      if (!updated) {
        socket.emit("reaction-error", { messageId, error: "Message not found" });
        return;
      }

      const room = updated.channel
        ? `channel:${updated.channel}`
        : `dm:${updated.dm}`;

      io.to(room).emit("reaction-removed", {
        messageId,
        userId,
        reactions: updated.reactions,
      });
    } catch (err) {
      logger.error("REMOVE REACTION ERROR:", err);
      socket.emit("reaction-error", { messageId, error: err.message });
    }
  });

  
  socket.on("delete-message", async ({ messageId, channelId, dmSessionId, localOnly = false }) => {
    try {
      const message = await Message.findById(messageId).populate("sender");
      if (!message) {
        socket.emit("delete-error", { messageId, error: "Message not found" });
        return;
      }

      const isOwnMessage = message.sender._id.toString() === userId;
      let isAdmin = false;

      
      if (channelId) {
        const channel = await Channel.findById(channelId).populate("workspace");
        if (channel) {
          const workspace = await Workspace.findById(channel.workspace);
          const member = workspace.members.find(
            (m) => m.user.toString() === userId
          );
          isAdmin = member && (member.role === "admin" || member.role === "owner");
        }
      }

      
      if (localOnly) {
        
        if (!message.hiddenFor.includes(userId)) {
          message.hiddenFor.push(userId);
        }
        await message.save();

        
        socket.emit("message-deleted", {
          messageId,
          isLocal: true,
        });
      } else if (isAdmin || isOwnMessage) {
        
        const currentUser = await User.findById(userId);
        const deleterName = currentUser ? currentUser.username : "Unknown";

        message.isDeletedUniversally = true;
        message.deletedBy = userId;
        message.deletedByName = deleterName;
        message.deletedAt = new Date();
        await message.save();

        
        const room = channelId ? `channel:${channelId}` : `dm:${dmSessionId}`;
        io.to(room).emit("message-deleted", {
          messageId,
          deletedBy: userId,
          deletedByName: deleterName,  
          isUniversal: true,
        });
      } else {
        
        if (!message.hiddenFor.includes(userId)) {
          message.hiddenFor.push(userId);
        }
        await message.save();

        socket.emit("message-deleted", {
          messageId,
          isLocal: true,
        });
      }
    } catch (err) {
      logger.error("DELETE MESSAGE ERROR:", err);
      socket.emit("delete-error", { messageId, error: err.message });
    }
  });

  
  socket.on("pin-message", async ({ messageId, channelId }) => {
    try {
      
      const channel = await Channel.findById(channelId);
      if (!channel) {
        socket.emit("pin-error", { messageId, error: "Channel not found" });
        return;
      }

      
      

      
      const pinnedCount = await Message.countDocuments({
        channel: channelId,
        isPinned: true,
      });

      if (pinnedCount >= 3) {
        socket.emit("pin-error", {
          messageId,
          error: "Maximum 3 pins allowed per channel. Unpin a message first.",
        });
        return;
      }

      
      const message = await Message.findByIdAndUpdate(
        messageId,
        {
          isPinned: true,
          pinnedBy: userId,
          pinnedAt: new Date(),
        },
        { new: true }
      ).populate("pinnedBy", "username");

      
      const pinner = await User.findById(userId).select("username");

      
      io.to(`channel:${channelId}`).emit("message-pinned", {
        messageId,
        pinnedBy: userId,
        pinnedByName: pinner?.username || "Unknown",
        message,
      });
    } catch (err) {
      logger.error("PIN MESSAGE ERROR:", err);
      socket.emit("pin-error", { messageId, error: err.message });
    }
  });

  
  socket.on("unpin-message", async ({ messageId, channelId }) => {
    try {
      
      const channel = await Channel.findById(channelId);
      if (!channel) {
        socket.emit("pin-error", { messageId, error: "Channel not found" });
        return;
      }

      
      

      
      await Message.findByIdAndUpdate(messageId, {
        isPinned: false,
        pinnedBy: null,
        pinnedAt: null,
      });

      
      io.to(`channel:${channelId}`).emit("message-unpinned", {
        messageId,
      });
    } catch (err) {
      logger.error("UNPIN MESSAGE ERROR:", err);
      socket.emit("pin-error", { messageId, error: err.message });
    }
  });

  
  socket.on("knowledge:join", ({ pageId }) => {
    if (!pageId) return;
    socket.join(`knowledge:${pageId}`);
    
    socket.to(`knowledge:${pageId}`).emit("knowledge:presence", {
      pageId,
      userId,
      action: "joined",
    });
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

  socket.on("knowledge:cursor", ({ pageId, position }) => {
    if (!pageId) return;
    socket.to(`knowledge:${pageId}`).emit("knowledge:cursors", {
      pageId,
      userId,
      position,
    });
  });

  
  socket.on("file:join", ({ fileId }) => {
    if (!fileId) return;
    socket.join(`file:${fileId}`);
    socket.to(`file:${fileId}`).emit("file:presence", {
      fileId,
      userId,
      action: "viewing",
    });
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
