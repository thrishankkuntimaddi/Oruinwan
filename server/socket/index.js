// server/socket/index.js

const Message = require("../src/features/messages/message.model");
const Channel = require("../src/features/channels/channel.model");
const DMSession = require("../models/DMSession");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const logger = require("../utils/logger");
const messagesService = require("../src/modules/messages/messages.service");
const ROOMS = require("../src/shared/utils/rooms");
// Phase 7.7 — Huddle signaling
const registerHuddleHandlers = require("../src/socket/handlers/huddles.socket");
// Unified Activity Stream — fire-and-forget side effects
const activityService = require("../src/features/activity/activity.service");
const { ACTIVITY_TYPES, ACTIVITY_SUBTYPES } = require("../../platform/sdk/events/activityEvents");

module.exports = async function registerChatHandlers(io, socket) {
  const userId = socket.user.id; // extracted from JWT

  // Phase 7.7 — Register huddle events for this socket
  registerHuddleHandlers(io, socket);

  // ✅ JOIN USER-SPECIFIC ROOM for targeted events
  socket.join(`user_${userId}`);

  // ✅ JOIN COMPANY ROOM + COMPANY UPDATES ROOM (Auto-join)
  try {
    const user = await User.findById(userId).select('companyId');
    if (user && user.companyId) {
      const companyId = user.companyId.toString();
      const companyRoom = `company_${companyId}`;
      socket.join(companyRoom);
      // Auto-join company updates room so all users receive real-time update events
      const updatesRoom = ROOMS.companyUpdates(companyId);
      socket.join(updatesRoom);
      logger.debug(`✅ [AUTO-JOIN] User ${userId} joined ${companyRoom} and ${updatesRoom}`);
    }
  } catch (err) {
    console.error("Error auto-joining company room:", err);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ✅ SESSION RESTORATION (Reconnect support)
  // Auto-rejoin all DM and channel rooms this user belongs to.
  // Runs on every connection — safe for both fresh connects and reconnects.
  // Errors are isolated: a DB failure logs and continues, never crashes setup.
  // ──────────────────────────────────────────────────────────────────────────
  (async () => {
    const joinedRooms = [];

    try {
      // Run both queries in parallel — .lean() returns plain objects (no Mongoose overhead)
      const [dmSessions, channels] = await Promise.all([
        DMSession.find({ participants: userId })
          .select('_id')
          .lean(),
        Channel.find({ 'members.user': userId })
          .select('_id')
          .lean()
      ]);

      // Rejoin all DM rooms
      for (const dm of dmSessions) {
        const room = `dm:${dm._id}`;
        socket.join(room);
        joinedRooms.push(room);
      }

      // Rejoin all channel rooms
      for (const ch of channels) {
        const room = `channel:${ch._id}`;
        socket.join(room);
        joinedRooms.push(room);
      }

      logger.info(`✅ [RECONNECT] User ${userId} restored ${joinedRooms.length} rooms`);

    } catch (err) {
      // DB failure: log and continue — socket is still usable for manual joins
      logger.error(`❌ [RECONNECT] Room restoration failed for user ${userId}:`, err.message);
    }

    // Always emit 'reconnected' so the client knows restoration is complete
    // (even if DB failed — client can decide to fetch missed messages via REST)
    socket.emit('reconnected', {
      userId,
      restoredRooms: joinedRooms.length,
      timestamp: new Date().toISOString()
    });
  })();

  /* ----------------------------------------------------
     JOIN DM SESSION ROOM
  ---------------------------------------------------- */
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

      // SECURITY: Verify the requesting user is a participant of this DM session
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

  /* ----------------------------------------------------
     JOIN CHANNEL ROOM
  ---------------------------------------------------- */
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

  /* ----------------------------------------------------
     JOIN CHANNEL ROOM (NEW - chat:join compatibility)
     FIX 3: SOCKET.IO AUTHORIZATION ALIGNMENT
  ---------------------------------------------------- */
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

  /* ----------------------------------------------------
     JOIN WORKSPACE ROOM (For real-time updates like invites)
  ---------------------------------------------------- */
  socket.on("join-workspace", async ({ workspaceId }) => {
    try {
      if (!workspaceId) {
        logger.error("join-workspace: missing workspaceId");
        socket.emit("join-error", { event: "join-workspace", code: "MISSING_ID", message: "workspaceId is required" });
        return;
      }

      // SECURITY: Verify the requesting user is a member of this workspace
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

  /* ----------------------------------------------------
     JOIN COMPANY UPDATES ROOM (for the Updates feed)
  ---------------------------------------------------- */
  socket.on("join-company-updates", async (companyId) => {
    try {
      if (!companyId) return;

      // Security: verify the user belongs to this company
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

  /* ----------------------------------------------------
     SEND MESSAGE (DM or Channel) + ACK
  ---------------------------------------------------- */
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

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // DM E2EE FIX: Handle new DM session creation with key bootstrap
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // BEFORE: Inline DMSession.create() without key bootstrap (BROKEN)
      // AFTER: Delegate to findOrCreateDMSession() which correctly bootstraps keys
      if (receiverId && !actualDMSessionId) {
        const dmSession = await messagesService.findOrCreateDMSession(
          userId,
          receiverId,
          workspaceId
        );

        actualDMSessionId = dmSession._id;

        // ✅ Emit to both participants to refresh their DM lists
        io.to(`user_${userId}`).emit("new-dm-session", {
          dmSessionId: dmSession._id,
          otherUserId: receiverId
        });
        io.to(`user_${receiverId}`).emit("new-dm-session", {
          dmSessionId: dmSession._id,
          otherUserId: userId
        });

        // Join the new room
        socket.join(`dm:${actualDMSessionId}`);
      }

      // Populate common message data
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

      // Save message
      const saved = await Message.create(doc);

      console.log(`✉️ [PHASE 3] Encrypted message saved for ${channelId ? `channel:${channelId}` : `dm:${actualDMSessionId}`}`);

      const populated = await Message.findById(saved._id)
        .populate("sender", "username profilePicture")
        .populate({
          path: "threadParent",
          populate: { path: "sender", select: "username profilePicture" }
        });

      // ---------------- broadcast ----------------
      const eventName = replyTo ? "thread-reply" : "new-message";
      const payload = replyTo
        ? { parentId: replyTo, reply: populated, clientTempId }
        : { message: populated, clientTempId };

      if (actualDMSessionId) {
        // Emit to DM room
        io.to(`dm:${actualDMSessionId}`).emit(eventName, payload);

        // Also emit to each participant's personal user room for real-time delivery
        const dmSession = await DMSession.findById(actualDMSessionId);
        if (dmSession) {
          dmSession.participants.forEach(participantId => {
            io.to(`user_${participantId}`).emit(eventName, payload);
          });
        }
      } else if (channelId) {
        io.to(`channel:${channelId}`).emit(eventName, payload);
      }

      // ---------------- ack to sender ----------------
      socket.emit("message-sent", {
        message: populated,
        clientTempId,
      });

      // ── Unified Activity Stream ── fire-and-forget, never blocks ──────────
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
      // ─────────────────────────────────────────────────────────────────────

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

  /* ----------------------------------------------------
     READ RECEIPTS
  ---------------------------------------------------- */
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

  /* ----------------------------------------------------
     READ SINGLE MESSAGE
  ---------------------------------------------------- */
  socket.on("message-read", async ({ messageId }) => {
    try {
      const readerId = userId;

      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { readBy: readerId }
      });

      const msg = await Message.findById(messageId)
        .select("channelId receiverId senderId dm"); // Added dm to select

      if (!msg) return;

      if (msg.channelId) {
        io.to(`channel:${msg.channelId}`).emit("read-update", {
          readerId,
          messageIds: [messageId],
        });
      } else if (msg.dm) { // Changed to check for dm
        io.to(`dm:${msg.dm.toString()}`).emit("read-update", { // Use dm session ID
          readerId,
          messageIds: [messageId],
        });
      }

    } catch (err) {
      logger.error("message-read ERROR:", err);
    }
  });

  /* ----------------------------------------------------
     TYPING
  ---------------------------------------------------- */
  socket.on("typing", async ({ dmSessionId, channelId }) => {
    try {
      // Get user's name for better UX
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

  /* ----------------------------------------------------
     ADD REACTION
  ---------------------------------------------------- */
  socket.on("add-reaction", async ({ messageId, emoji }) => {
    try {
      // Step 1: Atomically remove any existing reaction from this user
      //         (handles emoji change — user already reacted with a different emoji)
      await Message.findOneAndUpdate(
        { _id: messageId, "reactions.userId": userId },
        { $pull: { reactions: { userId } } }
      );

      // Step 2: Atomically push the new reaction
      //         Two separate ops keeps logic simple and both are atomic individually.
      //         Combined, they replace an existing reaction or add a fresh one.
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

      // ── Unified Activity Stream ── fire-and-forget ─────────────────────
      activityService.emitWithIo(io, {
        type:    ACTIVITY_TYPES.REACTION,
        subtype: ACTIVITY_SUBTYPES.ADDED,
        actor:   userId,
        payload: { messageId, emoji },
      }).catch(() => {});
      // ───────────────────────────────────────────────────────────────────

    } catch (err) {
      logger.error("ADD REACTION ERROR:", err);
      socket.emit("reaction-error", { messageId, error: err.message });
    }
  });

  /* ----------------------------------------------------
     REMOVE REACTION
  ---------------------------------------------------- */
  socket.on("remove-reaction", async ({ messageId }) => {
    try {
      // Atomically pull this user's reaction subdocument from the array
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

  /* ----------------------------------------------------
     DELETE MESSAGE (with permission logic)
  ---------------------------------------------------- */
  socket.on("delete-message", async ({ messageId, channelId, dmSessionId, localOnly = false }) => {
    try {
      const message = await Message.findById(messageId).populate("sender");
      if (!message) {
        socket.emit("delete-error", { messageId, error: "Message not found" });
        return;
      }

      const isOwnMessage = message.sender._id.toString() === userId;
      let isAdmin = false;

      // Check if user is admin (for channels)
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

      // Determine deletion type based on localOnly flag
      if (localOnly) {
        // Force local deletion - only hide for this user
        if (!message.hiddenFor.includes(userId)) {
          message.hiddenFor.push(userId);
        }
        await message.save();

        // Only notify the user who deleted it
        socket.emit("message-deleted", {
          messageId,
          isLocal: true,
        });
      } else if (isAdmin || isOwnMessage) {
        // Universal deletion - visible to all as "deleted by [name]"
        const currentUser = await User.findById(userId);
        const deleterName = currentUser ? currentUser.username : "Unknown";

        message.isDeletedUniversally = true;
        message.deletedBy = userId;
        message.deletedByName = deleterName;
        message.deletedAt = new Date();
        await message.save();

        // Broadcast to all participants
        const room = channelId ? `channel:${channelId}` : `dm:${dmSessionId}`;
        io.to(room).emit("message-deleted", {
          messageId,
          deletedBy: userId,
          deletedByName: deleterName,  // Fixed: now shows who deleted it, not the sender
          isUniversal: true,
        });
      } else {
        // Local deletion - only hide for this user (fallback for members deleting others' messages)
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

  /* ----------------------------------------------------
     PIN MESSAGE (All members can pin)
  ---------------------------------------------------- */
  socket.on("pin-message", async ({ messageId, channelId }) => {
    try {
      // Check if user is a member of the channel
      const channel = await Channel.findById(channelId);
      if (!channel) {
        socket.emit("pin-error", { messageId, error: "Channel not found" });
        return;
      }

      // If user is connected to this channel via socket, they're a member
      // Socket room join already verified membership

      // Check pin limit (max 3 pins per channel)
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

      // Update message
      const message = await Message.findByIdAndUpdate(
        messageId,
        {
          isPinned: true,
          pinnedBy: userId,
          pinnedAt: new Date(),
        },
        { new: true }
      ).populate("pinnedBy", "username");

      // Get pinner username
      const pinner = await User.findById(userId).select("username");

      // Broadcast to channel
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

  /* ----------------------------------------------------
     UNPIN MESSAGE (All members can unpin)
  ---------------------------------------------------- */
  socket.on("unpin-message", async ({ messageId, channelId }) => {
    try {
      // Check if user is a member of the channel
      const channel = await Channel.findById(channelId);
      if (!channel) {
        socket.emit("pin-error", { messageId, error: "Channel not found" });
        return;
      }

      // If user is connected to this channel via socket, they're a member
      // Socket room join already verified membership

      // Update message
      await Message.findByIdAndUpdate(messageId, {
        isPinned: false,
        pinnedBy: null,
        pinnedAt: null,
      });

      // Broadcast to channel
      io.to(`channel:${channelId}`).emit("message-unpinned", {
        messageId,
      });
    } catch (err) {
      logger.error("UNPIN MESSAGE ERROR:", err);
      socket.emit("pin-error", { messageId, error: err.message });
    }
  });

  /* ----------------------------------------------------
     KNOWLEDGE PAGE PRESENCE
  ---------------------------------------------------- */
  socket.on("knowledge:join", ({ pageId }) => {
    if (!pageId) return;
    socket.join(`knowledge:${pageId}`);
    // Notify others in the room that this user joined
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

  /* ----------------------------------------------------
     FILE ROOM (for comment presence)
  ---------------------------------------------------- */
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

  /* ----------------------------------------------------
     DISCONNECT
  ---------------------------------------------------- */
  socket.on("disconnect", async () => {
    // ✅ Set user offline status
    try {
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastActivityAt: new Date()
      });

      // Broadcast status change to all connected clients
      io.emit("user-status-changed", {
        userId: userId,
        status: "offline"
      });
    } catch (err) {
      logger.error("Error setting user offline:", err);
    }
  });
};
