const DMSession = require('../../../models/DMSession');
const Message = require('./message.model');
const mongoose = require('mongoose');
const groupDM = require('./groupDM.service');

const ioOf = (req) => req.io || req.app?.get?.('io') || null;
const sendError = (res, err) => res.status(err.status || 500).json({ message: err.message, ...(err.code ? { code: err.code } : {}) });

async function getSessionAsParticipant(dmId, userId) {
    if (!mongoose.isValidObjectId(String(dmId))) throw Object.assign(new Error('DM session not found'), { status: 404 });
    const session = await DMSession.findById(dmId);
    if (!session) throw Object.assign(new Error('DM session not found'), { status: 404 });
    const isParticipant = session.participants.some(p => String(p) === String(userId));
    if (!isParticipant) throw Object.assign(new Error('Not a participant'), { status: 403 });
    return session;
}

exports.getDMStatus = async (req, res) => {
    try {
        const { dmId } = req.params;
        const userId = req.user.sub;

        const session = await getSessionAsParticipant(dmId, userId);

        const isMuted = session.mutedBy?.some(m => String(m.user) === String(userId));
        const isBlocked = session.blockedBy?.some(b => String(b.user) === String(userId));
        const isBlockedByOther = session.blockedBy?.some(b => String(b.user) !== String(userId));

        return res.json({ isMuted, isBlocked, isBlockedByOther, isGroup: !!session.isGroup });
    } catch (err) {
        return res.status(err.status || 500).json({ message: err.message });
    }
};

exports.clearDMChat = async (req, res) => {
    try {
        const { dmId } = req.params;
        const userId = req.user.sub;

        const session = await getSessionAsParticipant(dmId, userId);

        
        session.clearedAt = session.clearedAt.filter(c => String(c.user) !== String(userId));
        session.clearedAt.push({ user: userId, clearedAt: new Date() });
        await session.save();

        return res.json({ success: true, clearedAt: new Date() });
    } catch (err) {
        return res.status(err.status || 500).json({ message: err.message });
    }
};

exports.deleteDMChat = async (req, res) => {
    try {
        const { dmId } = req.params;
        const userId = req.user.sub;

        const session = await getSessionAsParticipant(dmId, userId);

        
        // Deleting a conversation hides it from this user's list and clears its
        // history for them only; a new message brings it back (sendDirectMessage).
        const now = new Date();
        session.hiddenFor = (session.hiddenFor || []).filter(h => String(h.user) !== String(userId));
        session.hiddenFor.push({ user: userId, hiddenAt: now });
        session.clearedAt = (session.clearedAt || []).filter(c => String(c.user) !== String(userId));
        session.clearedAt.push({ user: userId, clearedAt: now });
        await session.save();

        return res.json({ success: true });
    } catch (err) {
        return res.status(err.status || 500).json({ message: err.message });
    }
};

exports.blockUser = async (req, res) => {
    try {
        const { dmId } = req.params;
        const userId = req.user.sub;

        const session = await getSessionAsParticipant(dmId, userId);
        if (session.isGroup) return res.status(400).json({ code: 'NOT_FOR_GROUPS', message: 'Leave the group instead of blocking it.' });

        const alreadyBlocked = session.blockedBy?.some(b => String(b.user) === String(userId));
        if (!alreadyBlocked) {
            session.blockedBy = session.blockedBy || [];
            session.blockedBy.push({ user: userId, blockedAt: new Date() });
            await session.save();
        }

        return res.json({ success: true, isBlocked: true });
    } catch (err) {
        return res.status(err.status || 500).json({ message: err.message });
    }
};

exports.unblockUser = async (req, res) => {
    try {
        const { dmId } = req.params;
        const userId = req.user.sub;

        const session = await getSessionAsParticipant(dmId, userId);

        session.blockedBy = (session.blockedBy || []).filter(b => String(b.user) !== String(userId));
        await session.save();

        return res.json({ success: true, isBlocked: false });
    } catch (err) {
        return res.status(err.status || 500).json({ message: err.message });
    }
};

exports.muteDM = async (req, res) => {
    try {
        const { dmId } = req.params;
        const userId = req.user.sub;

        const session = await getSessionAsParticipant(dmId, userId);

        const alreadyMuted = session.mutedBy?.some(m => String(m.user) === String(userId));
        if (!alreadyMuted) {
            session.mutedBy = session.mutedBy || [];
            session.mutedBy.push({ user: userId, mutedAt: new Date() });
            await session.save();
        }

        return res.json({ success: true, isMuted: true });
    } catch (err) {
        return res.status(err.status || 500).json({ message: err.message });
    }
};

exports.unmuteDM = async (req, res) => {
    try {
        const { dmId } = req.params;
        const userId = req.user.sub;

        const session = await getSessionAsParticipant(dmId, userId);

        session.mutedBy = (session.mutedBy || []).filter(m => String(m.user) !== String(userId));
        await session.save();

        return res.json({ success: true, isMuted: false });
    } catch (err) {
        return res.status(err.status || 500).json({ message: err.message });
    }
};

// ── Group DMs ───────────────────────────────────────────────────────────────

/** POST /api/v2/dm/group { workspaceId, memberIds: [...], name? } */
exports.createGroupDM = async (req, res) => {
    try {
        const { workspaceId, memberIds, name } = req.body || {};
        const { session, created } = await groupDM.createGroup({ creatorId: req.user.sub, workspaceId, memberIds, name }, ioOf(req));
        return res.status(created ? 201 : 200).json({ success: true, created, dm: await groupDM.describe(session, req.user.sub) });
    } catch (err) {
        return sendError(res, err);
    }
};

/** GET /api/v2/dm/:dmId — people and name, for 1:1 and group DMs. */
exports.getDMDetails = async (req, res) => {
    try {
        const session = await getSessionAsParticipant(req.params.dmId, req.user.sub);
        return res.json({ dm: await groupDM.describe(session, req.user.sub) });
    } catch (err) {
        return sendError(res, err);
    }
};

/** PATCH /api/v2/dm/:dmId { name } — rename a group (empty name clears it). */
exports.renameGroupDM = async (req, res) => {
    try {
        const { session } = await groupDM.rename({ dmId: req.params.dmId, actorId: req.user.sub, name: req.body?.name }, ioOf(req));
        return res.json({ success: true, dm: await groupDM.describe(session, req.user.sub) });
    } catch (err) {
        return sendError(res, err);
    }
};

/** POST /api/v2/dm/:dmId/members { userIds: [...] } */
exports.addGroupDMMembers = async (req, res) => {
    try {
        const { session, added } = await groupDM.addMembers({ dmId: req.params.dmId, actorId: req.user.sub, userIds: req.body?.userIds }, ioOf(req));
        return res.json({ success: true, added, dm: await groupDM.describe(session, req.user.sub) });
    } catch (err) {
        return sendError(res, err);
    }
};

/** DELETE /api/v2/dm/:dmId/members/:userId — leave (your own id) or remove someone. */
exports.removeGroupDMMember = async (req, res) => {
    try {
        const userId = req.params.userId === 'me' ? req.user.sub : req.params.userId;
        await groupDM.removeMember({ dmId: req.params.dmId, actorId: req.user.sub, userId }, ioOf(req));
        return res.json({ success: true, left: String(userId) === String(req.user.sub) });
    } catch (err) {
        return sendError(res, err);
    }
};
