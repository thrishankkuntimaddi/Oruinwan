// server/src/features/favorites/favorites.routes.js
/**
 * Favorites Routes - HTTP Routing Layer
 * 
 * Defines v2 API endpoints for favorites
 * 
 * Base path: /api/v2/favorites
 * All routes require authentication via requireAuth middleware
 * 
 * @module features/favorites/favorites.routes
 */

const express = require('express');
const router = express.Router();
const favoritesController = require('./favorites.controller');
const requireAuth = require('../../shared/middleware/auth');

// ============================================================================
// MIDDLEWARE
// ============================================================================

// All routes require authentication
router.use(requireAuth);

// ============================================================================
// ROUTES
// ============================================================================

// GET /api/v2/favorites/:workspaceId - Get favorites for workspace
router.get('/:workspaceId', favoritesController.getFavorites);

// POST /api/v2/favorites - Add to favorites
router.post('/', favoritesController.addFavorite);

// DELETE /api/v2/favorites/:id - Remove from favorites
router.delete('/:id', favoritesController.removeFavorite);

// ============================================================================
// EXPORT
// ============================================================================

module.exports = router;
