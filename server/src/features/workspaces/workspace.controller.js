const logger = require('../../../utils/logger');
const identity = require("../../identity");
const wsQueries = require("../../identity/queries/workspaces");
const { hydrate, USER_MIN } = require("../../identity/hydrate");
const Channel = require("../channels/channel.model.js");
const Message = require("../../modules/messages/message.model.js");
const DMSession = require("../../../models/DMSession");
const Tasks = require("../tasks/tasks.query");
const Note = require("../../../models/Note");
const Update = require("../../../models/Update");
const Favorite = require("../../../models/Favorite");
const { invites: inviteStore } = require("../../identity/queries/auth");
const {} = require("../../../utils/invite");
const sendEmail = require("../../../utils/sendEmail");
const { handleError} = require("../../../utils/responseHelpers");
const { normalizeMemberFormat } = require("../../../utils/memberHelpers");
const conversationKeysService = require("../../modules/conversations/conversationKeys.service");
const messagesService = require("../../modules/messages/messages.service");

const { isValidId, userRoom } = require("../../shared/utils/workspaceAccess");

// Workspace settings a member may see and an admin may change (booleans / numbers only).
const BOOLEAN_SETTINGS = ['isPrivate', 'allowMemberInvite', 'allowMemberChannelCreation', 'requireAdminApproval', 'isDiscoverable'];
const NUMBER_SETTINGS = ['autoArchiveInactiveDays'];
const RULES_MAX = 5000;

function pickSafeSettings(settings) {
  const src = settings || {};
  const out = {};
  for (const k of [...BOOLEAN_SETTINGS, ...NUMBER_SETTINGS]) {
    if (src[k] !== undefined) out[k] = src[k];
  }
  return out;
}

function countActiveMembers(members) {
  return (members || []).filter(m => (m.status || 'active') === 'active').length;
}

// Sockets join `workspace:<id>` (chatHandlers join-workspace); some older
// listeners used `workspace_<id>`, so emit to both (socket.io de-duplicates).
function workspaceRooms(id) {
  return [`workspace:${id}`, `workspace_${id}`];
}

/** A repository record without its helper methods, for JSON responses. */
function stripMethods(ws) {
  const out = { ...ws };
  delete out.isMember;
  delete out.isAdminOrOwner;
  return out;
}

exports._internal = { pickSafeSettings, countActiveMembers };

exports.createWorkspace = async (req, res) => {
  try {
    const {
      companyId,
      name,
      description,
      icon,
      color,
      rules,
      templateId
    } = req.body;
    const userId = req.user?.sub;

    if (!name) return res.status(400).json({ message: "Workspace name is required" });

    const user = await identity.users.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const resolvedCompanyId = user.companyId ? String(user.companyId) : null;

    
    const isCompanyWorkspace = !!resolvedCompanyId;
    const isPersonalWorkspace = !isCompanyWorkspace;

    
    if (isCompanyWorkspace) {
      const role = user.companyRole;
      // The company's permission matrix decides when it has been configured for this role.
      const { companyPermission } = require('../../shared/companyPermissions');
      const matrix = await companyPermission(userId, 'createWorkspace');
      if (matrix === false || (matrix === null && (!role || (role !== "admin" && role !== "owner" && role !== "manager")))) {
        return res.status(403).json({ message: "Only company admins/managers may create workspaces" });
      }
    }

    
    if (isPersonalWorkspace) {
      const ownedWorkspacesCount = await wsQueries.countCreatedBy(userId);
      if (ownedWorkspacesCount >= 3) {
        return res.status(403).json({
          message: "Free plan limit reached. You can only create up to 3 workspaces.",
          isLimitReached: true
        });
      }
    }

    
    const existingWorkspace = await wsQueries.findByNameForCreator(name.trim(), userId);

    if (existingWorkspace) {
      return res.status(400).json({
        message: `Workspace name already exists in your account`
      });
    }

    
    // Workspace row and owner membership in one PostgreSQL transaction.
    let workspace = await identity.workspaces.create({
      company: resolvedCompanyId || null,
      type: isPersonalWorkspace ? "personal" : "company",
      name: name.trim(),
      description: description || "",
      icon: icon || "🚀", 
      color: color || "#2563eb", 
      rules: rules || "", 
      createdBy: userId,
      members: [{ user: userId, role: "owner" }],
      settings: {
        isPrivate: true, 
        allowMemberInvite: true
      }
    });

    logger.info("🏗 [PHASE 2] Workspace created:", workspace._id.toString());

    
    const creationDate = new Date();
    const generalChannel = await Channel.create({
      workspace: workspace._id,
      company: resolvedCompanyId || null,
      name: "general",
      description: "General discussion",
      isPrivate: false,
      isDefault: true,
      createdBy: userId,
      members: [{ user: userId, joinedAt: creationDate }],
      systemEvents: [{
        type: 'channel_created',
        userId: userId,
        timestamp: creationDate
      }]
    });

    const announcementsChannel = await Channel.create({
      workspace: workspace._id,
      company: resolvedCompanyId || null,
      name: "announcements",
      description: "Announcements and updates",
      isPrivate: false,
      isDefault: true,
      createdBy: userId,
      members: [{ user: userId, joinedAt: creationDate }],
      systemEvents: [{
        type: 'channel_created',
        userId: userId,
        timestamp: creationDate
      }]
    });

    logger.info("📢 [PHASE 2] Default channels created: general, announcements");

    
    
    logger.info(`🔐 [PHASE 5] Generating conversation keys for default channels...`);

    const channelsToBootstrap = [
      { channel: generalChannel, name: 'general' },
      { channel: announcementsChannel, name: 'announcements' }
    ];

    for (const { channel, name } of channelsToBootstrap) {
      try {
        await conversationKeysService.bootstrapConversationKey({
          conversationId: channel._id.toString(),
          conversationType: 'channel',
          workspaceId: workspace._id.toString(),
          members: [userId]
        });
        logger.info(`✅ [PHASE 5] Bootstrapped conversation key for #${name}`);
      } catch (keyError) {
        
        
        
        logger.error(`⚠️ [PHASE 5] Failed to bootstrap key for #${name} (non-fatal):`, keyError.message);
        logger.warn(`   Workspace will be created without E2EE keys for #${name}.`);
        logger.warn(`   Keys will be distributed via repair when E2EE is configured.`);
      }
    }

    
    workspace = await identity.workspaces.update(workspace._id, {
      defaultChannels: [generalChannel._id, announcementsChannel._id],
    });

    let templateError = null;
    if (templateId) {
      try {
        await require("../workspace-os/workspace-os.service").applyTemplate({
          workspace, templateId, userId, companyId: resolvedCompanyId,
        });
      } catch (err) {
        // The workspace exists either way; tell the client the template was skipped.
        logger.warn({ err, templateId }, "Workspace template could not be applied");
        templateError = err.message;
      }
    }

    // Membership already lives in workspace_members; only the personal pointer is on the user.
    if (isPersonalWorkspace && !user.personalWorkspace) {
      await identity.users.update(userId, { personalWorkspace: workspace._id });
    }

    logger.info("👤 [PHASE 2] User added as member:", userId);

    return res.status(201).json({
      message: "Workspace created successfully",
      workspace: {
        id: workspace._id,
        name: workspace.name,
        type: workspace.type,
        icon: workspace.icon,
        color: workspace.color || "#2563eb",
        defaultChannels: workspace.defaultChannels
      },
      ...(templateError ? { templateError } : {})
    });
  } catch (err) {
    return handleError(res, err, "CREATE WORKSPACE ERROR");
  }
};

exports.listMyWorkspaces = async (req, res) => {
  try {
    const userId = req.user?.sub;

    const user = await identity.users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Same shape the old user.workspaces array produced, from workspace_members.
    const memberships = await wsQueries.membershipsForUser(userId);
    const creators = await identity.users.findManyByIds(memberships.map(m => m.workspace.createdBy));

    const workspacesWithOwner = memberships.map(({ workspace, role, status }) => {
      const creator = creators.get(String(workspace.createdBy));
      return {
        id: workspace._id,
        name: workspace.name,
        description: workspace.description,
        icon: workspace.icon,
        color: workspace.color || "#2563eb",
        rules: workspace.rules || "",
        settings: pickSafeSettings(workspace.settings),
        type: workspace.type,
        role,
        membershipStatus: status || 'active',
        memberCount: countActiveMembers(workspace.members),
        isPersonal: workspace.type === 'personal',
        ownerName: creator?.username || 'Unknown',
        isOwner: String(workspace.createdBy) === String(userId)
      };
    });

    return res.json({ workspaces: workspacesWithOwner });
  } catch (err) {
    return handleError(res, err, "LIST MY WORKSPACES ERROR");
  }
};

exports.listWorkspaces = async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const userId = req.user?.sub;

    const user = await identity.users.findById(userId);
    if (!user || String(user.companyId) !== String(companyId)) return res.status(403).json({ message: "Not a company member" });

    const workspaces = (await wsQueries.listByCompany(companyId)).map(stripMethods);
    return res.json({ workspaces });
  } catch (err) {
    return handleError(res, err, "LIST WORKSPACES ERROR");
  }
};

// getWorkspaceMembers is defined once, below (an older duplicate here was always overridden).
async function deactivateWorkspaceIntegrations(workspaceId) {
  const ApiKey = require("../developer/apiKey.model");
  const Bot = require("../developer/bot.model");
  const Webhook = require("../integrations/webhook.model");
  await Promise.all([
    ApiKey.updateMany({ workspaceId }, { $set: { isActive: false } }),
    Bot.updateMany({ workspaceId }, { $set: { isActive: false } }),
    Webhook.updateMany({ workspaceId }, { $set: { isActive: false, active: false } }),
  ]);
}
exports._internal.deactivateWorkspaceIntegrations = deactivateWorkspaceIntegrations;

exports.deleteWorkspace = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user?.sub;

    const workspace = await identity.workspaces.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    
    const memberData = workspace.members.find(m => String(m.user) === String(userId));
    if (!memberData || memberData.role !== "owner") {
      return res.status(403).json({ message: "Only workspace owner can delete the workspace" });
    }

    
    const _deletedChannels = await Channel.deleteMany({ workspace: workspaceId });

    
    const _deletedMessages = await Message.deleteMany({ workspace: workspaceId });

    
    const _deletedDMSessions = await DMSession.deleteMany({ workspace: workspaceId });

    
    const _deletedTasks = await Tasks.deleteMany({ workspace: workspaceId });

    
    const _deletedNotes = await Note.deleteMany({ workspace: workspaceId });

    
    const _deletedUpdates = await Update.deleteMany({ workspace: workspaceId });

    
    const _deletedFavorites = await Favorite.deleteMany({ workspace: workspaceId });

    
    const _deletedInvites = await inviteStore.deleteByWorkspace(workspaceId);

    // Memberships go with the workspace (ON DELETE CASCADE); clear personal pointers first.
    await wsQueries.clearPersonalWorkspace(workspaceId);

    
    // API keys, bots and webhooks must stop working with the workspace.
    await deactivateWorkspaceIntegrations(workspaceId);

    const io = req.app?.get("io");
    if (io) {
      io.to(workspaceRooms(workspaceId)).emit("workspace-deleted", { workspaceId });
    }

    
    await identity.workspaces.remove(workspaceId);

    return res.json({ message: "Workspace deleted successfully" });
  } catch (err) {
    return handleError(res, err, "DELETE WORKSPACE ERROR");
  }
};

exports.inviteToWorkspace = async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.id;
    const { emails, inviteType = "link", role = "member", daysValid = 7 } = req.body;
    const inviterId = req.user?.sub;

    const workspace = await identity.workspaces.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    
    const isWorkspaceMember = workspace.members.some(m => String(m.user) === String(inviterId));
    if (!isWorkspaceMember) {
      return res.status(403).json({ message: "You must be a member to invite others" });
    }

    const invites = [];
    const crypto = require("crypto");
    const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");

    if (inviteType === "email" && emails) {
      
      // The web client sends an array; older callers send a comma-separated string.
      const emailList = [...new Set(
        (Array.isArray(emails) ? emails : String(emails).split(','))
          .map(e => String(e).trim().toLowerCase())
          .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      )];
      if (emailList.length === 0) {
        return res.status(400).json({ message: "Provide at least one valid email address" });
      }

      for (const email of emailList) {
        
        const userExists = await identity.users.findByEmail(email);
        // Privacy: people who turned discovery off are not confirmed to exist.
        const revealExists = !!userExists && userExists.preferences?.privacy?.allowDiscovery !== false;

        const raw = crypto.randomBytes(32).toString("hex");
        const tokenHash = sha256(raw);
        const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);

        const _invite = await inviteStore.create({
          email,
          tokenHash,
          workspace: workspace._id,
          company: workspace.company,
          role,
          invitedBy: inviterId,
          expiresAt,
          inviteType: "email"
        });

        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join-workspace?token=${raw}`;

        
        const inviter = await identity.users.findById(req.user.sub);
        const inviterName = inviter ? inviter.username : 'A team member';

        
        try {
          const { workspaceInviteTemplate } = require('../../../utils/emailTemplates');
          // Address the invitee by their account name when they already have one.
          const inviteeName = (userExists && userExists.username) || email.split('@')[0];
          const template = workspaceInviteTemplate(inviteeName, workspace.name, inviteLink);

          await sendEmail({
            to: email,
            subject: template.subject,
            html: template.html,
            text: template.text
          });
          invites.push({ email, inviteLink, userExists: revealExists, emailSent: true });
        } catch (emailErr) {
          logger.error({ err: emailErr.message, email }, 'Workspace invite email could not be delivered');
          invites.push({ email, inviteLink, userExists: revealExists, emailSent: false, emailError: emailErr.message });
        }
      }

      const failed = invites.filter((i) => i.emailSent === false).length;
      return res.status(failed && failed === invites.length ? 502 : 200).json({
        message: failed === 0
          ? "Email invites sent successfully"
          : `${invites.length - failed} of ${invites.length} invite emails sent; ${failed} could not be delivered. Share the invite link manually or fix the email provider.`,
        invites
      });
    } else {
      
      const raw = crypto.randomBytes(32).toString("hex");
      const tokenHash = sha256(raw);
      const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);

      const _invite = await inviteStore.create({
        tokenHash,
        workspace: workspace._id,
        company: workspace.company,
        role,
        invitedBy: inviterId,
        expiresAt,
        inviteType: "link"
      });

      const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join-workspace?token=${raw}`;

      return res.json({
        message: "Invite link generated",
        inviteLink,
        expiresAt
      });
    }
  } catch (err) {
    logger.error("INVITE TO WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getInviteDetails = async (req, res) => {
  try {
    const { token } = req.params;
    const crypto = require("crypto");
    const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");

    const tokenHash = sha256(token);
    const invite = await inviteStore.findByTokenHash(tokenHash);
    if (invite) await hydrate(invite, { invitedBy: USER_MIN });

    if (!invite) {
      return res.status(404).json({ message: "Invalid invitation link" });
    }

    if (invite.used) {
      return res.status(400).json({ message: "This invitation link has already been used" });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ message: "This invitation link has expired" });
    }

    const workspace = await identity.workspaces.findById(invite.workspace);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });
    const memberCount = countActiveMembers(workspace.members);

    return res.json({
      workspaceName: workspace.name,
      workspaceDescription: workspace.description,
      workspaceIcon: workspace.icon,
      workspaceColor: workspace.color || "#2563eb",
      invitedBy: invite.invitedBy ? invite.invitedBy.username : 'Someone',
      memberCount,
      role: invite.role
    });
  } catch (err) {
    return handleError(res, err, "GET INVITE DETAILS ERROR");
  }
};

exports.joinWorkspace = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user?.sub;
    const crypto = require("crypto");
    const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");

    if (!token) {

      return res.status(400).json({ message: "Invite token is required" });
    }

    const user = await identity.users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const tokenHash = sha256(token);
    const invite = await inviteStore.findByTokenHash(tokenHash);

    if (!invite) {
      return res.status(404).json({ message: "Invalid invitation link" });
    }

    if (invite.used) {
      return res.status(400).json({ message: "This invitation link has already been used" });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ message: "This invitation link has expired" });
    }

    
    const workspace = await identity.workspaces.findById(invite.workspace);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    
    const alreadyMember = workspace.members.some(m => String(m.user) === String(userId) && m.status !== 'removed');
    if (alreadyMember) {
      return res.status(400).json({ message: "You are already a member of this workspace" });
    }

    
    await identity.workspaces.addMember(workspace._id, userId, { role: invite.role || 'member' });

    require('../../shared/events/bus').publish('member.joined', { userId: String(userId), role: invite.role, source: 'invite' },
      { workspaceId: workspace._id, companyId: workspace.company, actorId: userId }).catch(() => {});

    {
      const notificationService = require('../../modules/notifications/notificationService');
      notificationService.memberJoined(req.app?.get('io'), {
        newUserId: String(userId),
        newUsername: user.username || user.email,
        workspaceId: workspace._id,
        recipientIds: workspace.members.map(m => String(m.user)).filter(id => id !== String(userId)),
      }).catch(() => {});
    }

    
    const defaultChannels = await Channel.find({
      workspace: workspace._id,
      isDefault: true
    });

    for (const channel of defaultChannels) {
      
      const isAlreadyMember = channel.members.some(m => {
        const memberId = m.user ? m.user.toString() : m.toString();
        return memberId === userId.toString();
      });

      if (!isAlreadyMember) {
        
        
        channel.members = normalizeMemberFormat(channel.members, channel.createdAt);

        
        channel.members.push({
          user: userId,
          joinedAt: new Date()
        });

        await channel.save();
      }
    }

    
    
    
    logger.info(`🔐 [PHASE 4] Distributing conversation keys to user ${userId}...`);
    for (const channel of defaultChannels) {
      try {
        
        const hasKeys = await conversationKeysService.hasConversationKeys(channel._id, 'channel');

        if (hasKeys) {
          
          const distributed = await conversationKeysService.distributeKeyToNewMember(
            channel._id,
            'channel',
            userId
          );

          if (distributed) {
            logger.info(`✅ [PHASE 4] Distributed conversation key for #${channel.name} to user ${userId}`);
          } else {
            logger.warn(`⚠️ [PHASE 4] Could not distribute key for #${channel.name} to user ${userId}`);
          }
        } else {
          logger.info(`ℹ️ [PHASE 4] No conversation key exists for #${channel.name} yet (will be created on first message)`);
        }
      } catch (keyError) {
        
        logger.error(`❌ [PHASE 4] Key distribution failed for #${channel.name}:`, keyError.message);
      }
    }

    
    await inviteStore.update(invite._id, { used: true, usedBy: userId, usedAt: new Date(), status: 'accepted' });

    
    const io = req.app.get("io");
    if (io) {
      io.to(workspaceRooms(workspace._id.toString())).emit("workspace-joined", {
        workspaceId: workspace._id,
        userId: userId,
        username: user.username,
        role: invite.role
      });
    }

    return res.json({
      message: "Successfully joined workspace",
      workspace: {
        id: workspace._id,
        name: workspace.name,
        icon: workspace.icon,
        color: workspace.color || "#2563eb"
      }
    });
  } catch (err) {
    logger.error("JOIN WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getWorkspaceMembers = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?.sub;
    if (!isValidId(workspaceId)) return res.status(400).json({ message: "Invalid workspaceId" });

    const workspace = await identity.workspaces.findById(workspaceId);
    if (workspace) {
      await hydrate(workspace, { 'members.user': { type: 'user', fields: ['username', 'email', 'phone', 'profilePicture', 'isOnline', 'userStatus', 'profile', 'lastLoginAt'] } });
    }

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    const isMember = workspace.members.some(m => m.user && String(m.user._id) === String(userId) && (m.status || 'active') === 'active');
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    // Everyone still attached to the workspace (the caller included). Presence
    // lives in isOnline/status; the membership state in membershipStatus.
    const members = workspace.members
      .filter(m => m.user && m.status !== 'removed')
      .map(m => ({
        _id: m.user._id,
        username: m.user.username,
        email: m.user.email,
        phone: m.user.phone,
        profilePicture: m.user.profilePicture,
        userStatus: m.user.userStatus,
        profile: m.user.profile,
        isOnline: !!m.user.isOnline,
        status: m.user.isOnline ? 'online' : 'offline',
        lastSeen: m.user.lastLoginAt,
        role: m.role,
        membershipStatus: m.status || 'active',
        joinedAt: m.joinedAt,
        isCurrentUser: String(m.user._id) === String(userId)
      }));

    return res.json({ members });
  } catch (err) {
    logger.error("GET WORKSPACE MEMBERS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.leaveWorkspace = async (req, res) => {
  try {
    const workspaceId = req.params.id || req.params.workspaceId;
    const userId = req.user?.sub;
    if (!isValidId(workspaceId)) return res.status(400).json({ message: "Invalid workspaceId" });

    const workspace = await identity.workspaces.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    const me = workspace.members.find(m => String(m.user) === String(userId) && (m.status || 'active') === 'active');
    if (!me) return res.status(403).json({ message: "You are not a member of this workspace" });
    if (me.role === 'owner') {
      return res.status(400).json({ message: "Transfer ownership before leaving" });
    }

    await identity.workspaces.removeMember(workspaceId, userId, { hard: true });
    await Channel.updateMany(
      { workspace: workspaceId },
      { $pull: { members: { user: userId }, admins: userId } }
    );
    await DMSession.updateMany(
      { workspace: workspaceId, participants: userId },
      { $set: { status: "closed" } }
    );

    const io = req.app?.get("io");
    if (io) {
      io.to(workspaceRooms(workspaceId)).emit("workspace:member-left", { workspaceId: String(workspaceId), userId: String(userId) });
      io.to(userRoom(userId)).emit("workspace:access-revoked", { workspaceId: String(workspaceId), reason: 'left' });
    }

    return res.json({ message: "You left the workspace", workspaceId: String(workspaceId) });
  } catch (err) {
    return handleError(res, err, "LEAVE WORKSPACE ERROR");
  }
};

exports.getWorkspaceChannels = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?.sub;

    
    const workspace = await identity.workspaces.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    
    const isMember = workspace.members.some(m => String(m.user) === String(userId));
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    
    const allChannels = await Channel.find({ workspace: workspaceId })
      .select('name description isPrivate isDefault isDiscoverable members createdBy createdAt workspace admins systemEvents')
      .sort({ isDefault: -1, createdAt: 1 }) 
      .lean();
    await hydrate(allChannels, { createdBy: { type: 'user', fields: ['username', 'profile'] } });

    
    const eventUserIds = new Set();
    for (const channel of allChannels) {
      if (channel.systemEvents && channel.systemEvents.length > 0) {
        for (const event of channel.systemEvents) {
          if (event.userId && !event.userName) {
            eventUserIds.add(event.userId.toString());
          }
        }
      }
    }

    
    let userMap = new Map();
    if (eventUserIds.size > 0) {
      const eventUsers = [...(await identity.users.findManyByIds(Array.from(eventUserIds))).values()];
      eventUsers.forEach(u => {
        userMap.set(u._id.toString(),
          u.username || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown'
        );
      });
    }

    
    for (const channel of allChannels) {
      if (channel.createdBy) {
        channel.creatorName = channel.createdBy.profile?.name || channel.createdBy.username || 'Unknown';
      }
      if (channel.systemEvents && channel.systemEvents.length > 0) {
        for (const event of channel.systemEvents) {
          if (event.userId && !event.userName) {
            event.userName = userMap.get(event.userId.toString()) || 'Unknown';
          }
        }
      }
    }

    
    
    
    
    
    const visibleChannels = allChannels.filter(channel => {
      
      const isMemberOfChannel = channel.members.some(m => {
        const memberId = m.user ? m.user.toString() : m.toString();
        return memberId === userId.toString();
      });

      if (!channel.isPrivate) {
        
        if (channel.isDiscoverable) {
          
          return true;
        } else {
          
          return isMemberOfChannel;
        }
      } else {
        
        return isMemberOfChannel;
      }
    });

    
    const unreadCounts = await messagesService.getChannelUnreadCounts(userId, visibleChannels);

    const channelsWithMembershipInfo = visibleChannels.map(channel => {
      const isMember = channel.members.some(m => {
        const memberId = m.user ? m.user.toString() : m.toString();
        return memberId === userId.toString();
      });

      return {
        ...channel,
        isMember,
        unreadCount: unreadCounts.get(String(channel._id)) || 0,
      };
    });

    return res.json({ channels: channelsWithMembershipInfo });
  } catch (err) {
    logger.error("GET WORKSPACE CHANNELS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.createWorkspaceChannel = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, description, isPrivate, isDiscoverable, members: channelMembers } = req.body;
    const userId = req.user?.sub;

    if (!name) {
      return res.status(400).json({ message: "Channel name is required" });
    }

    
    const workspace = await identity.workspaces.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    
    const membership = workspace.members.find(m => String(m.user) === String(userId));
    if (!membership) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    const isWorkspaceAdmin = membership.role === 'admin' || membership.role === 'owner';
    if (!isWorkspaceAdmin && workspace.settings?.allowMemberChannelCreation === false) {
      return res.status(403).json({ message: "Channel creation is disabled for members in this workspace" });
    }

    const existingChannel = await Channel.findOne({
      workspace: workspaceId,
      name: name.toLowerCase().trim()
    });

    if (existingChannel) {
      return res.status(400).json({ message: "A channel with this name already exists" });
    }

    
    
    if (channelMembers && channelMembers.length > 0) {
      const workspaceMemberIds = workspace.members.map(m => String(m.user));
      const invalidMembers = channelMembers.filter(memberId =>
        !workspaceMemberIds.includes(String(memberId))
      );

      if (invalidMembers.length > 0) {
        logger.error('🚨 [createWorkspaceChannel] SECURITY: Attempt to add non-workspace members to channel!', {
          workspaceId,
          invalidMembers
        });
        return res.status(403).json({
          message: "Cannot add users who are not workspace members to this channel",
          invalidMembers
        });
      }
    }

    
    const isPrivateChannel = isPrivate === true;

    
    
    
    

    logger.info(`🔍 [DEBUG] Channel creation request:`, {
      channelMembers,
      channelMembersType: typeof channelMembers,
      channelMembersLength: channelMembers?.length,
      userId,
      isPrivate: isPrivateChannel
    });

    
    const finalMemberIds = channelMembers && channelMembers.length > 0
      ? [...new Set([userId, ...channelMembers])]
      : [userId]; 

    logger.info(`🔍 [DEBUG] finalMemberIds:`, finalMemberIds);

    const finalMembers = finalMemberIds.map(memberId => ({
      user: memberId,
      joinedAt: new Date()
    }));

    
    const channel = await Channel.create({
      workspace: workspaceId,
      company: workspace.company || null,
      name: name.toLowerCase().trim(),
      description: description || "",
      isPrivate: isPrivateChannel, 
      isDiscoverable: isPrivateChannel ? false : (isDiscoverable !== undefined ? isDiscoverable : true), 
      isDefault: false, 
      createdBy: userId,
      members: finalMembers,
      admins: [userId] 
    });

    
    
    
    try {
      logger.info(`🔐 [PHASE 5] Channel created, generating conversation key for "${channel.name}"...`);

      
      
      await conversationKeysService.generateConversationKeyServerSide(
        channel._id.toString(),
        'channel',
        workspaceId,
        finalMemberIds,  
        userId           
      );

      logger.info(`✅ [PHASE 5] Conversation key created for channel: ${channel.name}`);

    } catch (keyError) {
      logger.error(`❌ [PHASE 5] Failed to generate conversation key:`, keyError);

      
      await Channel.findByIdAndDelete(channel._id);

      
      if (keyError.message && keyError.message.includes('IDENTITY_KEY_REQUIRED')) {
        return res.status(400).json({
          message: 'Cannot create encrypted channel: Identity key not found. Please ensure E2EE is initialized.',
          error: 'IDENTITY_KEY_REQUIRED'
        });
      }

      return res.status(500).json({
        message: 'Failed to initialize channel encryption',
        error: 'KEY_GENERATION_FAILED'
      });
    }

    return res.status(201).json({
      message: "Channel created successfully",
      channel: {
        _id: channel._id,
        name: channel.name,
        description: channel.description,
        isPrivate: channel.isPrivate,
        isDefault: channel.isDefault,
        members: channel.members
      }
    });
  } catch (err) {
    logger.error("CREATE WORKSPACE CHANNEL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getAllWorkspaceMembers = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?.sub;

    const workspace = await identity.workspaces.findById(workspaceId);
    if (workspace) {
      await hydrate(workspace, { 'members.user': { type: 'user', fields: ['username', 'email', 'profilePicture', 'isOnline', 'lastLoginAt'] } });
      workspace.members = workspace.members.filter(m => m.user);
    }

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    
    const isMember = workspace.members.some(m => String(m.user._id) === String(userId));
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    
    const members = workspace.members
      .map(m => ({
        _id: m.user._id,  
        id: m.user._id,   
        name: m.user.username,  
        username: m.user.username,  
        email: m.user.email,
        profilePicture: m.user.profilePicture,  
        status: m.user.isOnline ? 'online' : 'offline',
        lastSeen: m.user.lastLoginAt,
        role: m.role,
        isCurrentUser: String(m.user._id) === String(userId)
      }))
      
      .sort((a, b) => {
        const roleOrder = { owner: 0, admin: 1, member: 2 };
        const roleCompare = (roleOrder[a.role] || 2) - (roleOrder[b.role] || 2);
        if (roleCompare !== 0) return roleCompare;
        return a.username.localeCompare(b.username);  
      });

    return res.json({ members });
  } catch (err) {
    logger.error("GET ALL WORKSPACE MEMBERS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.renameWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user?.sub;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Workspace name is required" });
    }

    let workspace = await identity.workspaces.findById(id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    
    const member = workspace.members.find(m => String(m.user) === String(userId));
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
      return res.status(403).json({ message: "Only admins and owners can rename the workspace" });
    }

    
    const existingWorkspace = await wsQueries.findByNameForMember(name.trim(), userId, id);

    if (existingWorkspace) {
      return res.status(400).json({
        message: `You already have a workspace named "${name.trim()}". Please choose a different name.`
      });
    }

    
    workspace = await identity.workspaces.update(id, { name: name.trim() });

    const io = req.app?.get("io");
    if (io) {
      io.to(workspaceRooms(id)).emit("workspace-updated", {
        workspaceId: workspace._id,
        name: workspace.name
      });
    }

    return res.json({
      message: "Workspace renamed successfully",
      workspace: {
        id: workspace._id,
        name: workspace.name
      }
    });
  } catch (err) {
    logger.error("RENAME WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const { icon, description } = req.body || {};
    const userId = req.user?.sub;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid workspaceId" });

    // Settings arrive as body.settings.*; top-level keys of the same name are
    // accepted too (older clients). body.settings wins when both are sent.
    const body = req.body || {};
    if (body.settings !== undefined && (body.settings === null || typeof body.settings !== 'object' || Array.isArray(body.settings))) {
      return res.status(400).json({ message: "settings must be an object" });
    }
    const incoming = {};
    for (const k of [...BOOLEAN_SETTINGS, ...NUMBER_SETTINGS]) {
      if (body[k] !== undefined) incoming[k] = body[k];
      if (body.settings && body.settings[k] !== undefined) incoming[k] = body.settings[k];
    }
    for (const k of BOOLEAN_SETTINGS) {
      if (incoming[k] !== undefined && typeof incoming[k] !== 'boolean') {
        return res.status(400).json({ message: `settings.${k} must be a boolean` });
      }
    }
    if (incoming.autoArchiveInactiveDays !== undefined) {
      const n = incoming.autoArchiveInactiveDays;
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 3650) {
        return res.status(400).json({ message: "settings.autoArchiveInactiveDays must be an integer between 0 and 3650" });
      }
    }
    if (body.rules !== undefined && body.rules !== null) {
      if (typeof body.rules !== 'string') return res.status(400).json({ message: "rules must be a string" });
      if (body.rules.length > RULES_MAX) return res.status(400).json({ message: `rules must be at most ${RULES_MAX} characters` });
    }
    if (description !== undefined && description !== null && typeof description !== 'string') {
      return res.status(400).json({ message: "description must be a string" });
    }

    let workspace = await identity.workspaces.findById(id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    const member = workspace.members.find(m => String(m.user) === String(userId) && (m.status || 'active') === 'active');
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
      return res.status(403).json({ message: "Only admins and owners can update workspace settings" });
    }

    const patch = {};
    if (icon !== undefined) patch.icon = icon;
    if (body.color !== undefined) patch.color = body.color;
    if (description !== undefined) patch.description = description || "";
    if (body.rules !== undefined) patch.rules = body.rules || "";
    if (Object.keys(incoming).length) patch.settings = { $merge: true, ...incoming };

    workspace = await identity.workspaces.update(id, patch);

    const safeSettings = pickSafeSettings(workspace.settings);
    const io = req.app?.get("io");
    if (io) {
      io.to(workspaceRooms(id)).emit("workspace-updated", {
        workspaceId: workspace._id,
        name: workspace.name,
        icon: workspace.icon,
        color: workspace.color,
        description: workspace.description,
        rules: workspace.rules || "",
        settings: safeSettings
      });
    }

    return res.json({
      message: "Workspace updated successfully",
      workspace: {
        id: workspace._id,
        name: workspace.name,
        icon: workspace.icon,
        color: workspace.color,
        description: workspace.description,
        rules: workspace.rules || "",
        settings: safeSettings
      }
    });
  } catch (err) {
    logger.error("UPDATE WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getWorkspaceStats = async (req, res) => {
  try {
    const id = req.params.workspaceId || req.params.id;
    const userId = req.user?.sub;

    const workspace = await identity.workspaces.findById(id);
    if (workspace) await hydrate(workspace, { createdBy: { type: 'user', fields: ['username', 'email'] } });
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    
    const isMember = workspace.members.some(m => String(m.user) === String(userId));
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    
    const channelCount = await Channel.countDocuments({ workspace: id });

    
    const messageCount = await Message.countDocuments({ workspace: id });

    return res.json({
      memberCount: countActiveMembers(workspace.members),
      channelCount,
      messageCount,
      createdAt: workspace.createdAt,
      creator: {
        username: workspace.createdBy?.username,
        email: workspace.createdBy?.email
      },
      description: workspace.description,
      settings: workspace.settings
    });
  } catch (err) {
    logger.error("GET WORKSPACE STATS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.cloneWorkspace = async (req, res) => {
  try {
    const sourceId = req.params.id;
    const userId = req.user?.sub;
    const { name, description, includeMembership = false } = req.body;

    if (!name) return res.status(400).json({ message: 'New workspace name is required' });

    const source = await identity.workspaces.findById(sourceId);
    if (!source) return res.status(404).json({ message: 'Source workspace not found' });

    const isMember = source.members.some(m => String(m.user) === String(userId));
    if (!isMember) return res.status(403).json({ message: 'Not a workspace member' });

    const memberData = source.members.find(m => String(m.user) === String(userId));
    if (memberData.role !== 'admin' && memberData.role !== 'owner') {
      return res.status(403).json({ message: 'Admin access required to clone' });
    }

    const user = await identity.users.findById(userId);

    
    const resolvedCompanyId = user.companyId ? String(user.companyId) : null;

    
    const existing = await wsQueries.findByNameForCreator(name.trim(), userId);
    if (existing) return res.status(400).json({ message: 'Workspace name already exists in your account' });

    
    const cloneMembers = includeMembership
      ? source.members.filter(m => m.status !== 'removed').map(m => ({ user: m.user, role: m.role, status: 'active', joinedAt: new Date() }))
      : [{ user: userId, role: 'owner' }];

    let clone = await identity.workspaces.create({
      company: resolvedCompanyId || null,
      type: source.type,
      name: name.trim(),
      description: description || source.description,
      icon: source.icon,
      color: source.color,
      rules: source.rules || '',
      createdBy: userId,
      members: cloneMembers,
      settings: { ...(source.settings || {}) }
    });

    
    const sourceChannels = await Channel.find({ workspace: sourceId }).lean();
    const clonedChannelIds = [];

    for (const ch of sourceChannels) {
      const newChannel = await Channel.create({
        workspace: clone._id,
        company: resolvedCompanyId || null,
        name: ch.name,
        description: ch.description || '',
        isPrivate: ch.isPrivate,
        isDefault: ch.isDefault,
        createdBy: userId,
        members: [{ user: userId, joinedAt: new Date() }],
        systemEvents: [{ type: 'channel_created', userId, timestamp: new Date() }]
      });
      clonedChannelIds.push(newChannel._id);
    }

    clone = await identity.workspaces.update(clone._id, { defaultChannels: clonedChannelIds.slice(0, 2) });

    const io = req.app?.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('workspace-cloned', { workspaceId: clone._id, name: clone.name });
    }

    return res.status(201).json({
      message: 'Workspace cloned successfully',
      workspace: {
        id: clone._id,
        name: clone.name,
        icon: clone.icon,
        color: clone.color,
        channelsCopied: clonedChannelIds.length
      }
    });
  } catch (err) {
    return handleError(res, err, 'CLONE WORKSPACE ERROR');
  }
};

exports.exportWorkspace = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user?.sub;

    const workspace = await identity.workspaces.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const isMember = workspace.members.some(m => String(m.user) === String(userId));
    if (!isMember) return res.status(403).json({ message: 'Not a workspace member' });

    const channels = await Channel.find({ workspace: workspaceId })
      .select('name description isPrivate isDefault')
      .lean();

    const snapshot = {
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
      version: '1.0',
      workspace: {
        name: workspace.name,
        description: workspace.description,
        icon: workspace.icon,
        color: workspace.color,
        rules: workspace.rules || '',
        type: workspace.type,
        settings: workspace.settings
      },
      channels: channels.map(c => ({
        name: c.name,
        description: c.description,
        isPrivate: c.isPrivate,
        isDefault: c.isDefault
      }))
    };

    res.setHeader('Content-Disposition', `attachment; filename="workspace-${workspace.name.replace(/\s+/g, '-')}-export.json"`);
    res.setHeader('Content-Type', 'application/json');
    return res.json(snapshot);
  } catch (err) {
    return handleError(res, err, 'EXPORT WORKSPACE ERROR');
  }
};

exports.importWorkspace = async (req, res) => {
  try {
    const userId = req.user?.sub;
    const { snapshot } = req.body;

    if (!snapshot || !snapshot.workspace) {
      return res.status(400).json({ message: 'Valid workspace snapshot is required' });
    }

    const user = await identity.users.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const resolvedCompanyId = user.companyId ? String(user.companyId) : null;

    if (!resolvedCompanyId) {
      
      const owned = await wsQueries.countCreatedBy(userId);
      if (owned >= 3) {
        return res.status(403).json({ message: 'Free plan limit: max 3 workspaces', isLimitReached: true });
      }
    }

    const { workspace: ws, channels = [] } = snapshot;
    const name = (ws.name || 'Imported Workspace').trim();

    
    const existing = await wsQueries.findByNameForCreator(name, userId);
    if (existing) return res.status(400).json({ message: 'Workspace name already exists — rename before importing' });

    let imported = await identity.workspaces.create({
      company: resolvedCompanyId || null,
      type: ws.type || 'team',
      name,
      description: ws.description || '',
      icon: ws.icon || '📁',
      color: ws.color || '#2563eb',
      rules: ws.rules || '',
      createdBy: userId,
      members: [{ user: userId, role: 'owner' }],
      settings: ws.settings || {}
    });

    const createdChannelIds = [];
    for (const ch of channels) {
      if (!ch.name) continue;
      const channel = await Channel.create({
        workspace: imported._id,
        company: resolvedCompanyId || null,
        name: ch.name,
        description: ch.description || '',
        isPrivate: !!ch.isPrivate,
        isDefault: !!ch.isDefault,
        createdBy: userId,
        members: [{ user: userId, joinedAt: new Date() }],
        systemEvents: [{ type: 'channel_created', userId, timestamp: new Date() }]
      });
      createdChannelIds.push(channel._id);
    }

    imported = await identity.workspaces.update(imported._id, {
      defaultChannels: createdChannelIds.filter((_, i) => channels[i]?.isDefault).slice(0, 2),
    });

    return res.status(201).json({
      message: 'Workspace imported successfully',
      workspace: { id: imported._id, name: imported.name, icon: imported.icon, color: imported.color }
    });
  } catch (err) {
    return handleError(res, err, 'IMPORT WORKSPACE ERROR');
  }
};

exports.getWorkspaceAnalytics = async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.user?.sub;

    const workspace = await identity.workspaces.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const isMember = workspace.members.some(m => String(m.user) === String(userId));
    if (!isMember) return res.status(403).json({ message: 'Not a workspace member' });

    const [channelCount, messageCount, taskCount, noteCount] = await Promise.all([
      Channel.countDocuments({ workspace: workspaceId }),
      Message.countDocuments({ workspace: workspaceId }),
      Tasks.countDocuments({ workspace: workspaceId }),
      Note.countDocuments({ workspace: workspaceId })
    ]);

    
    const memberGrowth = workspace.members.reduce((acc, m) => {
      if (!m.joinedAt) return acc;
      const key = new Date(m.joinedAt).toISOString().slice(0, 7); 
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    
    const roleBreakdown = workspace.members.reduce((acc, m) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    }, {});

    
    const activityScore = Math.min(100, Math.round(
      (messageCount / 10) * 0.4 +
      (taskCount / 5) * 0.3 +
      (noteCount / 5) * 0.2 +
      (channelCount * 3) * 0.1
    ));

    return res.json({
      workspace: { id: workspace._id, name: workspace.name, createdAt: workspace.createdAt },
      summary: {
        memberCount: countActiveMembers(workspace.members),
        channelCount,
        messageCount,
        taskCount,
        noteCount,
        activityScore
      },
      memberGrowth,
      roleBreakdown,
      lastActivityAt: workspace.lastActivityAt
    });
  } catch (err) {
    return handleError(res, err, 'GET WORKSPACE ANALYTICS ERROR');
  }
};
