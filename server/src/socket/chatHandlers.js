const Message = require("../modules/messages/message.model");
const Channel = require("../features/channels/channel.model");
const DMSession = require("../../models/DMSession");
const identity = require("../identity");
const logger = require("../../utils/logger");
const messagesService = require("../modules/messages/messages.service");
const { isDuplicateSend } = require("../modules/messages/clientMessageId");
const ROOMS = require("../shared/utils/rooms");
const { extractMemberId } = require("../../utils/memberHelpers");
const { checkConversationAccess, checkMessageAccess } = require("../modules/conversations/conversationAccess");
const privacyService = require("../features/auth/privacy.service");
const readReceipts = require("../modules/messages/readReceipts.service");


const activityService = require("../features/activity/activity.service");
const { ACTIVITY_TYPES, ACTIVITY_SUBTYPES } = require("../../../platform/sdk/events/activityEvents");

// ---------------------------------------------------------------------------
// Authorization helpers (server-side derivation; never trust client ids)
// ---------------------------------------------------------------------------
const sameId = (a, b) => a != null && b != null && String(a) === String(b);



function isWorkspaceMember(workspace, uid) {
  if (!workspace || !Array.isArray(workspace.members)) return false;
  return workspace.members.some(m => sameId(extractMemberId(m), uid));
}

/**
 * Load a message and verify the user can access its conversation.
 * Returns { message, room, channel, dm } or null when not found / not allowed.
 */
async function loadAuthorizedMessage(messageId, uid, select = "channel dm workspace createdAt") {
  if (!messageId || !/^[a-f\d]{24}$/i.test(String(messageId))) return null;
  const fields = [...new Set(String(select).split(/\s+/).concat(["channel", "dm", "createdAt"]))].join(" ");
  const message = await Message.findById(messageId).select(fields);
  if (!message) return null;
  const access = await checkMessageAccess(message, uid);
  if (!access.ok) return null;
  return access.type === "channel"
    ? { message, channel: access.conversation, dm: null, room: `channel:${message.channel}` }
    : { message, channel: null, dm: access.conversation, room: `dm:${message.dm}` };
}

/** Socket errors carry the same status/code the REST API would answer with. */
function socketError(err) {
  const known = err && err.status && err.status < 500;
  return { code: (known && err.code) || (known ? "FORBIDDEN" : "SERVER_ERROR"), message: known ? err.message : "Something went wrong" };
}

const { sharesReadReceipts } = readReceipts;

/** False when the user turned typing indicators off. */
async function sharesTyping(uid) {
  try {
    const privacy = await privacyService.getPrivacy(uid);
    return privacy.typingIndicators !== false;
  } catch (err) {
    logger.warn({ err: err.message }, "[PRIVACY] typing preference lookup failed");
    return true;
  }
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
      const user = await identity.users.findById(userId);
      if (user && user.companyId) {
        const companyId = user.companyId.toString();
        socket.join(`company_${companyId}`);
        socket.join(ROOMS.companyUpdates(companyId));
      }
    } catch (err) {
      logger.error("Error auto-joining company room:", err);
    }

    try {
      
      // Only conversations in workspaces this person is still an active member of.
      const workspaceIds = await identity.workspaces.memberWorkspaceIds(userId);
      const [dmSessions, channels] = await Promise.all([
        DMSession.find({ participants: userId, workspace: { $in: workspaceIds } })
          .select('_id')
          .lean(),
        Channel.find({ 'members.user': userId, workspace: { $in: workspaceIds } })
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

  
  // Rooms follow the shared conversation rule: an active workspace member who is a DM
  // participant or a channel member.
  socket.on("join-dm", async ({ dmSessionId } = {}) => {
    try {
      if (!dmSessionId) {
        socket.emit("join-error", { event: "join-dm", code: "MISSING_ID", message: "dmSessionId is required" });
        return;
      }
      const access = await checkConversationAccess({ dm: dmSessionId }, userId);
      if (!access.ok) {
        socket.emit("join-error", { event: "join-dm", code: access.status === 404 ? "NOT_FOUND" : "UNAUTHORIZED", message: access.error });
        return;
      }
      socket.join(`dm:${dmSessionId}`);
    } catch (err) {
      logger.error("Error joining DM room:", err);
      socket.emit("join-error", { event: "join-dm", code: "SERVER_ERROR", message: "Failed to join DM room" });
    }
  });

  const joinChannelRoom = async (channelId) => {
    if (!channelId) return { error: "Channel ID is required", code: "MISSING_CHANNEL_ID" };
    const access = await checkConversationAccess({ channel: channelId }, userId);
    if (!access.ok || !access.isMember) return { error: "Not a member of this channel", code: "UNAUTHORIZED", channelId };
    socket.join(`channel:${channelId}`);
    return { success: true };
  };

  socket.on("join-channel", async ({ channelId } = {}) => {
    try {
      const result = await joinChannelRoom(channelId);
      if (result.error) socket.emit("join-error", { event: "join-channel", code: result.code, message: result.error });
    } catch (err) {
      logger.error("Error joining channel room:", err);
      socket.emit("join-error", { event: "join-channel", code: "SERVER_ERROR", message: "Failed to join channel room" });
    }
  });

  socket.on("chat:join", async (channelId, callback) => {
    try {
      const result = await joinChannelRoom(channelId);
      if (callback) callback(result);
    } catch (err) {
      logger.error("Error joining channel room (chat:join):", err);
      if (callback) callback({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  });

  socket.on("join-workspace", async ({ workspaceId }) => {
    try {
      if (!workspaceId) {
        logger.error("join-workspace: missing workspaceId");
        socket.emit("join-error", { event: "join-workspace", code: "MISSING_ID", message: "workspaceId is required" });
        return;
      }

      
      const workspace = await identity.workspaces.findById(workspaceId);
      if (!workspace) {
        socket.emit("join-error", { event: "join-workspace", code: "NOT_FOUND", message: "Workspace not found" });
        return;
      }

      const isMember = workspace.members.some(m => {
        const memberId = m?.user?.toString() ?? m?.toString();
        return memberId === userId.toString() && (m?.status || 'active') === 'active';
      });

      if (!isMember) {
        logger.error(`[SECURITY] Unauthorized join-workspace attempt by user ${userId} on workspace ${workspaceId}`);
        socket.emit("join-error", { event: "join-workspace", code: "UNAUTHORIZED", message: "You are not a member of this workspace" });
        return;
      }

      const room = `workspace:${workspaceId}`;
      // Some emitters (channels, automations, tasks, socketHelpers) use the older
      // `workspace_<id>` name; join both so those events reach members too.
      socket.join([room, `workspace_${workspaceId}`]);
      logger.info(`✅ [join-workspace] User ${userId} joined ${room}`);
    } catch (err) {
      logger.error("Error joining workspace room:", err);
      socket.emit("join-error", { event: "join-workspace", code: "SERVER_ERROR", message: "Failed to join workspace room" });
    }
  });

  
  socket.on("join-company-updates", async (companyId) => {
    try {
      if (!companyId) return;

      
      const user = await identity.users.findById(userId);
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

  
  // Same rules and events as POST /v2/messages/channel and /direct (sendRules.prepareSend,
  // then createMessage). The sender also gets "message-sent" (or "send-error").
  socket.on("send-message", async (data = {}) => {
    const clientTempId = data?.clientTempId;
    try {
      const { dmSessionId, receiverId, channelId, workspaceId, ciphertext, messageIv, attachments = [], replyTo = null, parentId = null, quotedMessageId = null } = data;
      if (!ciphertext || !messageIv) {
        socket.emit("send-error", { clientTempId, code: "E2EE_REQUIRED", message: "Encrypted payload required (ciphertext + messageIv)" });
        return;
      }
      const { prepareSend } = require("../modules/messages/sendRules");
      const target = channelId ? { channelId } : dmSessionId ? { dmSessionId } : { receiverId, workspaceId };
      const prepared = await prepareSend(userId, { ...target, parentId: parentId || replyTo || null, quotedMessageId, attachments }, io);
      if (prepared.newDM) socket.join(`dm:${prepared.target.dm}`);
      const t = prepared.target;
      const saved = await messagesService.createMessage({
        type: "message",
        company: t.company,
        workspace: t.workspace,
        channel: t.channel,
        dm: t.dm,
        participants: t.participants,
        sender: userId,
        attachments: prepared.attachments,
        parentId: prepared.parent ? prepared.parent._id : null,
        parent: prepared.parent,
        quotedMessageId,
        ciphertext,
        messageIv,
        mentionText: typeof data.mentionText === "string" ? data.mentionText : "",
        clientTempId,
        clientMessageId: data.clientMessageId,
      }, io);

      socket.emit("message-sent", { message: saved, clientTempId, clientMessageId: saved?.clientMessageId, ...(isDuplicateSend(saved) ? { duplicate: true } : {}) });
      if (isDuplicateSend(saved)) return;

      activityService.emitWithIo(io, {
        type:        ACTIVITY_TYPES.MESSAGE,
        subtype:     ACTIVITY_SUBTYPES.SENT,
        actor:       userId,
        workspaceId: t.workspace || null,
        payload: { context: t.channel ? "channel" : "dm", contextId: t.channel || t.dm, preview: "" },
      }).catch(() => {});
    } catch (err) {
      if (!err?.status || err.status >= 500) logger.error("❌ [SOCKET] send-message failed:", err);
      socket.emit("send-error", { clientTempId, ...socketError(err) });
    }
  });

  
  // `receipts: false` (or preferences.privacy.readReceipts === false) still records the read
  // for the reader's own unread counts, but does not tell anyone else.
  socket.on("mark-chat-read", async ({ type, id, receipts } = {}) => {
    try {
      // Same helper as POST /api/chat/reset-unread: access check, readBy + read time, events.
      await readReceipts.markConversationRead(io, { readerId: userId, type, id, receipts });
    } catch (err) {
      logger.error("MARK READ ERROR:", err);
    }
  });

  
  socket.on("message-read", async ({ messageId, receipts } = {}) => {
    try {
      const readerId = userId;
      const ctx = await loadAuthorizedMessage(messageId, readerId);
      if (!ctx) return;

      await Message.updateOne({ _id: messageId, readBy: { $ne: readerId } }, readReceipts.readUpdate(readerId));

      // With the conversation's id, so apps that match reads by conversation (the phone) see it too.
      const where = ctx.message.channel ? { channelId: String(ctx.message.channel) } : { dmSessionId: String(ctx.message.dm) };
      if (receipts !== false && await sharesReadReceipts(readerId)) {
        io.to(ctx.room).emit("read-update", { readerId, messageIds: [messageId], ...where });
      } else {
        // Only the reader's own tabs/devices learn about it.
        io.to(`user:${readerId}`).emit("read-update", { readerId, messageIds: [messageId], ...where });
      }
    } catch (err) {
      logger.error("message-read ERROR:", err);
    }
  });

  
  socket.on("typing", async ({ dmSessionId, channelId } = {}) => {
    try {
      const room = dmSessionId ? `dm:${dmSessionId}` : channelId ? `channel:${channelId}` : null;
      // Only rooms this socket was admitted to (join handlers enforce membership).
      if (!room || !socket.rooms.has(room)) return;

      // Privacy: users who turned typing indicators off are never relayed.
      if (!(await sharesTyping(userId))) return;

      if (socket.data.username === undefined) {
        const u = await identity.users.findById(userId);
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

  
  // Reactions, deletes and pins: the same service calls (and events) as the REST API.
  socket.on("add-reaction", async ({ messageId, emoji } = {}) => {
    try {
      await messagesService.addReaction(messageId, userId, emoji, io);
      activityService.emitWithIo(io, {
        type: ACTIVITY_TYPES.REACTION, subtype: ACTIVITY_SUBTYPES.ADDED, actor: userId, payload: { messageId, emoji },
      }).catch(() => {});
    } catch (err) {
      const e = socketError(err);
      socket.emit("reaction-error", { messageId, code: e.code === "FORBIDDEN" ? "NOT_FOUND" : e.code, error: e.message });
    }
  });

  // Without an emoji, removes all of this person's reactions on the message.
  socket.on("remove-reaction", async ({ messageId, emoji = null } = {}) => {
    try {
      await messagesService.removeReaction(messageId, userId, emoji, io);
    } catch (err) {
      const e = socketError(err);
      socket.emit("reaction-error", { messageId, code: e.code === "FORBIDDEN" ? "NOT_FOUND" : e.code, error: e.message });
    }
  });

  // Delete for everyone when allowed (the sender, or a channel's moderators); otherwise, or with
  // localOnly, hide it for this person only.
  socket.on("delete-message", async ({ messageId, localOnly = false } = {}) => {
    try {
      let scope = localOnly ? "me" : "everyone";
      try {
        await messagesService.deleteMessage(messageId, userId, io, scope, socket.id);
      } catch (err) {
        if (scope !== "everyone" || err?.status !== 403 || /access/i.test(err.message)) throw err;
        scope = "me";
        await messagesService.deleteMessage(messageId, userId, io, scope, socket.id);
      }
      if (scope === "me") socket.emit("message-deleted", { messageId, isLocal: true });
    } catch (err) {
      const e = socketError(err);
      socket.emit("delete-error", { messageId, code: e.code === "FORBIDDEN" ? "NOT_FOUND" : e.code, error: e.message });
    }
  });

  for (const [event, pin] of [["pin-message", true], ["unpin-message", false]]) {
    socket.on(event, async ({ messageId } = {}) => {
      try {
        await messagesService.setPinned(messageId, userId, pin, io);
      } catch (err) {
        const e = socketError(err);
        socket.emit("pin-error", { messageId, code: e.code === "FORBIDDEN" ? "NOT_FOUND" : e.code, error: e.message });
      }
    });
  }

  
  socket.on("knowledge:join", async ({ pageId } = {}) => {
    try {
      if (!pageId) return;
      const KnowledgePage = require("../features/knowledge/KnowledgePage");
      const page = await KnowledgePage.findById(pageId).select("workspaceId").lean();
      if (!page) return;
      const ws = await identity.workspaces.findById(page.workspaceId);
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
      const ws = await identity.workspaces.findById(file.workspaceId);
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
