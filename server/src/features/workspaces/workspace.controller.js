const Workspace = require("../../../models/Workspace");
const Channel = require("../channels/channel.model.js");
const User = require("../../../models/User");
const Message = require("../messages/message.model.js");
const DMSession = require("../../../models/DMSession");
const Task = require("../../../models/Task");
const Note = require("../../../models/Note");
const Update = require("../../../models/Update");
const Favorite = require("../../../models/Favorite");
const Invite = require("../../../models/Invite");
const { _createInvite } = require("../../../utils/invite");
const sendEmail = require("../../../utils/sendEmail");
const { handleError, _notFound, _badRequest, _forbidden } = require("../../../utils/responseHelpers");
const { _isMember, normalizeMemberFormat } = require("../../../utils/memberHelpers");
const conversationKeysService = require("../../modules/conversations/conversationKeys.service");

exports.createWorkspace = async (req, res) => {
  try {
    const {
      companyId,
      name,
      description,
      icon,
      color,
      rules
    } = req.body;
    const userId = req.user?.sub;

    if (!name) return res.status(400).json({ message: "Workspace name is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    
    
    
    
    
    
    const resolvedCompanyId = user.companyId ? String(user.companyId) : null;

    
    const isCompanyWorkspace = !!resolvedCompanyId;
    const isPersonalWorkspace = !isCompanyWorkspace;

    
    if (isCompanyWorkspace) {
      const role = user.companyRole;
      if (!role || (role !== "admin" && role !== "owner" && role !== "manager")) {
        return res.status(403).json({ message: "Only company admins/managers may create workspaces" });
      }
    }

    
    if (isPersonalWorkspace) {
      const ownedWorkspacesCount = await Workspace.countDocuments({ createdBy: userId });
      if (ownedWorkspacesCount >= 3) {
        return res.status(403).json({
          message: "Free plan limit reached. You can only create up to 3 workspaces.",
          isLimitReached: true
        });
      }
    }

    
    const existingWorkspace = await Workspace.findOne({
      name: name.trim(),
      createdBy: userId  
    });

    if (existingWorkspace) {
      return res.status(400).json({
        message: `Workspace name already exists in your account`
      });
    }

    
    const workspace = await Workspace.create({
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

    console.log("🏗 [PHASE 2] Workspace created:", workspace._id.toString());

    
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

    console.log("📢 [PHASE 2] Default channels created: general, announcements");

    
    
    console.log(`🔐 [PHASE 5] Generating conversation keys for default channels...`);

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
        console.log(`✅ [PHASE 5] Bootstrapped conversation key for #${name}`);
      } catch (keyError) {
        
        
        
        console.error(`⚠️ [PHASE 5] Failed to bootstrap key for #${name} (non-fatal):`, keyError.message);
        console.warn(`   Workspace will be created without E2EE keys for #${name}.`);
        console.warn(`   Keys will be distributed via repair when E2EE is configured.`);
      }
    }

    
    workspace.defaultChannels = [generalChannel._id, announcementsChannel._id];
    await workspace.save();

    
    user.workspaces.push({
      workspace: workspace._id,
      role: "owner"
    });

    
    if (isPersonalWorkspace && !user.personalWorkspace) {
      user.personalWorkspace = workspace._id;
    }

    await user.save();

    console.log("👤 [PHASE 2] User added as member:", userId);

    return res.status(201).json({
      message: "Workspace created successfully",
      workspace: {
        id: workspace._id,
        name: workspace.name,
        type: workspace.type,
        icon: workspace.icon,
        color: workspace.color || "#2563eb",
        defaultChannels: workspace.defaultChannels
      }
    });
  } catch (err) {
    return handleError(res, err, "CREATE WORKSPACE ERROR");
  }
};

exports.listMyWorkspaces = async (req, res) => {
  try {
    const userId = req.user?.sub;

    const user = await User.findById(userId).populate({
      path: 'workspaces.workspace',
      select: '-__v'
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    
    const workspacesWithOwner = await Promise.all(
      user.workspaces
        .filter(ws => ws.workspace) 
        .map(async (ws) => {
          
          const workspace = await Workspace.findById(ws.workspace._id)
            .populate('createdBy', 'username')
            .lean();

          return {
            id: ws.workspace._id,
            name: ws.workspace.name,
            description: ws.workspace.description,
            icon: ws.workspace.icon,
            color: ws.workspace.color || "#2563eb",
            rules: ws.workspace.rules || "",
            type: ws.workspace.type,
            role: ws.role,
            memberCount: ws.workspace.members?.length || 0,
            isPersonal: ws.workspace.type === 'personal',
            ownerName: workspace?.createdBy?.username || 'Unknown',  
            isOwner: String(workspace?.createdBy?._id) === String(userId)  
          };
        })
    );

    return res.json({ workspaces: workspacesWithOwner });
  } catch (err) {
    return handleError(res, err, "LIST MY WORKSPACES ERROR");
  }
};

exports.listWorkspaces = async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const userId = req.user?.sub;

    const user = await User.findById(userId);
    if (!user || String(user.companyId) !== String(companyId)) return res.status(403).json({ message: "Not a company member" });

    const workspaces = await Workspace.find({ company: companyId }).select("-__v").lean();
    return res.json({ workspaces });
  } catch (err) {
    return handleError(res, err, "LIST WORKSPACES ERROR");
  }
};

exports.getWorkspaceMembers = async (req, res) => {
  try {
    
    const workspaceId = req.params.workspaceId || req.params.id;
    const userId = req.user.sub;

    const workspace = await Workspace.findById(workspaceId)
      .populate('members.user', 'username email phone profilePicture isOnline userStatus profile');

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    
    const isMember = workspace.members.some(m => String(m.user._id) === String(userId));
    if (!isMember) {
      return res.status(403).json({ message: "Not a workspace member" });
    }

    
    const formattedMembers = workspace.members.map(m => ({
      _id: m.user._id,
      username: m.user.username,
      email: m.user.email,
      phone: m.user.phone,
      profilePicture: m.user.profilePicture,
      isOnline: m.user.isOnline,
      profile: m.user.profile,
      role: m.role,
      status: m.status || 'active',
      joinedAt: m.joinedAt
    }));

    return res.json({ members: formattedMembers });
  } catch (err) {
    return handleError(res, err, "GET WORKSPACE MEMBERS ERROR");
  }
};

exports.deleteWorkspace = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user?.sub;

    const workspace = await Workspace.findById(workspaceId);
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

    
    const _deletedTasks = await Task.deleteMany({ workspace: workspaceId });

    
    const _deletedNotes = await Note.deleteMany({ workspace: workspaceId });

    
    const _deletedUpdates = await Update.deleteMany({ workspace: workspaceId });

    
    const _deletedFavorites = await Favorite.deleteMany({ workspace: workspaceId });

    
    const _deletedInvites = await Invite.deleteMany({ workspace: workspaceId });

    
    await User.updateMany(
      { "workspaces.workspace": workspaceId },
      { $pull: { workspaces: { workspace: workspaceId } } }
    );

    
    await User.updateMany(
      { personalWorkspace: workspaceId },
      { $unset: { personalWorkspace: "" } }
    );

    
    const io = req.app?.get("io");
    if (io) {
      io.to(`workspace_${workspaceId}`).emit("workspace-deleted", { workspaceId });
    }

    
    await Workspace.findByIdAndDelete(workspaceId);

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

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    
    const isWorkspaceMember = workspace.members.some(m => String(m.user) === String(inviterId));
    if (!isWorkspaceMember) {
      return res.status(403).json({ message: "You must be a member to invite others" });
    }

    const invites = [];
    const Invite = require("../../../models/Invite");
    const crypto = require("crypto");
    const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");

    if (inviteType === "email" && emails) {
      
      const emailList = emails.split(',').map(e => e.trim()).filter(Boolean);

      for (const email of emailList) {
        
        const userExists = await User.findOne({ email });

        const raw = crypto.randomBytes(32).toString("hex");
        const tokenHash = sha256(raw);
        const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);

        const _invite = await Invite.create({
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

        
        const inviter = await User.findById(req.user.sub).select('username');
        const inviterName = inviter ? inviter.username : 'A team member';

        
        try {
          const { workspaceInvitationTemplate } = require('../../../utils/emailTemplates');
          const template = workspaceInvitationTemplate(
            workspace.name,
            inviterName,
            inviteLink,
            'Member',
            daysValid
          );

          await sendEmail({
            to: email,
            subject: template.subject,
            html: template.html,
            text: template.text
          });

        } catch (_e) {
          console.warn("⚠️ SMTP not configured — Email not sent");

        }

        invites.push({ email, inviteLink, userExists: !!userExists });
      }

      return res.json({
        message: "Email invites sent successfully",
        invites
      });
    } else {
      
      const raw = crypto.randomBytes(32).toString("hex");
      const tokenHash = sha256(raw);
      const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);

      const _invite = await Invite.create({
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
    console.error("INVITE TO WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getInviteDetails = async (req, res) => {
  try {
    const { token } = req.params;
    const crypto = require("crypto");
    const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
    const Invite = require("../../../models/Invite");

    const tokenHash = sha256(token);
    const invite = await Invite.findOne({ tokenHash })
      .populate('workspace', 'name description icon metadata')
      .populate('invitedBy', 'username profilePicture');

    if (!invite) {
      return res.status(404).json({ message: "Invalid invitation link" });
    }

    if (invite.used) {
      return res.status(400).json({ message: "This invitation link has already been used" });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ message: "This invitation link has expired" });
    }

    const workspace = await Workspace.findById(invite.workspace);
    const memberCount = workspace.members.length;

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
    const Invite = require("../../../models/Invite");

    if (!token) {

      return res.status(400).json({ message: "Invite token is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const tokenHash = sha256(token);
    const invite = await Invite.findOne({ tokenHash });

    if (!invite) {
      return res.status(404).json({ message: "Invalid invitation link" });
    }

    if (invite.used) {
      return res.status(400).json({ message: "This invitation link has already been used" });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ message: "This invitation link has expired" });
    }

    
    const workspace = await Workspace.findById(invite.workspace);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    
    const alreadyMember = workspace.members.some(m => String(m.user) === String(userId));
    if (alreadyMember) {
      return res.status(400).json({ message: "You are already a member of this workspace" });
    }

    
    workspace.members.push({
      user: userId,
      role: invite.role,
      joinedAt: new Date()
    });
    await workspace.save();

    
    user.workspaces.push({
      workspace: workspace._id,
      role: invite.role,
      joinedAt: new Date()
    });
    await user.save();

    
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

    
    
    
    console.log(`🔐 [PHASE 4] Distributing conversation keys to user ${userId}...`);
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
            console.log(`✅ [PHASE 4] Distributed conversation key for #${channel.name} to user ${userId}`);
          } else {
            console.warn(`⚠️ [PHASE 4] Could not distribute key for #${channel.name} to user ${userId}`);
          }
        } else {
          console.log(`ℹ️ [PHASE 4] No conversation key exists for #${channel.name} yet (will be created on first message)`);
        }
      } catch (keyError) {
        
        console.error(`❌ [PHASE 4] Key distribution failed for #${channel.name}:`, keyError.message);
      }
    }

    
    invite.used = true;
    invite.usedBy = userId;
    invite.usedAt = new Date();
    await invite.save();

    
    const io = req.app.get("io");
    if (io) {
      io.to(`workspace_${workspace._id.toString()}`).emit("workspace-joined", {
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
    console.error("JOIN WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getWorkspaceMembers = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?.sub;

    const workspace = await Workspace.findById(workspaceId).populate({
      path: 'members.user',
      select: 'username email phone profilePicture isOnline userStatus profile lastLoginAt'
    });

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    
    const isMember = workspace.members.some(m => String(m.user._id) === String(userId));
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    
    const members = workspace.members
      .filter(m => String(m.user._id) !== String(userId))
      .map(m => ({
        _id: m.user._id,  
        username: m.user.username,  
        email: m.user.email,
        phone: m.user.phone,  
        profilePicture: m.user.profilePicture,  
        userStatus: m.user.userStatus,  
        profile: m.user.profile,  
        status: m.user.isOnline ? 'online' : 'offline',
        lastSeen: m.user.lastLoginAt,
        role: m.role
      }));

    return res.json({ members });
  } catch (err) {
    console.error("GET WORKSPACE MEMBERS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getWorkspaceChannels = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?.sub;

    
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    
    const isMember = workspace.members.some(m => String(m.user) === String(userId));
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    
    const allChannels = await Channel.find({ workspace: workspaceId })
      .select('name description isPrivate isDefault isDiscoverable members createdBy createdAt workspace admins systemEvents')
      .populate('createdBy', 'firstName lastName')
      .sort({ isDefault: -1, createdAt: 1 }) 
      .lean();

    
    const User = require('../../../models/User');

    
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
      const eventUsers = await User.find(
        { _id: { $in: Array.from(eventUserIds) } },
        { firstName: 1, lastName: 1, username: 1 }
      ).lean();
      eventUsers.forEach(u => {
        userMap.set(u._id.toString(),
          u.username || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown'
        );
      });
    }

    
    for (const channel of allChannels) {
      if (channel.createdBy) {
        channel.creatorName = `${channel.createdBy.firstName || ''} ${channel.createdBy.lastName || ''}`.trim() || 'Unknown';
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

    
    const channelsWithMembershipInfo = visibleChannels.map(channel => {
      const isMember = channel.members.some(m => {
        const memberId = m.user ? m.user.toString() : m.toString();
        return memberId === userId.toString();
      });

      return {
        ...channel,
        isMember 
      };
    });

    return res.json({ channels: channelsWithMembershipInfo });
  } catch (err) {
    console.error("GET WORKSPACE CHANNELS ERROR:", err);
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

    
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    
    const isMember = workspace.members.some(m => String(m.user) === String(userId));
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
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
        console.error('🚨 [createWorkspaceChannel] SECURITY: Attempt to add non-workspace members to channel!', {
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

    
    
    
    

    console.log(`🔍 [DEBUG] Channel creation request:`, {
      channelMembers,
      channelMembersType: typeof channelMembers,
      channelMembersLength: channelMembers?.length,
      userId,
      isPrivate: isPrivateChannel
    });

    
    const finalMemberIds = channelMembers && channelMembers.length > 0
      ? [...new Set([userId, ...channelMembers])]
      : [userId]; 

    console.log(`🔍 [DEBUG] finalMemberIds:`, finalMemberIds);

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
      console.log(`🔐 [PHASE 5] Channel created, generating conversation key for "${channel.name}"...`);

      
      
      await conversationKeysService.generateConversationKeyServerSide(
        channel._id.toString(),
        'channel',
        workspaceId,
        finalMemberIds,  
        userId           
      );

      console.log(`✅ [PHASE 5] Conversation key created for channel: ${channel.name}`);

    } catch (keyError) {
      console.error(`❌ [PHASE 5] Failed to generate conversation key:`, keyError);

      
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
    console.error("CREATE WORKSPACE CHANNEL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getAllWorkspaceMembers = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?.sub;

    const workspace = await Workspace.findById(workspaceId).populate({
      path: 'members.user',
      select: 'username email profilePicture isOnline lastLoginAt'
    });

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
    console.error("GET ALL WORKSPACE MEMBERS ERROR:", err);
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

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    
    const member = workspace.members.find(m => String(m.user) === String(userId));
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
      return res.status(403).json({ message: "Only admins and owners can rename the workspace" });
    }

    
    const existingWorkspace = await Workspace.findOne({
      _id: { $ne: id }, 
      name: name.trim(),
      'members.user': userId
    });

    if (existingWorkspace) {
      return res.status(400).json({
        message: `You already have a workspace named "${name.trim()}". Please choose a different name.`
      });
    }

    
    workspace.name = name.trim();
    await workspace.save();

    const io = req.app?.get("io");
    if (io) {
      io.to(`workspace_${id}`).emit("workspace-updated", {
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
    console.error("RENAME WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const { icon, description, settings } = req.body;
    const userId = req.user?.sub;

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    
    const member = workspace.members.find(m => String(m.user) === String(userId));
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
      return res.status(403).json({ message: "Only admins and owners can update workspace settings" });
    }

    
    if (icon !== undefined) workspace.icon = icon;
    if (req.body.color !== undefined) workspace.color = req.body.color;
    if (description !== undefined) workspace.description = description;
    if (settings) {
      if (settings.allowMemberChannelCreation !== undefined) {
        workspace.settings.allowMemberChannelCreation = settings.allowMemberChannelCreation;
      }
      if (settings.allowMemberInvite !== undefined) {
        workspace.settings.allowMemberInvite = settings.allowMemberInvite;
      }
      if (settings.requireAdminApproval !== undefined) {
        workspace.settings.requireAdminApproval = settings.requireAdminApproval;
      }
      if (settings.isDiscoverable !== undefined) {
        workspace.settings.isDiscoverable = settings.isDiscoverable;
      }
    }

    await workspace.save();

    const io = req.app?.get("io");
    if (io) {
      io.to(`workspace_${id}`).emit("workspace-updated", {
        workspaceId: workspace._id,
        name: workspace.name,
        icon: workspace.icon,
        color: workspace.color,
        description: workspace.description,
        settings: workspace.settings
      });
    }

    return res.json({
      message: "Workspace updated successfully",
      workspace: {
        id: workspace._id,
        name: workspace.name,
        icon: workspace.icon,
        description: workspace.description,
        settings: workspace.settings
      }
    });
  } catch (err) {
    console.error("UPDATE WORKSPACE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getWorkspaceStats = async (req, res) => {
  try {
    const id = req.params.workspaceId || req.params.id;
    const userId = req.user?.sub;

    const workspace = await Workspace.findById(id).populate('createdBy', 'username email');
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
      memberCount: workspace.members.length,
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
    console.error("GET WORKSPACE STATS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.cloneWorkspace = async (req, res) => {
  try {
    const sourceId = req.params.id;
    const userId = req.user?.sub;
    const { name, description, includeMembership = false } = req.body;

    if (!name) return res.status(400).json({ message: 'New workspace name is required' });

    const source = await Workspace.findById(sourceId);
    if (!source) return res.status(404).json({ message: 'Source workspace not found' });

    const isMember = source.members.some(m => String(m.user) === String(userId));
    if (!isMember) return res.status(403).json({ message: 'Not a workspace member' });

    const memberData = source.members.find(m => String(m.user) === String(userId));
    if (memberData.role !== 'admin' && memberData.role !== 'owner') {
      return res.status(403).json({ message: 'Admin access required to clone' });
    }

    const user = await User.findById(userId);

    
    const resolvedCompanyId = user.companyId ? String(user.companyId) : null;

    
    const existing = await Workspace.findOne({ name: name.trim(), createdBy: userId });
    if (existing) return res.status(400).json({ message: 'Workspace name already exists in your account' });

    
    const cloneMembers = includeMembership
      ? source.members.map(m => ({ user: m.user, role: m.role, status: 'active', joinedAt: new Date() }))
      : [{ user: userId, role: 'owner' }];

    const clone = await Workspace.create({
      company: resolvedCompanyId || null,
      type: source.type,
      name: name.trim(),
      description: description || source.description,
      icon: source.icon,
      color: source.color,
      rules: source.rules || '',
      createdBy: userId,
      members: cloneMembers,
      settings: { ...source.settings.toObject() }
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

    clone.defaultChannels = clonedChannelIds.slice(0, 2);
    await clone.save();

    
    user.workspaces.push({ workspace: clone._id, role: 'owner' });
    await user.save();

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

    const workspace = await Workspace.findById(workspaceId);
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

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const resolvedCompanyId = user.companyId ? String(user.companyId) : null;

    if (!resolvedCompanyId) {
      
      const owned = await Workspace.countDocuments({ createdBy: userId });
      if (owned >= 3) {
        return res.status(403).json({ message: 'Free plan limit: max 3 workspaces', isLimitReached: true });
      }
    }

    const { workspace: ws, channels = [] } = snapshot;
    const name = (ws.name || 'Imported Workspace').trim();

    
    const existing = await Workspace.findOne({ name, createdBy: userId });
    if (existing) return res.status(400).json({ message: 'Workspace name already exists — rename before importing' });

    const imported = await Workspace.create({
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

    imported.defaultChannels = createdChannelIds.filter((_, i) => channels[i]?.isDefault).slice(0, 2);
    await imported.save();

    user.workspaces.push({ workspace: imported._id, role: 'owner' });
    await user.save();

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

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const isMember = workspace.members.some(m => String(m.user) === String(userId));
    if (!isMember) return res.status(403).json({ message: 'Not a workspace member' });

    const [channelCount, messageCount, taskCount, noteCount] = await Promise.all([
      Channel.countDocuments({ workspace: workspaceId }),
      Message.countDocuments({ workspace: workspaceId }),
      Task.countDocuments({ workspace: workspaceId }),
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
        memberCount: workspace.members.length,
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
