// server/src/features/company-updates/updates.controller.js
//
// Phase 5 — Company Updates Feed — thin HTTP handlers.

const { validationResult } = require('express-validator');
const updatesService = require('./updates.service');

function validationGuard(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
        });
    }
    return null;
}

function handleError(res, err) {
    console.error('[UPDATES CTRL]', err.message);
    return res.status(err.status || 500).json({ success: false, error: err.message });
}

/**
 * GET /api/company/updates
 * List company updates. All active members can read.
 */
exports.getUpdates = async (req, res) => {
    if (validationGuard(req, res)) return;
    try {
        const { type, priority, search, limit, page } = req.query;
        const result = await updatesService.getUpdates(req.companyId, { type, priority, search, limit, page });
        return res.json({ success: true, ...result });
    } catch (err) {
        return handleError(res, err);
    }
};

/**
 * POST /api/company/updates
 * Post a new company update. Manager+ only.
 */
exports.postUpdate = async (req, res) => {
    if (validationGuard(req, res)) return;
    try {
        const { title, content, type, priority, visibility, targetDepartment, attachments, mentions } = req.body;
        const posterId = req.user._dbUser?._id || req.user.sub || req.user._id;

        const update = await updatesService.postUpdate({
            companyId: req.companyId,
            posterId,
            title,
            content,
            type,
            priority,
            visibility,
            targetDepartment,
            attachments,
            mentions,
            io: req.io,
        });

        return res.status(201).json({ success: true, update });
    } catch (err) {
        return handleError(res, err);
    }
};


/**
 * DELETE /api/company/updates/:id
 * Soft-delete. Poster or admin.
 */
exports.deleteUpdate = async (req, res) => {
    try {
        const requesterId = req.user.sub || req.user._id;
        const requesterRole = req.companyRole;

        const result = await updatesService.deleteUpdate({
            updateId: req.params.id,
            companyId: req.companyId,
            requesterId,
            requesterRole,
            io: req.io,
        });

        return res.json({ success: true, ...result });
    } catch (err) {
        return handleError(res, err);
    }
};

/**
 * POST /api/company/updates/:id/react
 * Toggle emoji reaction.
 */
exports.addReaction = async (req, res) => {
    if (validationGuard(req, res)) return;
    try {
        const userId = req.user.sub || req.user._id;
        const { emoji } = req.body;

        const result = await updatesService.addReaction({
            updateId: req.params.id,
            companyId: req.companyId,
            userId,
            emoji,
            io: req.io,
        });

        return res.json({ success: true, ...result });
    } catch (err) {
        return handleError(res, err);
    }
};

/**
 * POST /api/company/updates/:id/read
 * Mark an update as read for the current user.
 */
exports.markAsRead = async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const result = await updatesService.markAsRead({
            updateId: req.params.id,
            companyId: req.companyId,
            userId,
        });
        return res.json({ success: true, ...result });
    } catch (err) {
        return handleError(res, err);
    }
};
