function validateAddFavorite(data) {
    const errors = [];

    
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

module.exports = {
    validateAddFavorite
};
