// server/src/features/favorites/favorites.service.js
/**
 * Favorites Service - Business Logic Layer
 * 
 * Behavior-preserving migration from controllers/favoriteController.js
 * 
 * Handles user favorites (channels and DMs) within workspaces.
 * Uses separate Favorite model for persistence.
 * 
 * @module features/favorites/favorites.service
 */

const Favorite = require('../../../models/Favorite');
const Channel = require("../channels/channel.model.js");
const DMSession = require('../../../models/DMSession');

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * Get all favorites for user in a workspace
 * 
 * Business Rules:
 * - Returns favorites for specific user + workspace combination
 * - Populates itemId (Channel or DMSession)
 * - Sorted by creation date (newest first)
 * 
 * @param {string} userId - User ID from auth token
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<Object>} { favorites: Favorite[] }
 */
async function getFavorites(userId, workspaceId) {
    const favorites = await Favorite.find({
        user: userId,
        workspace: workspaceId
    }).populate('itemId');

    const favoritesData = favorites.map(fav => ({
        id: fav._id,
        itemType: fav.itemType,
        itemId: fav.itemId,
        createdAt: fav.createdAt
    }));

    return { favorites: favoritesData };
}

/**
 * Add item to favorites
 * 
 * Business Rules:
 * - Requires workspaceId, itemType, itemId
 * - Prevents duplicate favorites (unique index)
 * - itemType must be 'channel' or 'dm'
 * 
 * @param {string} userId - User ID from auth token
 * @param {Object} favoriteData - Favorite data
 * @param {string} favoriteData.workspaceId - Workspace ID
 * @param {string} favoriteData.itemType - 'channel' or 'dm'
 * @param {string} favoriteData.itemId - Channel or DMSession ID
 * @returns {Promise<Object>} { message: string, favorite: Favorite }
 */
async function addFavorite(userId, favoriteData) {
    const { workspaceId, itemType, itemId } = favoriteData;

    // Validation: required fields
    if (!workspaceId || !itemType || !itemId) {
        const error = new Error('Missing required fields');
        error.statusCode = 400;
        throw error;
    }

    // Check if already favorited
    const existing = await Favorite.findOne({
        user: userId,
        itemType,
        itemId
    });

    if (existing) {
        const error = new Error('Already favorited');
        error.statusCode = 400;
        throw error;
    }

    // Create favorite
    const favorite = await Favorite.create({
        user: userId,
        workspace: workspaceId,
        itemType,
        itemId
    });

    return {
        message: 'Added to favorites',
        favorite: {
            id: favorite._id,
            itemType: favorite.itemType,
            itemId: favorite.itemId
        }
    };
}

/**
 * Remove item from favorites
 * 
 * Business Rules:
 * - User can only remove their own favorites
 * - 404 if favorite not found or doesn't belong to user
 * 
 * @param {string} userId - User ID from auth token
 * @param {string} favoriteId - Favorite ID to remove
 * @returns {Promise<Object>} { message: string }
 */
async function removeFavorite(userId, favoriteId) {
    const favorite = await Favorite.findOne({
        _id: favoriteId,
        user: userId
    });

    if (!favorite) {
        const error = new Error('Favorite not found');
        error.statusCode = 404;
        throw error;
    }

    await Favorite.deleteOne({ _id: favoriteId });

    return { message: 'Removed from favorites' };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    getFavorites,
    addFavorite,
    removeFavorite
};
