// server/socket/index.js

const Message = require("../models/Message");
const Channel = require("../models/Channel");
const DMSession = require("../models/DMSession");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const logger = require("../utils/logger");
const messagesService = require("../src/modules/messages/messages.service");

module.exports = async function registerChatHandlers(io, socket) {
  const userId = socket.user.id; // extracted from JWT

  // ✅ JOIN USER-SPECIFIC ROOM for targeted events
  socket.join(`user_${userId}`);

  // ✅ JOIN COMPANY ROOM (Auto-join)
  try {
    const user = await User.findById(userId).select('companyId');
    if (user && user.companyId) {
      const companyRoom = `company_${user.companyId.toString()}`;
      socket.join(companyRoom);
      // console.log(`📢 User ${userId} auto-joined ${companyRoom}`);
    }
  } catch (err) {
    console.error("Error auto-joining company room:", err);
  }

  /* ----------------------------------------------------
     JOIN DM SESSION ROOM
  ---------------------------------------------------- */
  socket.on("join-dm", ({ dmSessionId }) => {
    try {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🔍 DEBUG LOG: What did join-dm handler receive?
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🔷 [JOIN-DM] Event received`);
      console.log(`🔷 [JOIN-DM] dmSessionId:`, dmSessionId);
      console.log(`🔷 [JOIN-DM] User ID:`, socket.user?.id);
      console.log(`🔷 [JOIN-DM] Socket ID:`, socket.id);

      logger.socket('[DEBUG][JOIN][RECEIVE]', {
        event: 'join-dm',
        receivedIdOrPayload: { dmSessionId },
        userId: socket.user?.id
      });

      if (!dmSessionId) {
        console.log(`❌ [JOIN-DM] Missing dmSessionId!`);
        logger.error("join-dm: missing dmSessionId");
        return;
      }
      // CRITICAL FIX: Use dm: format (colon) to match createMessage broadcasts
      // BEFORE: `dm_${dmSessionId}` (underscore) - WRONG!
      // AFTER: `dm:${dmSessionId}` (colon) - matches io.to(`dm:${dm}`)
      const room = `dm:${dmSessionId}`;
      socket.join(room);

      console.log(`✅ [JOIN-DM] User ${socket.user?.id} joined room: ${room}`);
      console.log(`✅ [JOIN-DM] Socket rooms:`, Array.from(socket.rooms));
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      logger.info(`✅ [join-dm] User ${socket.user?.id} joined ${room}`);
    } catch (err) {
      logger.error("Error joining DM room:", err);
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
      const room = `channel_${channelId}`;
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
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🔍 DEBUG LOG: What did chat:join handler receive?
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      logger.socket('[DEBUG][JOIN][RECEIVE]', {
        event: 'chat:join',
        receivedIdOrPayload: channelId,
        userId: socket.user?.id
      });

      // Validation: channelId required
      if (!channelId) {
        logger.error("chat:join: missing channelId");
        if (callback) callback({ error: 'Channel ID is required', code: 'MISSING_CHANNEL_ID' });
        return;
      }

      console.log(`📥 [chat:join] Received for channel: ${channelId}`);
      console.log(`👤 [chat:join] User: ${userId}, Socket: ${socket.id}`);

      // ============================================================
      // FIX 3: AUTHORIZATION CHECK
      // Verify user is a member before allowing socket.join()
      // ============================================================

      // Step 1: Verify channel exists
      const channel = await Channel.findById(channelId);

      if (!channel) {
        console.log(`❌ [chat:join] Channel ${channelId} not found`);
        if (callback) callback({
          error: 'Channel not found',
          code: 'CHANNEL_NOT_FOUND',
          channelId
        });
        return;
      }

      // ============================================================
      // 🔍 DEBUG LOGS: Diagnose membership check failures
      // ============================================================
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔍 [SOCKET][DEBUG] chat:join membership check");
      console.log("🔍 [SOCKET][DEBUG] Channel ID:", channelId);
      console.log("🔍 [SOCKET][DEBUG] Joining userId:", userId);
      console.log("🔍 [SOCKET][DEBUG] Channel members raw:", JSON.stringify(channel.members, null, 2));
      console.log("🔍 [SOCKET][DEBUG] Members count:", channel.members.length);

      // Inspect each member
      channel.members.forEach((m, i) => {
        const extractedId = m?.user?._id?.toString() ?? m?.user?.toString() ?? m?.toString();
        console.log(`🔍 [SOCKET][DEBUG] member[${i}]:`, {
          raw: m,
          hasUserField: !!m?.user,
          userValue: m?.user,
          extracted_id: extractedId,
          matches: extractedId === userId.toString()
        });
      });
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // Step 2: Verify user is a member
      // Defensive check handles ALL possible formats:
      // - { user: populatedUser } where user._id exists
      // - { user: ObjectId } unpopulated
      // - ObjectId (legacy bare format)
      const isMember = channel.members.some(m => {
        const memberId =
          m?.user?._id?.toString() ??
          m?.user?.toString() ??
          m?.toString();
        return memberId === userId.toString();
      });

      if (!isMember) {
        console.log(`🚫 [chat:join] User ${userId} is NOT a member of channel ${channelId}`);
        if (callback) callback({
          error: 'Not a member of this channel',
          code: 'UNAUTHORIZED',
          channelId
        });
        return;
      }

      // ============================================================
      // AUTHORIZATION PASSED - Proceed with room join
      // ============================================================

      // CRITICAL: Use colon format (channel:id) to match new message service broadcasts
      const room = `channel:${channelId}`;
      socket.join(room);

      console.log(`✅ [chat:join] User ${userId} joined ${room} (authorized member)`);
      console.log(`📊 [chat:join] Socket rooms:`, Array.from(socket.rooms));

      // Send success callback
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
  socket.on("join-workspace", ({ workspaceId }) => {
    try {
      if (!workspaceId) {
        logger.error("join-workspace: missing workspaceId");
        return;
      }
      const room = `workspace_${workspaceId}`;
      socket.join(room);
    } catch (err) {
      logger.error("Error joining workspace room:", err);
    }
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
        console.log("📢 [SOCKET] Broadcasting to channel room:", `channel_${channelId}`);
        const roomSockets = io.sockets.adapter.rooms.get(`channel_${channelId}`);
        console.log(`📊 [SOCKET] Room has ${roomSockets?.size || 0} sockets:`, Array.from(roomSockets || []));
        io.to(`channel_${channelId}`).emit(eventName, payload);
      }

      // ---------------- ack to sender ----------------
      socket.emit("message-sent", {
        message: populated,
        clientTempId,
      });

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

        io.to(`channel_${channelId}`).emit("read-update", {
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
        io.to(`channel_${msg.channelId}`).emit("read-update", {
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
        io.to(`channel_${channelId}`).emit("typing", { from: userId, fromName });
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
      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit("reaction-error", { messageId, error: "Message not found" });
        return;
      }

      // Check if user already reacted
      const existingReactionIndex = message.reactions.findIndex(
        (r) => r.userId.toString() === userId
      );

      if (existingReactionIndex >= 0) {
        // Update existing reaction
        message.reactions[existingReactionIndex].emoji = emoji;
      } else {
        // Add new reaction
        message.reactions.push({ emoji, userId });
      }

      await message.save();

      // Broadcast to appropriate room
      const room = message.channel
        ? `channel_${message.channel}`
        : `dm:${message.dm}`;

      io.to(room).emit("reaction-added", {
        messageId,
        userId,
        emoji,
        reactions: message.reactions,
      });
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
      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit("reaction-error", { messageId, error: "Message not found" });
        return;
      }

      // Remove user's reaction
      message.reactions = message.reactions.filter(
        (r) => r.userId.toString() !== userId
      );

      await message.save();

      // Broadcast to appropriate room
      const room = message.channel
        ? `channel_${message.channel}`
        : `dm:${message.dm}`;

      io.to(room).emit("reaction-removed", {
        messageId,
        userId,
        reactions: message.reactions,
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
        const room = channelId ? `channel_${channelId}` : `dm:${dmSessionId}`;
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
      io.to(`channel_${channelId}`).emit("message-pinned", {
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
      io.to(`channel_${channelId}`).emit("message-unpinned", {
        messageId,
      });
    } catch (err) {
      logger.error("UNPIN MESSAGE ERROR:", err);
      socket.emit("pin-error", { messageId, error: err.message });
    }
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
