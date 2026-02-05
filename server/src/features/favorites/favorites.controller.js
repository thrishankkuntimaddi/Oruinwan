// server/src/features/favorites/favorites.controller.js
/**
 * Favorites Controller - HTTP Request/Response Layer
 * 
 * Thin wrappers for favorite operations.
 * 
 * @module features/favorites/favorites.controller
 */

const favoritesService = require('./favorites.service');
const validator = require('./favorites.validator');

// ============================================================================
// HELPER: Error Response Handler
// ============================================================================

function handleError(res, error) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';

    const response = { message };
    if (error.errors) {
        response.errors = error.errors;
    }

    return res.status(statusCode).json(response);
}

// ============================================================================
// CONTROLLERS
// ============================================================================

/**
 * GET /api/v2/favorites/:workspaceId
 * Get all favorites for user in workspace
 */
async function getFavorites(req, res) {
    try {
        const userId = req.user.sub;
        const { workspaceId } = req.params;

        const result = await favoritesService.getFavorites(userId, workspaceId);
        return res.json(result);
    } catch (_error) {
        console.error('GET_FAVORITES ERROR:', error);
        return handleError(res, error);
    }
}

/**
 * POST /api/v2/favorites
 * Add item to favorites
 */
async function addFavorite(req, res) {
    try {
        const userId = req.user.sub;
        const favoriteData = req.body;

        // Validate input
        const validation = validator.validateAddFavorite(favoriteData);
        if (!validation.valid) {
            const error = new Error('Validation failed');
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await favoritesService.addFavorite(userId, favoriteData);
        return res.status(201).json(result);
    } catch (_error) {
        console.error('ADD_FAVORITE ERROR:', error);
        return handleError(res, error);
    }
}

/**
 * DELETE /api/v2/favorites/:id
 * Remove item from favorites
 */
async function removeFavorite(req, res) {
    try {
        const userId = req.user.sub;
        const { id } = req.params;

        const result = await favoritesService.removeFavorite(userId, id);
        return res.json(result);
    } catch (_error) {
        console.error('REMOVE_FAVORITE ERROR:', error);
        return handleError(res, error);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    getFavorites,
    addFavorite,
    removeFavorite
};
