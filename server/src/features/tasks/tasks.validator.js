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
        const validTypes = ['self', 'individual', 'channel'];
        if (!validTypes.includes(data.assignmentType)) {
            errors.push(`Invalid assignment type. Must be one of: ${validTypes.join(', ')}`);
        }

        
        if (data.assignmentType === 'individual' && (!data.assignedToIds || !Array.isArray(data.assignedToIds) || data.assignedToIds.length === 0)) {
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

    
    if (data.description && data.description.length > 5000) {
        errors.push('Description must not exceed 5000 characters');
    }

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

        
        if (data.status === 'blocked' && (!data.blockedReason || typeof data.blockedReason !== 'string')) {
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

    
    if (data.assignedTo !== undefined && !Array.isArray(data.assignedTo) && typeof data.assignedTo !== 'string') {
        errors.push('assignedTo must be an array of user IDs or a single user ID');
    }

    
    if (data.tags !== undefined && !Array.isArray(data.tags)) {
        errors.push('Tags must be an array');
    }

    
    if (data.description !== undefined && data.description.length > 5000) {
        errors.push('Description must not exceed 5000 characters');
    }

    
    if (data.storyPoints !== undefined && (typeof data.storyPoints !== 'number' || data.storyPoints < 0)) {
        errors.push('Story points must be a non-negative number');
    }

    if (data.estimatedHours !== undefined && (typeof data.estimatedHours !== 'number' || data.estimatedHours < 0)) {
        errors.push('Estimated hours must be a non-negative number');
    }

    if (data.actualHours !== undefined && (typeof data.actualHours !== 'number' || data.actualHours < 0)) {
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

    
    if (data.assignedTo !== undefined && !Array.isArray(data.assignedTo)) {
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

    if (!data.newAssigneeId || typeof data.newAssigneeId !== 'string') {
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
    validateCreateTask,
    validateUpdateTask,
    validateCreateSubtask,
    validateTransferRequest,
    validatePagination
};
