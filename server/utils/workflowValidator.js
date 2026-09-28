// Keep in sync with client/src/utils/taskMeta.js (TRANSITIONS).
// Open work can move freely between open states and straight to done;
// done can be reopened, cancelled can be restored.
const OPEN = ['backlog', 'todo', 'in_progress', 'review', 'blocked'];
const WORKFLOW_TRANSITIONS = {
    backlog:     [...OPEN.filter((s) => s !== 'backlog'), 'done', 'cancelled'],
    todo:        [...OPEN.filter((s) => s !== 'todo'), 'done', 'cancelled'],
    in_progress: [...OPEN.filter((s) => s !== 'in_progress'), 'done', 'cancelled'],
    review:      [...OPEN.filter((s) => s !== 'review'), 'done', 'cancelled'],
    blocked:     [...OPEN.filter((s) => s !== 'blocked'), 'done', 'cancelled'],
    done:        ['todo', 'in_progress', 'review'],
    cancelled:   ['backlog', 'todo'],
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
