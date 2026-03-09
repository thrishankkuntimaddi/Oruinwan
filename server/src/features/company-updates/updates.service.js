// server/src/features/company-updates/updates.service.js
//
// Phase 5 — Company Updates Feed
// Business logic: company-scoped updates ("internal LinkedIn feed").
// Separate from workspace updates (/api/updates) — do NOT merge.
//
// Socket room convention: company:{companyId}:updates
// req.io is attached by server.js middleware — controllers pass it in.

const Update = require('../../../models/Update');
const User = require('../../../models/User');

// ============================================================================
// EMIT HELPERS
// ============================================================================

function emit(io, companyId, event, payload) {
    if (!io) return;
    io.to(`company:${companyId}:updates`).emit(event, payload);
}

// ============================================================================
// POST UPDATE
// ============================================================================

/**
 * Create a new company update.
 * Only manager, admin, owner may post (enforced at middleware level, but
 * double-checked here for defence-in-depth).
 */
async function postUpdate({ companyId, posterId, title, content, type, priority, attachments, mentions, io }) {
    const ALLOWED_ROLES = ['manager', 'admin', 'owner'];
    const poster = await User.findOne({ _id: posterId, companyId }).select('companyRole username profilePicture').lean();

    if (!poster) {
        const err = new Error('Poster not found in this company.');
        err.status = 403;
        throw err;
    }
    if (!ALLOWED_ROLES.includes(poster.companyRole)) {
        const err = new Error('Only managers, admins, and owners can post company updates.');
        err.status = 403;
        throw err;
    }

    const update = await Update.create({
        company: companyId,
        workspace: null,          // company-scoped: no workspace required
        postedBy: posterId,
        title: title || null,
        message: content,
        type: type || 'general',
        priority: priority || 'normal',
        attachments: attachments || [],
        mentions: mentions || [],
    });

    const populated = await Update.findById(update._id)
        .populate('postedBy', 'username profilePicture companyRole')
        .populate('mentions', 'username profilePicture')
        .lean();

    emit(io, companyId, 'company:update:created', populated);
    return populated;
}

// ============================================================================
// GET UPDATES
// ============================================================================

/**
 * List non-deleted company updates with optional filters.
 * Pinned updates sort first; then newest-first.
 */
async function getUpdates(companyId, { type, priority, search, limit = 50, page = 1 } = {}) {
    const filter = { company: companyId, isDeleted: false };

    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (search) {
        const rx = new RegExp(search, 'i');
        filter.$or = [{ message: rx }, { title: rx }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [updates, total] = await Promise.all([
        Update.find(filter)
            .populate('postedBy', 'username profilePicture companyRole')
            .populate('mentions', 'username profilePicture')
            .sort({ isPinned: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Update.countDocuments(filter),
    ]);

    return { updates, total, page: parseInt(page), limit: parseInt(limit) };
}

// ============================================================================
// DELETE UPDATE
// ============================================================================

/**
 * Soft-delete a company update.
 * Only the original poster OR an admin/owner can delete.
 */
async function deleteUpdate({ updateId, companyId, requesterId, requesterRole, io }) {
    const update = await Update.findOne({ _id: updateId, company: companyId, isDeleted: false });
    if (!update) {
        const err = new Error('Update not found.');
        err.status = 404;
        throw err;
    }

    const isPoster = update.postedBy.toString() === requesterId.toString();
    const isAdmin = ['admin', 'owner'].includes(requesterRole);

    if (!isPoster && !isAdmin) {
        const err = new Error('Only the original poster or an admin can delete this update.');
        err.status = 403;
        throw err;
    }

    update.isDeleted = true;
    await update.save();

    emit(io, companyId, 'company:update:deleted', { updateId });
    return { deleted: true, updateId };
}

// ============================================================================
// REACTIONS (toggle)
// ============================================================================

/**
 * Toggle a reaction (add if not exists, remove if already reacted with same emoji).
 */
async function addReaction({ updateId, companyId, userId, emoji, io }) {
    const update = await Update.findOne({ _id: updateId, company: companyId, isDeleted: false });
    if (!update) {
        const err = new Error('Update not found.');
        err.status = 404;
        throw err;
    }

    const existingIdx = update.reactions.findIndex(
        r => r.userId.toString() === userId.toString() && r.emoji === emoji
    );

    let action;
    if (existingIdx !== -1) {
        update.reactions.splice(existingIdx, 1);
        action = 'removed';
    } else {
        update.reactions.push({ emoji, userId });
        action = 'added';
    }

    await update.save();

    emit(io, companyId, 'company:update:reacted', {
        updateId, emoji, userId, action,
        reactions: update.reactions,
    });

    return { action, reactions: update.reactions };
}

// ============================================================================
// MARK AS READ
// ============================================================================

/**
 * Mark an update as read for a specific user.
 */
async function markAsRead({ updateId, companyId, userId }) {
    await Update.findOneAndUpdate(
        { _id: updateId, company: companyId, isDeleted: false },
        { $addToSet: { readBy: userId } }
    );
    return { read: true };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    postUpdate,
    getUpdates,
    deleteUpdate,
    addReaction,
    markAsRead,
};
