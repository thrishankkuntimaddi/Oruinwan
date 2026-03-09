// server/src/features/company-updates/updates.routes.js
//
// Phase 5 — Company Updates Feed
// Routes mounted at /api/company (alongside people.routes.js).
//
// Socket event contract (company:{companyId}:updates room):
//   company:update:created  → new update posted
//   company:update:deleted  → update soft-deleted
//   company:update:reacted  → emoji reaction toggled
//
// Clients must join room: socket.join(`company:${companyId}:updates`)

const express = require('express');
const router = express.Router();

const ctrl = require('./updates.controller');
const validation = require('./updates.validation');

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

// ============================================================================
// ROUTES
// ============================================================================

/**
 * @route   GET /api/company/updates
 * @desc    List company updates (newest first, pinned first)
 * @access  Private — any active company member
 * @query   type?, priority?, search?, limit?, page?
 */
router.get(
    '/updates',
    requireAuth,
    requireCompanyMember,
    validation.getUpdates,
    ctrl.getUpdates
);

/**
 * @route   POST /api/company/updates
 * @desc    Post a new company update
 * @access  Private — manager, admin, or owner
 * @body    { content, title?, type?, priority?, attachments?, mentions? }
 */
router.post(
    '/updates',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('manager'),
    validation.postUpdate,
    ctrl.postUpdate
);

/**
 * @route   DELETE /api/company/updates/:id
 * @desc    Soft-delete an update (poster or admin)
 * @access  Private — any active company member (poster-or-admin guard in service)
 */
router.delete(
    '/updates/:id',
    requireAuth,
    requireCompanyMember,
    ctrl.deleteUpdate
);

/**
 * @route   POST /api/company/updates/:id/react
 * @desc    Toggle an emoji reaction on an update
 * @access  Private — any active company member
 * @body    { emoji: string }
 */
router.post(
    '/updates/:id/react',
    requireAuth,
    requireCompanyMember,
    validation.addReaction,
    ctrl.addReaction
);

/**
 * @route   POST /api/company/updates/:id/read
 * @desc    Mark an update as read (adds userId to readBy[])
 * @access  Private — any active company member
 */
router.post(
    '/updates/:id/read',
    requireAuth,
    requireCompanyMember,
    ctrl.markAsRead
);

module.exports = router;
