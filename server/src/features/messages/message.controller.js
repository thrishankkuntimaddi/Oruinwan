// server/controllers/messagesController.js
const Message = require("./message.model.js");
const Channel = require("../channels/channel.model.js");
const User = require("../../../models/User");
const DMSession = require("../../../models/DMSession");
const Workspace = require("../../../models/Workspace");
const Task = require("../../../models/Task");
const { handleError } = require("../../../utils/responseHelpers");
const { isMember } = require("../../../utils/memberHelpers");

// -----------------------------------------------------
// SEND DIRECT MESSAGE (user → user)
// -----------------------------------------------------
exports.sendDirectMessage = async (req, res) => {
  try {
    const senderId = req.user.sub;
    const { receiverId, workspaceId, text, attachments, replyTo } = req.body;

    if (!receiverId)
      return res.status(400).json({ message: "receiverId required" });
    if (!workspaceId)
      return res.status(400).json({ message: "workspaceId required for scoped DMs" });

    const receiver = await User.findById(receiverId);
    if (!receiver)
      return res.status(404).json({ message: "Receiver not found" });

    // Find or create DMSession for this workspace
    let dmSession = await DMSession.findOne({
      workspace: workspaceId,
      participants: { $all: [senderId, receiverId], $size: 2 }
    });

    if (!dmSession) {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      dmSession = await DMSession.create({
        workspace: workspaceId,
        company: workspace.company || null,
        participants: [senderId, receiverId],
        lastMessageAt: new Date()
      });
    } else {
      dmSession.lastMessageAt = new Date();
      await dmSession.save();
    }

    const message = await Message.create({
      company: dmSession.company,
      workspace: workspaceId,
      dm: dmSession._id,
      sender: senderId,
      text: text || "",
      attachments: attachments || [],
      threadParent: replyTo || null,
    });

    // Process AI Commands
    if (text && text.includes("@chttrixAI")) {
      processAICommand(message, req.user, "dm", req);
    }

    return res.status(201).json({ message });
  } catch (err) {
    return handleError(res, err, "SEND DM ERROR");
  }
};

// -----------------------------------------------------
// SEND CHANNEL MESSAGE
// -----------------------------------------------------
exports.sendChannelMessage = async (req, res) => {
  try {
    const senderId = req.user.sub;
    const { channelId, text, attachments, replyTo } = req.body;

    if (!channelId)
      return res.status(400).json({ message: "channelId required" });

    const channel = await Channel.findById(channelId);
    if (!channel)
      return res.status(404).json({ message: "Channel not found" });

    // Ensure user is a member of the channel
    if (!channel.isMember(senderId))
      return res.status(403).json({ message: "Not a channel member" });

    const message = await Message.create({
      company: channel.company,
      workspace: channel.workspace,
      channel: channelId,
      sender: senderId,
      text: text || "",
      attachments: attachments || [],
      threadParent: replyTo || null,
    });

    // Process AI Commands
    if (text && text.includes("@chttrixAI")) {
      processAICommand(message, req.user, "channel", req);
    }

    return res.status(201).json({ message });
  } catch (err) {
    return handleError(res, err, "SEND CHANNEL ERROR");
  }
};

// -----------------------------------------------------
// GET DIRECT MESSAGES (conversation between 2 users)
// WITH PAGINATION
// -----------------------------------------------------
exports.getDMs = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { workspaceId, dmSessionId } = req.params;

    // Pagination parameters
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before; // Message ID to load messages before

    // Validate DMSession
    const dmSession = await DMSession.findById(dmSessionId);
    if (!dmSession) return res.status(404).json({ message: "DM Session not found" });

    // Verify participant
    if (!dmSession.participants.some(p => String(p) === String(userId))) {
      return res.status(403).json({ message: "Not a participant in this DM" });
    }

    // Build query
    let query = { dm: dmSessionId };

    // If 'before' is specified, only get messages before that message's timestamp
    if (before) {
      const beforeMsg = await Message.findById(before);
      if (beforeMsg) {
        query.createdAt = { $lt: beforeMsg.createdAt };
      }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 }) // Get newest first
      .limit(limit)
      .populate("sender", "username email profilePicture")
      .populate("readBy", "username") // Populate read receipts
      .populate({
        path: "threadParent",
        populate: { path: "sender", select: "username profilePicture" }
      });

    // Reverse to get chronological order (oldest to newest)
    messages.reverse();

    // Check if there are more messages
    const totalCount = await Message.countDocuments({ dm: dmSessionId });
    const hasMore = messages.length === limit;

    return res.json({
      messages,
      hasMore,
      total: totalCount
    });
  } catch (err) {
    return handleError(res, err, "GET DMs ERROR");
  }
};

// -----------------------------------------------------
// GET CHANNEL MESSAGES WITH PAGINATION
// -----------------------------------------------------
exports.getChannelMessages = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.channelId;

    // Pagination parameters
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before; // Message ID to load messages before

    const channel = await Channel.findById(channelId);
    if (!channel)
      return res.status(404).json({ message: "Channel not found" });

    // Ensure user is a member of the channel
    const isUserMember = isMember(channel.members, userId);

    if (!isUserMember)
      return res.status(403).json({ message: "Not a channel member" });

    // Get user's join date to filter messages (privacy: only show messages after join)
    const userJoinedAt = channel.getUserJoinDate(userId);

    // Build query - ONLY show messages after user joined the channel
    let query = {
      channel: channelId,
      threadParent: null,
      createdAt: { $gte: userJoinedAt } // ✅ Filter by join date
    };

    // If 'before' is specified for pagination, get messages before that timestamp
    if (before) {
      const beforeMsg = await Message.findById(before);
      if (beforeMsg) {
        // Combine both constraints: after join AND before pagination point
        query.createdAt = {
          $gte: userJoinedAt,
          $lt: beforeMsg.createdAt
        };
      }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 }) // Get newest first
      .limit(limit)
      .populate("sender", "username email profilePicture")
      .populate("readBy", "username") // Populate read receipts
      .populate("pinnedBy", "username") // Populate pin attribution
      .populate({
        path: "threadParent",
        populate: { path: "sender", select: "username profilePicture" }
      });

    // Reverse to get chronological order (oldest to newest)
    messages.reverse();

    // Count only accessible messages (after user joined)
    const totalCount = await Message.countDocuments({
      channel: channelId,
      createdAt: { $gte: userJoinedAt }
    });
    const hasMore = messages.length === limit;

    // Get all members with their join dates for personalized join markers
    const channelMembers = channel.members.map(m => {
      const memberId = m.user ? m.user.toString() : m.toString();
      const joinedAt = m.joinedAt || channel.createdAt;
      return {
        userId: memberId,
        joinedAt: joinedAt
      };
    });

    // Populate member usernames
    const populatedMembers = await Promise.all(
      channelMembers.map(async (member) => {
        const user = await require("../../../models/User").findById(member.userId).select("username");
        return {
          ...member,
          username: user?.username || "Unknown"
        };
      })
    );

    // Populate reply counts and avatars
    const messagesWithCounts = await Promise.all(messages.map(async (msg) => {
      // 1. Count replies (exclude system messages from thread count)
      const count = await Message.countDocuments({
        threadParent: msg._id,
        type: { $ne: 'system' } // Don't count system messages in threads
      });

      // 2. Get recent replier avatars (distinct)
      let replyAvatars = [];
      let lastReplyAt = null;

      if (count > 0) {
        try {
          const lastReplies = await Message.find({
            threadParent: msg._id,
            type: { $ne: 'system' } // Don't include system messages
          })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("sender", "profilePicture"); // Changed from avatarUrl to profilePicture

          if (lastReplies.length > 0) {
            lastReplyAt = lastReplies[0].createdAt;
          }

          const seen = new Set();
          for (const r of lastReplies) {
            if (r.sender && r.sender.profilePicture && !seen.has(r.sender._id.toString())) {
              seen.add(r.sender._id.toString());
              replyAvatars.push(r.sender.profilePicture); // Changed from avatarUrl to profilePicture
              // Limit to 3 avatars
              if (replyAvatars.length >= 3) break;
            }
          }
        } catch (err) {
          console.error("Error fetching reply avatars:", err);
        }
      }

      const msgObj = msg.toObject();
      msgObj.replyCount = count;
      msgObj.replyAvatars = replyAvatars;
      msgObj.lastReplyAt = lastReplyAt;
      return msgObj;
    }));

    return res.json({
      messages: messagesWithCounts,
      userJoinedAt,
      channelMembers: populatedMembers,
      hasMore,
      total: totalCount
    });
  } catch (err) {
    return handleError(res, err, "GET CHANNEL ERROR");
  }
};

/**
 * Get all DM sessions for a user in a specific workspace
 * GET /api/messages/workspace/:workspaceId/dms
 */
exports.getWorkspaceDMList = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { workspaceId } = req.params;

    const sessions = await DMSession.find({
      workspace: workspaceId,
      participants: userId
    }).populate("participants", "username email profilePicture isOnline userStatus");

    // Return sessions with recent message preview and unread counts
    const sessionList = await Promise.all(sessions.map(async (s) => {
      const lastMsg = await Message.findOne({ dm: s._id })
        .sort({ createdAt: -1 })
        .select("text createdAt sender")
        .populate("sender", "username");

      // Filter out current user from participants list to get the "other user"
      const otherUser = s.participants.find(p => String(p._id) !== String(userId));

      // Compute unread count: messages in this DM session not sent by current user and not read by current user
      const unreadCount = await Message.countDocuments({
        dm: s._id,
        sender: { $ne: userId },
        'readBy.user': { $ne: userId }
      });

      return {
        id: s._id,
        otherUser: otherUser || { username: "Self" },
        otherUserId: otherUser?._id,
        lastMessage: lastMsg?.text || "No messages yet",
        lastMessageAt: lastMsg?.createdAt || s.createdAt,
        unreadCount
      };
    }));

    return res.json({ sessions: sessionList });
  } catch (err) {
    return handleError(res, err, "GET WORKSPACE DM LIST ERROR");
  }
};


/**
 * AI Command Processor
 * Parses @chttrixAI commands to create tasks
 */
async function processAICommand(message, sender, contextType, req) {
  try {
    const text = message.text;
    const io = req.io;

    // 1. Parse Assignees (@User)
    const mentionRegex = /@(\w+)/g;
    const mentions = text.match(mentionRegex) || [];
    const targetUsernames = mentions
      .filter(m => m.toLowerCase() !== "@chttrixai")
      .map(m => m.substring(1)); // remove @

    if (targetUsernames.length === 0) {
      return sendAIReply(message, "⚠️ Please mention a user to assign the task (e.g. @Muzamil).", io);
    }

    // Resolve Users
    const assigneeIds = [];
    const assigneeNames = [];
    for (const username of targetUsernames) {
      const user = await User.findOne({ username: new RegExp(`^${username}$`, "i") });
      // Verify user is in workspace helper if needed, but for now strict name match
      if (user) {
        assigneeIds.push(user._id);
        assigneeNames.push(user.username);
      }
    }

    if (assigneeIds.length === 0) return;

    // 2. Parse Due Date (Simple heuristic)
    let dueDate = null;
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const lowerText = text.toLowerCase();

    // Check for "by X day"
    for (let i = 0; i < 7; i++) {
      if (lowerText.includes(days[i])) {
        const today = new Date();
        const currentDay = today.getDay();
        let distance = i - currentDay;
        if (distance <= 0) distance += 7; // Next occurrence
        dueDate = new Date(today);
        dueDate.setDate(today.getDate() + distance);
        break;
      }
    }

    // 3. Extract Title (Remove mentions)
    let cleanText = text.replace(/@\w+/g, "").replace(/\s+/g, " ").trim();
    // Remove "by Friday" etc if complex parsing, but simply using clean text as description/title is fine
    const title = cleanText.substring(0, 50) + (cleanText.length > 50 ? "..." : "");

    // 4. Create Task(s) - Split Logic
    for (const assigneeId of assigneeIds) {
      const task = new Task({
        company: message.company,
        workspace: message.workspace,
        title: title || "New AI Task",
        description: text,
        createdBy: sender.sub || sender._id,
        assignedTo: [assigneeId], // Independent task
        visibility: contextType === 'dm' ? 'private' : 'channel',
        channel: contextType === 'channel' ? message.channel : null,
        status: 'todo',
        priority: 'medium',
        dueDate: dueDate,
        linkedMessage: message._id
      });
      await task.save();
    }

    // 5. Reply
    const assigneeStr = assigneeNames.map(n => `@${n}`).join(", ");
    sendAIReply(message, `🤖 **Task Created:** ${title}\n👤 Assigned to: ${assigneeStr}\n📅 Due: ${dueDate ? dueDate.toDateString() : "No Date"}`, io);

  } catch (err) {
    console.error("AI PROCESS ERROR:", err);
  }
}

async function sendAIReply(originalMsg, text, io) {
  try {
    const reply = await Message.create({
      company: originalMsg.company,
      workspace: originalMsg.workspace,
      channel: originalMsg.channel,
      dm: originalMsg.dm,
      sender: originalMsg.sender, // Reply as the user (self-echo) or system? 
      // Better to reply as System but we lack ID. 
      // Using sender is safe fallback, but adding START "🤖" makes it clear.
      text: text,
      threadParent: originalMsg._id // Thread it!
    });

    await reply.populate("sender", "username profilePicture");

    // Emit
    const room = originalMsg.channel ? `channel_${originalMsg.channel}` : `dm_${originalMsg.dm}`;
    if (io) io.to(room).emit("new-message", reply);

  } catch (e) {
    console.error("Bot Reply Error", e);
  }
}
