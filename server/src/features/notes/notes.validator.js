// server/src/features/notes/notes.validator.js
/**
 * Notes Validator - Input Validation Layer
 * 
 * Schema validation for note operations.
 * NO business logic - only input sanitization and schema validation.
 * 
 * @module features/notes/notes.validator
 */

// ============================================================================
// VALIDATION RULES
// ============================================================================

/**
 * Validate note creation data
 * 
 * @param {Object} data - Note data to validate
 * @returns {Object} { valid: boolean, errors?: string[] }
 */
function validateCreateNote(data) {
    const errors = [];

    // Required fields
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
        errors.push('Title is required and must be a non-empty string');
    }

    if (data.title && data.title.length > 500) {
        errors.push('Title must not exceed 500 characters');
    }

    // Content validation
    if (data.content && typeof data.content !== 'string') {
        errors.push('Content must be a string');
    }

    if (data.content && data.content.length > 500000) {
        errors.push('Content must not exceed 500000 characters');
    }

    // Type validation — must match Note model enum
    if (data.type) {
        const validTypes = ['note', 'meeting', 'documentation', 'brainstorm', 'sop', 'projectspec', 'techdesign', 'announcement'];
        if (!validTypes.includes(data.type)) {
            errors.push(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
        }
    }

    // Workspace is always required
    if (!data.workspaceId) {
        errors.push('Workspace ID is required');
    }

    // sharedWith validation
    if (data.sharedWith && !Array.isArray(data.sharedWith)) {
        errors.push('sharedWith must be an array');
    }

    // tags validation
    if (data.tags && !Array.isArray(data.tags)) {
        errors.push('tags must be an array');
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}

/**
 * Validate note update data
 * 
 * @param {Object} data - Update data to validate
 * @returns {Object} { valid: boolean, errors?: string[] }
 */
function validateUpdateNote(data) {
    const errors = [];

    // Title validation (if provided)
    if (data.title !== undefined) {
        if (typeof data.title !== 'string' || data.title.trim().length === 0) {
            errors.push('Title must be a non-empty string');
        }
        if (data.title && data.title.length > 500) {
            errors.push('Title must not exceed 500 characters');
        }
    }

    // Content validation (if provided)
    if (data.content !== undefined) {
        if (typeof data.content !== 'string') {
            errors.push('Content must be a string');
        }
        if (data.content && data.content.length > 500000) {
            errors.push('Content must not exceed 500000 characters');
        }
    }

    // sharedWith validation (if provided)
    if (data.sharedWith !== undefined && !Array.isArray(data.sharedWith)) {
        errors.push('sharedWith must be an array');
    }

    // isPublic validation (if provided)
    if (data.isPublic !== undefined && typeof data.isPublic !== 'boolean') {
        errors.push('isPublic must be a boolean');
    }

    // isPinned validation (if provided)
    if (data.isPinned !== undefined && typeof data.isPinned !== 'boolean') {
        errors.push('isPinned must be a boolean');
    }

    // isArchived validation (if provided)
    if (data.isArchived !== undefined && typeof data.isArchived !== 'boolean') {
        errors.push('isArchived must be a boolean');
    }

    // tags validation (if provided)
    if (data.tags !== undefined && !Array.isArray(data.tags)) {
        errors.push('tags must be an array');
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}

/**
 * Validate share note data
 * 
 * @param {Object} data - Share data
 * @returns {Object} { valid: boolean, errors?: string[] }
 */
function validateShareNote(data) {
    const errors = [];

    if (!data.userIds || !Array.isArray(data.userIds) || data.userIds.length === 0) {
        errors.push('userIds must be a non-empty array');
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}

/**
 * Validate attachment data
 * 
 * @param {Object} data - Attachment data
 * @returns {Object} { valid: boolean, errors?: string[] }
 */
function validateAttachment(data) {
    const errors = [];

    if (!data.name || typeof data.name !== 'string') {
        errors.push('name is required and must be a string');
    }

    if (!data.url || typeof data.url !== 'string') {
        errors.push('url is required and must be a string');
    }

    if (!data.type || typeof data.type !== 'string') {
        errors.push('type (MIME type) is required and must be a string');
    }

    if (data.size === undefined || typeof data.size !== 'number') {
        errors.push('size is required and must be a number');
    }

    if (!data.category) {
        errors.push('category is required');
    } else {
        const validCategories = ['image', 'video', 'audio', 'document'];
        if (!validCategories.includes(data.category)) {
            errors.push(`category must be one of: ${validCategories.join(', ')}`);
        }
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
    validateCreateNote,
    validateUpdateNote,
    validateShareNote,
    validateAttachment
};
