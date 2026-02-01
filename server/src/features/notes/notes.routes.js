// server/src/features/notes/notes.routes.js
/**
 * Notes Routes - HTTP Routing Layer
 * 
 * Defines v2 API endpoints for notes
 * 
 * Base path: /api/v2/notes
 * All routes require authentication via requireAuth middleware
 * 
 * @module features/notes/notes.routes
 */

const express = require('express');
const router = express.Router();
const notesController = require('./notes.controller');
const requireAuth = require('../../../middleware/auth');

// ============================================================================
// MIDDLEWARE
// ============================================================================

// All routes require authentication
router.use(requireAuth);

// ============================================================================
// ROUTES
// ============================================================================

// GET /api/v2/notes - Get user's notes (personal or workspace)
router.get('/', notesController.getNotes);

// POST /api/v2/notes - Create a new note
router.post('/', notesController.createNote);

// PUT /api/v2/notes/:id - Update a note
router.put('/:id', notesController.updateNote);

// DELETE /api/v2/notes/:id - Delete/Archive a note
router.delete('/:id', notesController.deleteNote);

// POST /api/v2/notes/:id/share - Share note with users
router.post('/:id/share', notesController.shareNote);

// POST /api/v2/notes/:id/attachments - Add attachment to note
router.post('/:id/attachments', notesController.addAttachment);

// DELETE /api/v2/notes/:id/attachments/:attachmentId - Remove attachment
router.delete('/:id/attachments/:attachmentId', notesController.removeAttachment);

// GET /api/v2/notes/:id/attachments/:attachmentId/download - Download attachment
router.get('/:id/attachments/:attachmentId/download', notesController.downloadAttachment);

// ============================================================================
// EXPORT
// ============================================================================

module.exports = router;
