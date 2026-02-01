// server/src/features/favorites/favorites.validator.js
/**
 * Favorites Validator - Input Validation Layer
 * 
 * Schema validation for favorite operations.
 * 
 * @module features/favorites/favorites.validator
 */

// ============================================================================
// VALIDATION RULES
// ============================================================================

/**
 * Validate add favorite data
 * 
 * @param {Object} data - Favorite data to validate
 * @returns {Object} { valid: boolean, errors?: string[] }
 */
function validateAddFavorite(data) {
    const errors = [];

    // Required fields
    if (!data.workspaceId || typeof data.workspaceId !== 'string') {
        errors.push('workspaceId is required and must be a string');
    }

    if (!data.itemType) {
        errors.push('itemType is required');
    } else {
        const validTypes = ['channel', 'dm'];
        if (!validTypes.includes(data.itemType)) {
            errors.push(`itemType must be one of: ${validTypes.join(', ')}`);
        }
    }

    if (!data.itemId || typeof data.itemId !== 'string') {
        errors.push('itemId is required and must be a string');
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    validateAddFavorite
};
