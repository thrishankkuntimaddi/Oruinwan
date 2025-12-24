// server/socket/index.js

const Message = require("../models/Message");
const Channel = require("../models/Channel");
const DMSession = require("../models/DMSession");
const Workspace = require("../models/Workspace");
const User = require("../models/User");

module.exports = function registerChatHandlers(io, socket) {
  const userId = socket.user.id; // extracted from JWT

  /* ----------------------------------------------------
     JOIN DM SESSION ROOM
  ---------------------------------------------------- */
  socket.on("join-dm", ({ dmSessionId }) => {
    const room = `dm_${dmSessionId}`;
    socket.join(room);
    console.log(`User ${userId} joined DM room: ${room}`);
  });

  /* ----------------------------------------------------
     JOIN CHANNEL ROOM
  ---------------------------------------------------- */
  socket.on("join-channel", ({ channelId }) => {
    const room = `channel_${channelId}`;
    socket.join(room);
    console.log(`User ${userId} joined channel room: ${room}`);
  });

  /* ----------------------------------------------------
     JOIN WORKSPACE ROOM (For real-time updates like invites)
  ---------------------------------------------------- */
  socket.on("join-workspace", ({ workspaceId }) => {
    const room = `workspace_${workspaceId}`;
    socket.join(room);
    console.log(`User ${userId} joined workspace room: ${room}`);
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

      if (!dmSessionId && !channelId && !receiverId) {
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

      // Handle new DM session creation
      if (receiverId && !actualDMSessionId) {
        let dmSession = await DMSession.findOne({
          workspace: workspaceId,
          participants: { $all: [userId, receiverId], $size: 2 }
        });

        if (!dmSession) {
          const workspace = await Workspace.findById(workspaceId);
          if (!workspace) throw new Error("Workspace not found");

          dmSession = await DMSession.create({
            workspace: workspaceId,
            company: workspace.company || null,
            participants: [userId, receiverId],
            lastMessageAt: new Date()
          });
        }
        actualDMSessionId = dmSession._id;
        // Join the new room
        socket.join(`dm_${actualDMSessionId}`);
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
      console.log(`💾 Saving message for ${actualDMSessionId ? 'DM' : 'Channel'}:`, {
        workspace: workspaceId,
        channel: channelId,
        dm: actualDMSessionId,
        company: companyId
      });

      const saved = await Message.create(doc);

      const populated = await Message.findById(saved._id)
        .populate("sender", "username profilePicture");

      // ---------------- broadcast ----------------
      if (actualDMSessionId) {
        io.to(`dm_${actualDMSessionId}`).emit("new-message", {
          message: populated,
          clientTempId,
        });
      } else if (channelId) {
        console.log(`📢 Broadcasting to channel room: channel_${channelId}`);
        io.to(`channel_${channelId}`).emit("new-message", {
          message: populated,
          clientTempId,
        });
      }

      // ---------------- ack to sender ----------------
      socket.emit("message-sent", {
        message: populated,
        clientTempId,
      });

    } catch (err) {
      console.error("❌ SOCKET SEND ERROR:", err);
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
      console.log(`📖 mark-chat-read: type=${type}, id=${id}, readerId=${readerId}`);

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

        console.log(`✅ DM mark-read result: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

        io.to(`dm_${dmSessionId}`).emit("read-update", {
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

        console.log(`✅ Channel mark-read result: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

        io.to(`channel_${channelId}`).emit("read-update", {
          readerId,
          channelId: channelId,
        });
      }

    } catch (err) {
      console.error("MARK READ ERROR:", err);
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
        io.to(`dm_${msg.dm.toString()}`).emit("read-update", { // Use dm session ID
          readerId,
          messageIds: [messageId],
        });
      }

    } catch (err) {
      console.error("message-read ERROR:", err);
    }
  });

  /* ----------------------------------------------------
     TYPING
  ---------------------------------------------------- */
  socket.on("typing", ({ dmSessionId, channelId }) => {
    if (dmSessionId) {
      io.to(`dm_${dmSessionId}`).emit("typing", { from: userId });
    } else if (channelId) {
      io.to(`channel_${channelId}`).emit("typing", { from: userId });
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
        : `dm_${message.dm}`;

      io.to(room).emit("reaction-added", {
        messageId,
        userId,
        emoji,
        reactions: message.reactions,
      });
    } catch (err) {
      console.error("ADD REACTION ERROR:", err);
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
        : `dm_${message.dm}`;

      io.to(room).emit("reaction-removed", {
        messageId,
        userId,
        reactions: message.reactions,
      });
    } catch (err) {
      console.error("REMOVE REACTION ERROR:", err);
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
        // Get the current user's username (the person deleting the message)
        console.log("🔍 Fetching user for deletion, userId:", userId);
        const currentUser = await User.findById(userId);
        console.log("👤 Found user:", currentUser);
        const deleterName = currentUser ? currentUser.username : "Unknown";
        console.log("📝 Deleter name:", deleterName);

        message.isDeletedUniversally = true;
        message.deletedBy = userId;
        message.deletedAt = new Date();
        await message.save();

        // Broadcast to all participants
        const room = channelId ? `channel_${channelId}` : `dm_${dmSessionId}`;
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
      console.error("DELETE MESSAGE ERROR:", err);
      socket.emit("delete-error", { messageId, error: err.message });
    }
  });

  /* ----------------------------------------------------
     PIN MESSAGE (Admin only)
  ---------------------------------------------------- */
  socket.on("pin-message", async ({ messageId, channelId }) => {
    try {
      // Check admin permission
      const channel = await Channel.findById(channelId).populate("workspace");
      if (!channel) {
        socket.emit("pin-error", { messageId, error: "Channel not found" });
        return;
      }

      const workspace = await Workspace.findById(channel.workspace);
      const member = workspace.members.find((m) => m.user.toString() === userId);
      const isAdmin = member && (member.role === "admin" || member.role === "owner");

      if (!isAdmin) {
        socket.emit("pin-error", {
          messageId,
          error: "Only admins can pin messages",
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
      );

      // Broadcast to channel
      io.to(`channel_${channelId}`).emit("message-pinned", {
        messageId,
        pinnedBy: userId,
        message,
      });
    } catch (err) {
      console.error("PIN MESSAGE ERROR:", err);
      socket.emit("pin-error", { messageId, error: err.message });
    }
  });

  /* ----------------------------------------------------
     UNPIN MESSAGE (Admin only)
  ---------------------------------------------------- */
  socket.on("unpin-message", async ({ messageId, channelId }) => {
    try {
      // Check admin permission
      const channel = await Channel.findById(channelId).populate("workspace");
      if (!channel) {
        socket.emit("pin-error", { messageId, error: "Channel not found" });
        return;
      }

      const workspace = await Workspace.findById(channel.workspace);
      const member = workspace.members.find((m) => m.user.toString() === userId);
      const isAdmin = member && (member.role === "admin" || member.role === "owner");

      if (!isAdmin) {
        socket.emit("pin-error", {
          messageId,
          error: "Only admins can unpin messages",
        });
        return;
      }

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
      console.error("UNPIN MESSAGE ERROR:", err);
      socket.emit("pin-error", { messageId, error: err.message });
    }
  });

  /* ----------------------------------------------------
     DISCONNECT
  ---------------------------------------------------- */
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${userId}`);
  });
};
