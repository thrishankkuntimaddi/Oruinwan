// server/socket/index.js

const Message = require("../models/Message");
const Channel = require("../models/Channel");
const DMSession = require("../models/DMSession");
const Workspace = require("../models/Workspace");

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

      if (type === "dm") {
        const dmSessionId = id;

        await Message.updateMany(
          {
            dm: dmSessionId,
            sender: { $ne: readerId },
            readBy: { $ne: readerId }
          },
          { $addToSet: { readBy: readerId } }
        );

        io.to(`dm_${dmSessionId}`).emit("read-update", {
          readerId,
          dmSessionId: dmSessionId,
        });

      } else if (type === "channel") {
        const channelId = id;
        const channel = await Channel.findById(channelId).select("members");
        if (!channel) return;

        if (!channel.members.some(m => String(m) === String(readerId))) return;

        await Message.updateMany(
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
     DISCONNECT
  ---------------------------------------------------- */
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${userId}`);
  });
};
