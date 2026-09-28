const OBJECT_ID = /^[a-f\d]{24}$/i;
const MAX_ATTACHMENTS = 20;

/** attachments: [{ name, url }] — http(s) urls only, at most 20, names ≤ 200 chars. */
function validateAttachments(attachments) {
    const errors = [];
    if (attachments === undefined || attachments === null) return errors;
    if (!Array.isArray(attachments)) return ['attachments must be an array'];
    if (attachments.length > MAX_ATTACHMENTS) errors.push(`At most ${MAX_ATTACHMENTS} attachments are allowed`);
    attachments.forEach((a, i) => {
        if (!a || typeof a !== 'object') { errors.push(`attachments[${i}] must be an object`); return; }
        if (typeof a.name !== 'string' || !a.name.trim()) errors.push(`attachments[${i}].name is required`);
        else if (a.name.length > 200) errors.push(`attachments[${i}].name must not exceed 200 characters`);
        let ok = false;
        if (typeof a.url === 'string' && a.url.length <= 2048) {
            try { ok = ['http:', 'https:'].includes(new URL(a.url).protocol); } catch { ok = false; }
        }
        if (!ok) errors.push(`attachments[${i}].url must be an http(s) URL`);
        if (a.type !== undefined && a.type !== null && typeof a.type !== 'string') errors.push(`attachments[${i}].type must be a string`);
        if (a.size !== undefined && a.size !== null && (typeof a.size !== 'number' || a.size < 0)) errors.push(`attachments[${i}].size must be a non-negative number`);
    });
    return errors;
}

/** Normalised attachment records for storage. */
function normalizeAttachments(attachments, userId) {
    return (attachments || []).map(a => ({
        name: a.name.trim(),
        url: a.url,
        ...(typeof a.type === 'string' ? { type: a.type.slice(0, 100) } : {}),
        ...(typeof a.size === 'number' ? { size: a.size } : {}),
        uploadedBy: userId,
        uploadedAt: a.uploadedAt && !isNaN(new Date(a.uploadedAt).getTime()) ? new Date(a.uploadedAt) : new Date(),
    }));
}

function validateCreateTask(data) {
    const errors = [];

    
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
        errors.push('Title is required and must be a non-empty string');
    }

    if (data.title && data.title.length > 500) {
        errors.push('Title must not exceed 500 characters');
    }

    if (!data.workspaceId || typeof data.workspaceId !== 'string') {
        errors.push('Workspace ID is required');
    }

    
    if (data.assignmentType) {
        const validTypes = ['self', 'individual', 'members', 'channel'];
        if (!validTypes.includes(data.assignmentType)) {
            errors.push(`Invalid assignment type. Must be one of: ${validTypes.join(', ')}`);
        }

        
        if (['individual', 'members'].includes(data.assignmentType) && (!data.assignedToIds || !Array.isArray(data.assignedToIds) || data.assignedToIds.length === 0)) {
            errors.push('Individual assignment requires at least one assignee ID');
        }

        
        if (data.assignmentType === 'channel' && !data.channelId) {
            errors.push('Channel assignment requires a channel ID');
        }
    }

    
    if (data.taskMode) {
        const validModes = ['split', 'shared'];
        if (!validModes.includes(data.taskMode)) {
            errors.push(`Invalid task mode. Must be one of: ${validModes.join(', ')}`);
        }
    }

    
    if (data.status) {
        const validStatuses = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];
        if (!validStatuses.includes(data.status)) {
            errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }
    }

    
    if (data.priority) {
        const validPriorities = ['lowest', 'low', 'medium', 'high', 'highest'];
        if (!validPriorities.includes(data.priority)) {
            errors.push(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
        }
    }

    
    if (data.dueDate && isNaN(new Date(data.dueDate).getTime())) {
        errors.push('Invalid due date format');
    }

    
    if (data.tags && !Array.isArray(data.tags)) {
        errors.push('Tags must be an array');
    }

    
    if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
        errors.push('Description must be a string');
    } else if (data.description && data.description.length > 5000) {
        errors.push('Description must not exceed 5000 characters');
    }

    if (data.channelId !== undefined && data.channelId !== null && data.channelId !== '' &&
        (typeof data.channelId !== 'string' || !OBJECT_ID.test(data.channelId))) {
        errors.push('channelId must be a valid id');
    }

    if (data.assignedToIds !== undefined && data.assignedToIds !== null) {
        if (!Array.isArray(data.assignedToIds) || data.assignedToIds.some(id => typeof id !== 'string' || !OBJECT_ID.test(id))) {
            errors.push('assignedToIds must be an array of user IDs');
        }
    }

    if (data.status === 'blocked' && (!data.blockedReason || typeof data.blockedReason !== 'string' || !data.blockedReason.trim())) {
        errors.push('Blocked status requires a blockedReason');
    }

    errors.push(...validateAttachments(data.attachments));

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}

function validateUpdateTask(data) {
    const errors = [];

    
    if (data.title !== undefined) {
        if (typeof data.title !== 'string' || data.title.trim().length === 0) {
            errors.push('Title must be a non-empty string');
        }
        if (data.title && data.title.length > 500) {
            errors.push('Title must not exceed 500 characters');
        }
    }

    
    if (data.status) {
        const validStatuses = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];
        if (!validStatuses.includes(data.status)) {
            errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        
        if (data.status === 'blocked' && (!data.blockedReason || typeof data.blockedReason !== 'string' || !data.blockedReason.trim())) {
            errors.push('Blocked status requires a blockedReason');
        }
    }

    
    if (data.priority) {
        const validPriorities = ['lowest', 'low', 'medium', 'high', 'highest'];
        if (!validPriorities.includes(data.priority)) {
            errors.push(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
        }
    }

    
    if (data.dueDate && isNaN(new Date(data.dueDate).getTime())) {
        errors.push('Invalid due date format');
    }

    
    if (data.assignedTo !== undefined) {
        const list = Array.isArray(data.assignedTo) ? data.assignedTo : [data.assignedTo];
        if (list.some(id => typeof id !== 'string' || !OBJECT_ID.test(id))) {
            errors.push('assignedTo must be an array of user IDs or a single user ID');
        }
    }

    
    if (data.tags !== undefined && !Array.isArray(data.tags)) {
        errors.push('Tags must be an array');
    }

    
    // null clears the description (stored as '').
    if (data.description !== undefined && data.description !== null) {
        if (typeof data.description !== 'string') errors.push('Description must be a string');
        else if (data.description.length > 5000) errors.push('Description must not exceed 5000 characters');
    }

    if (data.blockedReason !== undefined && data.blockedReason !== null &&
        (typeof data.blockedReason !== 'string' || data.blockedReason.length > 1000)) {
        errors.push('blockedReason must be a string of at most 1000 characters');
    }

    if (data.completionNote !== undefined && data.completionNote !== null &&
        (typeof data.completionNote !== 'string' || data.completionNote.length > 2000)) {
        errors.push('completionNote must be a string of at most 2000 characters');
    }

    errors.push(...validateAttachments(data.attachments));

    
    if (data.storyPoints !== undefined && data.storyPoints !== null && (typeof data.storyPoints !== 'number' || data.storyPoints < 0)) {
        errors.push('Story points must be a non-negative number');
    }

    if (data.estimatedHours !== undefined && data.estimatedHours !== null && (typeof data.estimatedHours !== 'number' || data.estimatedHours < 0)) {
        errors.push('Estimated hours must be a non-negative number');
    }

    if (data.actualHours !== undefined && data.actualHours !== null && (typeof data.actualHours !== 'number' || data.actualHours < 0)) {
        errors.push('Actual hours must be a non-negative number');
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}

function validateCreateSubtask(data) {
    const errors = [];

    
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
        errors.push('Subtask title is required and must be a non-empty string');
    }

    if (data.title && data.title.length > 500) {
        errors.push('Subtask title must not exceed 500 characters');
    }

    
    if (data.description && data.description.length > 5000) {
        errors.push('Subtask description must not exceed 5000 characters');
    }

    
    if (data.priority) {
        const validPriorities = ['lowest', 'low', 'medium', 'high', 'highest'];
        if (!validPriorities.includes(data.priority)) {
            errors.push(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
        }
    }

    
    if (data.dueDate && isNaN(new Date(data.dueDate).getTime())) {
        errors.push('Invalid due date format');
    }

    
    if (data.assignedTo !== undefined && (!Array.isArray(data.assignedTo) ||
        data.assignedTo.some(id => typeof id !== 'string' || !OBJECT_ID.test(id)))) {
        errors.push('assignedTo must be an array of user IDs');
    }

    
    if (data.tags !== undefined && !Array.isArray(data.tags)) {
        errors.push('Tags must be an array');
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}

function validateTransferRequest(data) {
    const errors = [];

    if (!data.newAssigneeId || typeof data.newAssigneeId !== 'string' || !OBJECT_ID.test(data.newAssigneeId)) {
        errors.push('New assignee ID is required');
    }

    if (data.note && typeof data.note !== 'string') {
        errors.push('Transfer note must be a string');
    }

    if (data.note && data.note.length > 1000) {
        errors.push('Transfer note must not exceed 1000 characters');
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}

function validatePagination(params) {
    const errors = [];

    if (params.limit !== undefined) {
        const limit = parseInt(params.limit);
        if (isNaN(limit) || limit < 1 || limit > 200) {
            errors.push('Limit must be a number between 1 and 200');
        }
    }

    if (params.offset !== undefined) {
        const offset = parseInt(params.offset);
        if (isNaN(offset) || offset < 0) {
            errors.push('Offset must be a non-negative number');
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}

module.exports = {
    validateAttachments,
    normalizeAttachments,
    validateCreateTask,
    validateUpdateTask,
    validateCreateSubtask,
    validateTransferRequest,
    validatePagination
};
