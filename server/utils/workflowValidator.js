const WORKFLOW_TRANSITIONS = {
    backlog:     ['todo', 'in_progress', 'review', 'cancelled'],
    todo:        ['in_progress', 'review', 'backlog', 'cancelled'],
    in_progress: ['review', 'blocked', 'todo', 'backlog', 'done', 'cancelled'],
    review:      ['done', 'in_progress', 'blocked', 'todo'],
    blocked:     ['in_progress', 'todo', 'review', 'done'],
    done:        ['todo', 'in_progress'],  
    cancelled:   ['backlog', 'todo']       
};

function isValidTransition(fromStatus, toStatus) {
    
    if (fromStatus === toStatus) return true;

    const allowedTransitions = WORKFLOW_TRANSITIONS[fromStatus];
    if (!allowedTransitions) return false;

    return allowedTransitions.includes(toStatus);
}

function getAllowedTransitions(status) {
    return WORKFLOW_TRANSITIONS[status] || [];
}

function validateBlocked(newStatus, blockedReason) {
    if (newStatus === 'blocked' && !blockedReason) {
        return {
            valid: false,
            error: 'Blocked reason is required when blocking a task'
        };
    }
    return { valid: true };
}

function isTerminalStatus(status) {
    const transitions = WORKFLOW_TRANSITIONS[status];
    return !transitions || transitions.length === 0;
}

module.exports = {
    isValidTransition,
    getAllowedTransitions,
    validateBlocked,
    isTerminalStatus,
    WORKFLOW_TRANSITIONS
};
