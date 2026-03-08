/**
 * dmActions.controller.js
 * Handles all DM contact option actions:
 *   POST /api/v2/dm/:dmId/clear   — Clear chat (per-user watermark)
 *   DELETE /api/v2/dm/:dmId       — Delete chat (hide session for this user)
 *   POST /api/v2/dm/:dmId/block   — Block user in this DM
 *   DELETE /api/v2/dm/:dmId/block — Unblock user in this DM
 *   POST /api/v2/dm/:dmId/mute    — Mute notifications for this DM
 *   DELETE /api/v2/dm/:dmId/mute  — Unmute notifications for this DM
 *   GET  /api/v2/dm/:dmId/status  — Get mute/block status for current user
 */

const DMSession = require('../../../models/DMSession');
const Message = require('../../features/messages/message.model');
const mongoose = require('mongoose');

// ─── Helper: verify participant ───────────────────────────────────────────────
async function getSessionAsParticipant(dmId, userId) {
    const session = await DMSession.findById(dmId);
    if (!session) throw Object.assign(new Error('DM session not found'), { status: 404 });
    const isParticipant = session.participants.some(p => String(p) === String(userId));
    if (!isParticipant) throw Object.assign(new Error('Not a participant'), { status: 403 });
    return session;
}

// ─── GET /api/v2/dm/:dmId/status ─────────────────────────────────────────────
exports.getDMStatus = async (req, res) => {
    try {
        const { dmId } = req.params;
        const userId = req.user.sub;

        const session = await getSessionAsParticipant(dmId, userId);

        const isMuted = session.mutedBy?.some(m => String(m.user) === String(userId));
        const isBlocked = session.blockedBy?.some(b => String(b.user) === String(userId));

        return res.json({ isMuted, isBlocked });
    } catch (err) {
        return res.status(err.status || 500).json({ message: err.message });
    }
};

// ─── POST /api/v2/dm/:dmId/clear ─────────────────────────────────────────────
// Sets a per-user clearedAt watermark. Frontend already filters messages by
// createdAt > clearedAt when loading conversation (handled in getDMs).
exports.clearDMChat = async (req, res) => {
    try {
        const { dmId } = req.params;
        const userId = req.user.sub;

        const session = await getSessionAsParticipant(dmId, userId);

        // Remove existing clearedAt entry for this user, then add fresh one
        session.clearedAt = session.clearedAt.filter(c => String(c.user) !== String(userId));
        session.clearedAt.push({ user: userId, clearedAt: new Date() });
        await session.save();

        return res.json({ success: true, clearedAt: new Date() });
    } catch (err) {
        return res.status(err.status || 500).json({ message: err.message });
    }
};

// ─── DELETE /api/v2/dm/:dmId — Delete chat (hide for current user only) ──────
exports.deleteDMChat = async (req, res) => {
    try {
        const { dmId } = req.params;
        const userId = req.user.sub;

        const session = await getSessionAsParticipant(dmId, userId);

        // Add to hiddenFor (per-user soft-delete)
        const alreadyHidden = session.hiddenFor?.some(h => String(h.user) === String(userId));
        if (!alreadyHidden) {
            session.hiddenFor = session.hiddenFor || [];
            session.hiddenFor.push({ user: userId, hiddenAt: new Date() });
            await session.save();
        }

        return res.json({ success: true });
    } catch (err) {
        return res.status(err.status || 500).json({ message: err.message });
    }
};

// ─── POST /api/v2/dm/:dmId/block ─────────────────────────────────────────────
exports.blockUser = async (req, res) => {
    try {
        const { dmId } = req.params;
        const userId = req.user.sub;

        const session = await getSessionAsParticipant(dmId, userId);

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

// ─── DELETE /api/v2/dm/:dmId/block ───────────────────────────────────────────
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

// ─── POST /api/v2/dm/:dmId/mute ──────────────────────────────────────────────
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

// ─── DELETE /api/v2/dm/:dmId/mute ────────────────────────────────────────────
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
