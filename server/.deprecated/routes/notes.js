// server/routes/notes.js

const express = require("express");
const router = express.Router();
const noteController = require("../controllers/noteController");
const requireAuth = require("../middleware/auth");

// All routes require authentication


/**
 * @route   GET /api/notes
 * @desc    Get user's notes (personal or workspace)
 * @query   workspaceId, type
 * @access  Private
 */
router.get("/", requireAuth, noteController.getNotes);

/**
 * @route   POST /api/notes
 * @desc    Create a new note
 * @body    title, content, type, workspaceId, sharedWith, tags
 * @access  Private
 */
router.post("/", requireAuth, noteController.createNote);

/**
 * @route   PUT /api/notes/:id
 * @desc    Update a note
 * @body    title, content, sharedWith, isPublic, isPinned, tags
 * @access  Private (note owner)
 */
router.put("/:id", requireAuth, noteController.updateNote);

/**
 * @route   DELETE /api/notes/:id
 * @desc    Delete/Archive a note
 * @query   permanent (boolean)
 * @access  Private (note owner)
 */
router.delete("/:id", requireAuth, noteController.deleteNote);

/**
 * @route   POST /api/notes/:id/share
 * @desc    Share note with users
 * @body    userIds (array)
 * @access  Private (note owner)
 */
router.post("/:id/share", requireAuth, noteController.shareNote);

/**
 * @route   POST /api/notes/:id/attachments
 * @desc    Add attachment to note
 * @body    attachment data
 * @access  Private (note owner or editor)
 */
router.post("/:id/attachments", requireAuth, noteController.addAttachment);

/**
 * @route   DELETE /api/notes/:id/attachments/:attachmentId
 * @desc    Remove attachment from note
 * @access  Private (note owner or editor)
 */
router.delete("/:id/attachments/:attachmentId", requireAuth, noteController.removeAttachment);

/**
 * @route   GET /api/notes/:id/attachments/:attachmentId/download
 * @desc    Download attachment
 * @access  Private (note viewers)
 */
router.get("/:id/attachments/:attachmentId/download", requireAuth, noteController.downloadAttachment);

module.exports = router;
