const Message = require("../messages/message.model.js");
const User = require("../../../models/User");
const Channel = require("../channels/channel.model.js");

exports.getChatList = async (req, res) => {
  try {
    const userId = req.user.sub;

    /* -------------------------------------------------------
       1️⃣ DIRECT MESSAGES
    -------------------------------------------------------- */
    const dmPartners = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: userId },
            { receiverId: userId }
          ]
        }
      },
      {
        $project: {
          otherUser: {
            $cond: [
              { $eq: ["$senderId", userId] },
              "$receiverId",
              "$senderId"
            ]
          },
          text: 1,
          attachments: 1,
          createdAt: 1,
          readBy: 1,
          senderId: 1
        }
      },
      {
        $group: {
          _id: "$otherUser",
          lastMessage: { $last: "$text" },
          lastMessageAt: { $last: "$createdAt" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$senderId", userId] },
                    { $not: { $in: [userId, "$readBy"] } }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const dmUsers = await User.find({
      _id: { $in: dmPartners.map(x => x._id) }
    }).select("_id username profilePicture");

    const dmList = dmPartners.map(dm => {
      const u = dmUsers.find(x => String(x._id) === String(dm._id));
      return {
        type: "dm",
        id: u._id,
        name: u.username,
        profilePicture: u.profilePicture,
        lastMessage: dm.lastMessage || "",
        lastMessageAt: dm.lastMessageAt,
        unreadCount: dm.unreadCount
      };
    });

    /* -------------------------------------------------------
       2️⃣ CHANNELS
    -------------------------------------------------------- */
    const myChannels = await Channel.find({ 'members.user': userId });

    const channelIds = myChannels.map(c => c._id);

    const channelMsgs = await Message.aggregate([
      {
        $match: {
          channelId: { $in: channelIds }
        }
      },
      {
        $group: {
          _id: "$channelId",
          lastMessage: { $last: "$text" },
          lastMessageAt: { $last: "$createdAt" },
          unreadCount: {
            $sum: {
              $cond: [
                { $not: { $in: [userId, "$readBy"] } },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const channelList = myChannels.map(ch => {
      const entry = channelMsgs.find(x => String(x._id) === String(ch._id));
      return {
        type: "channel",
        id: ch._id,
        name: ch.name,
        lastMessage: entry?.lastMessage || "",
        lastMessageAt: entry?.lastMessageAt,
        unreadCount: entry?.unreadCount || 0
      };
    });

    /* -------------------------------------------------------
       FINAL LIST (Slack style)
    -------------------------------------------------------- */
    const finalList = [...dmList, ...channelList]
      .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

    res.json({ chats: finalList });
  } catch (_err) {
    console.error("CHAT LIST ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.resetUnread = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { type, id } = req.body;

    if (!type || !id)
      return res.status(400).json({ message: "type and id required" });

    if (type === "dm") {
      await Message.updateMany(
        {
          senderId: id,
          receiverId: userId,
          'readBy.user': { $ne: userId }
        },
        { $addToSet: { readBy: userId } }
      );
    } else {
      await Message.updateMany(
        {
          channelId: id,
          'readBy.user': { $ne: userId }
        },
        { $addToSet: { readBy: userId } }
      );
    }

    res.json({ success: true });
  } catch (_err) {
    console.error("RESET UNREAD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};
