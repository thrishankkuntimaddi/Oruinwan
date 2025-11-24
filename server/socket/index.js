// server/socket/index.js

const Message = require("../models/Message");
const Channel = require("../models/Channel");

module.exports = function registerChatHandlers(io, socket) {
  const userId = socket.user.id; // extracted from JWT

  /* ----------------------------------------------------
     JOIN DIRECT MESSAGE ROOM
  ---------------------------------------------------- */
  socket.on("join-dm", ({ otherUserId }) => {
    const room = getDMRoom(userId, otherUserId);
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
     SEND MESSAGE (DM or Channel) + ACK
  ---------------------------------------------------- */
  socket.on("send-message", async (data) => {
    try {
      const {
        receiverId,
        channelId,
        text = "",
        attachments = [],
        replyTo = null,
        clientTempId
      } = data;

      if (!receiverId && !channelId) {
        socket.emit("send-error", {
          clientTempId,
          message: "receiverId or channelId required",
        });
        return;
      }

      const doc = {
        senderId: userId,
        text,
        attachments,
        replyTo: replyTo || null,
      };

      if (receiverId) doc.receiverId = receiverId;
      if (channelId) doc.channelId = channelId;

      // Save message
      const saved = await Message.create(doc);

      const populated = await Message.findById(saved._id)
        .populate("senderId", "username profilePicture");

      // ---------------- broadcast ----------------
      if (receiverId) {
        io.to(getDMRoom(userId, receiverId)).emit("new-message", {
          message: populated,
          clientTempId,
        });
      } else {
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
      console.error("SOCKET SEND MESSAGE ERROR:", err);
      socket.emit("send-error", {
        clientTempId: data.clientTempId,
        message: "Failed to send message",
      });
    }
  });

  /* ----------------------------------------------------
     MARK CHAT READ (BULK)
  ---------------------------------------------------- */
  socket.on("mark-chat-read", async ({ type, id }) => {
    try {
      const readerId = userId;

      if (type === "dm") {
        const otherUserId = id;

        await Message.updateMany(
          {
            senderId: otherUserId,
            receiverId: readerId,
            readBy: { $ne: readerId }
          },
          { $addToSet: { readBy: readerId } }
        );

        const updatedIds = await Message.find({
          senderId: otherUserId,
          receiverId: readerId,
          readBy: readerId
        }).select("_id");

        io.to(getDMRoom(readerId, otherUserId)).emit("read-update", {
          readerId,
          messageIds: updatedIds.map(m => m._id.toString()),
        });

      } else if (type === "channel") {
        const channelId = id;

        const channel = await Channel.findById(channelId).select("members");
        if (!channel) return;

        if (!channel.members.map(String).includes(String(readerId))) return;

        await Message.updateMany(
          {
            channelId,
            senderId: { $ne: readerId },
            readBy: { $ne: readerId }
          },
          { $addToSet: { readBy: readerId } }
        );

        const updatedIds = await Message.find({
          channelId,
          readBy: readerId
        }).select("_id");

        io.to(`channel_${channelId}`).emit("read-update", {
          readerId,
          messageIds: updatedIds.map(m => m._id.toString()),
        });
      }

    } catch (err) {
      console.error("mark-chat-read ERROR:", err);
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
        .select("channelId receiverId senderId");

      if (!msg) return;

      if (msg.channelId) {
        io.to(`channel_${msg.channelId}`).emit("read-update", {
          readerId,
          messageIds: [messageId],
        });
      } else {
        io.to(getDMRoom(readerId, msg.senderId.toString())).emit("read-update", {
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
  socket.on("typing", ({ receiverId, channelId }) => {
    if (receiverId) {
      io.to(getDMRoom(userId, receiverId)).emit("typing", { from: userId });
    } else {
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

/* ----------------------------------------------------
   Utility — Stable DM Room ID
---------------------------------------------------- */
function getDMRoom(user1, user2) {
  return user1 < user2
    ? `dm_${user1}_${user2}`
    : `dm_${user2}_${user1}`;
}
