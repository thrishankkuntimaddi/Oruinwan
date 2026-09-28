const logger = require('../../../utils/logger');
const mongoose = require('mongoose');

// Folders whose objects are meant to be visible to any authenticated user
// (avatars and company logos are rendered next to names across the app).
const SHARED_PREFIXES = ['profiles/', 'company-logos/'];

/**
 * Avatars and logos are rendered by plain <img> tags, which cannot send an Authorization
 * header. In production they live in a public bucket; with the local storage driver they
 * are served through /uploads/file, so these folders are readable without a token too
 * (object names are random UUIDs, not guessable).
 */
const isPublicObject = (gcsPath) => typeof gcsPath === 'string' && SHARED_PREFIXES.some((p) => gcsPath.startsWith(p));

function idEq(a, b) {
    return a != null && b != null && String(a) === String(b);
}

async function isWorkspaceMember(workspaceId, userId) {
    if (!workspaceId || !mongoose.isValidObjectId(String(workspaceId))) return false;
    const Workspace = require('../../../models/Workspace');
    const ws = await Workspace.findOne({ _id: workspaceId, 'members.user': userId }).select('_id').lean();
    return !!ws;
}

async function canAccessMessage(msg, userId) {
    if (idEq(msg.sender, userId)) return true;

    if (msg.dm) {
        const DMSession = require('../../../models/DMSession');
        const dm = await DMSession.findOne({ _id: msg.dm, participants: userId }).select('_id').lean();
        return !!dm;
    }

    if (msg.channel) {
        const Channel = require('../../features/channels/channel.model.js');
        const channel = await Channel.findById(msg.channel).select('isPrivate isDefault members.user workspace').lean();
        if (!channel) return false;
        const isChannelMember = (channel.members || []).some(m => idEq(m.user || m, userId));
        if (isChannelMember) return true;
        // Public/default channel: any member of its workspace may read it.
        if (!channel.isPrivate || channel.isDefault) {
            return isWorkspaceMember(channel.workspace || msg.workspace, userId);
        }
        return false;
    }

    if (msg.workspace) return isWorkspaceMember(msg.workspace, userId);
    return false;
}

/**
 * Decide whether `userId` may read the GCS object at `gcsPath`.
 * `objectMeta` is the custom metadata stored at upload time ({ uploadedBy, companyId }).
 */
async function canAccessFile(gcsPath, userId, objectMeta = {}) {
    if (!userId) return false;

    if (SHARED_PREFIXES.some(p => gcsPath.startsWith(p))) return true;

    // The uploader can always read their own file.
    if (idEq(objectMeta.uploadedBy, userId)) return true;

    // notes/<workspaceId>/... — workspace members only.
    const notesMatch = gcsPath.match(/^notes\/([a-f0-9]{24})\//i);
    if (notesMatch) return isWorkspaceMember(notesMatch[1], userId);

    const proxyUrl = `/api/v2/uploads/file?path=${encodeURIComponent(gcsPath)}`;

    // Chat attachments — must be able to read the conversation that carries them.
    const Message = require('../messages/message.model.js');
    const messages = await Message.find({
        $or: [{ 'attachments.url': proxyUrl }, { 'payload.attachments.url': proxyUrl }],
    }).select('sender dm channel workspace').limit(20).lean();
    for (const msg of messages) {
        if (await canAccessMessage(msg, userId)) return true;
    }

    // Workspace file library.
    const WorkspaceFile = require('../../features/files/WorkspaceFile');
    const FileVersion = require('../../features/files/FileVersion');
    let wsFile = await WorkspaceFile.findOne({ gcsPath }).select('workspaceId').lean();
    if (!wsFile) {
        const version = await FileVersion.findOne({ gcsPath }).select('fileId').lean();
        if (version) wsFile = await WorkspaceFile.findById(version.fileId).select('workspaceId').lean();
    }
    if (wsFile && await isWorkspaceMember(wsFile.workspaceId, userId)) return true;

    // Same-company fallback for attachments on tasks/updates/tickets (uploaded with company metadata).
    // Not for files shared in a chat: those follow the conversation's membership, so a
    // coworker outside a DM or private channel can't open its files.
    if (objectMeta.companyId && messages.length === 0) {
        const User = require('../../../models/User');
        const requester = await User.findById(userId).select('companyId').lean();
        if (requester && idEq(requester.companyId, objectMeta.companyId)) return true;
    }

    logger.warn({ gcsPath, userId }, '[UploadAccess] Denied file access');
    return false;
}

module.exports = { isPublicObject, canAccessFile };
