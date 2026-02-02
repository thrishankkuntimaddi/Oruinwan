// server/routes/updates.js

const express = require("express");
const router = express.Router();
const updateController = require("./updates.controller");
const requireAuth = require("../../shared/middleware/auth");

// All routes require authentication


/**
 * @route   GET /api/updates/company/:companyId
 * @desc    Get updates for a company (Company-wide)
 * @query   type, priority, limit
 * @access  Private (company members)
 */
router.get("/company/:companyId", requireAuth, updateController.getCompanyUpdates);

/**
 * @route   GET /api/updates/:workspaceId
 * @desc    Get updates for a workspace
 * @query   type, priority, limit
 * @access  Private (workspace members)
 */
router.get("/:workspaceId", requireAuth, updateController.getUpdates);

/**
 * @route   POST /api/updates
 * @desc    Post a new update
 * @body    workspaceId, message, type, priority, mentions, attachments
 * @access  Private (workspace members, admin for announcements)
 */
router.post("/", requireAuth, updateController.postUpdate);

/**
 * @route   PUT /api/updates/:id
 * @desc    Update an existing update
 * @body    message, type, priority, isPinned
 * @access  Private (poster or workspace admin)
 */
router.put("/:id", requireAuth, updateController.updateUpdate);

/**
 * @route   DELETE /api/updates/:id
 * @desc    Delete an update (soft delete)
 * @access  Private (poster or workspace admin)
 */
router.delete("/:id", requireAuth, updateController.deleteUpdate);

/**
 * @route   POST /api/updates/:id/react
 * @desc    Add/remove reaction to update
 * @body    emoji
 * @access  Private
 */
router.post("/:id/react", requireAuth, updateController.addReaction);

/**
 * @route   POST /api/updates/:id/read
 * @desc    Mark update as read
 * @access  Private
 */
router.post("/:id/read", requireAuth, updateController.markAsRead);

module.exports = router;
