// server/routes/v1-to-v2-proxy.js
/**
 * V1 to V2 Proxy Routes
 * 
 * Temporary compatibility layer for legacy clients still using v1 endpoints.
 * Proxies requests from /api/* to /api/v2/* without code duplication.
 * 
 * DELETE THIS FILE once all clients are migrated to v2 endpoints.
 */

const express = require('express');
const router = express.Router();

// Import v2 controllers directly
const tasksController = require('../src/features/tasks/tasks.controller');
const notesController = require('../src/features/notes/notes.controller');
const favoritesController = require('../src/features/favorites/favorites.controller');
const requireAuth = require('../middleware/auth');

// ============================================================================
// TASKS PROXY - /api/tasks → /api/v2/tasks
// ============================================================================

router.get('/tasks', requireAuth, tasksController.getTasks);
router.post('/tasks', requireAuth, tasksController.createTask);
router.put('/tasks/:id', requireAuth, tasksController.updateTask);
router.delete('/tasks/:id', requireAuth, tasksController.deleteTask);

// ============================================================================
// NOTES PROXY - /api/notes → /api/v2/notes
// ============================================================================

router.get('/notes', requireAuth, notesController.getNotes);
router.post('/notes', requireAuth, notesController.createNote);
router.put('/notes/:id', requireAuth, notesController.updateNote);
router.delete('/notes/:id', requireAuth, notesController.deleteNote);
router.post('/notes/:id/share', requireAuth, notesController.shareNote);
router.post('/notes/:id/attachments', requireAuth, notesController.addAttachment);
router.delete('/notes/:id/attachments/:attachmentId', requireAuth, notesController.removeAttachment);
router.get('/notes/:id/attachments/:attachmentId/download', requireAuth, notesController.downloadAttachment);

// ============================================================================
// FAVORITES PROXY - /api/favorites → /api/v2/favorites
// ============================================================================

router.get('/favorites/:workspaceId', requireAuth, favoritesController.getFavorites);
router.post('/favorites', requireAuth, favoritesController.addFavorite);
router.delete('/favorites/:id', requireAuth, favoritesController.removeFavorite);

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = router;
