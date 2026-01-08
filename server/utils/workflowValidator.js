/**
 * Task Workflow Validator
 * 
 * Implements state machine for task status transitions
 * Ensures tasks follow proper workflow rules
 */

// Define allowed status transitions
const WORKFLOW_TRANSITIONS = {
    backlog: ['todo', 'cancelled'],
    todo: ['in_progress', 'backlog', 'cancelled'],
    in_progress: ['review', 'blocked', 'todo', 'cancelled'],
    review: ['done', 'in_progress', 'blocked'],
    blocked: ['in_progress', 'todo'],
    done: [],  // Terminal state - no outgoing transitions
    cancelled: []  // Terminal state
};

/**
 * Validate if a status transition is allowed
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Desired status
 * @returns {boolean} - True if transition is valid
 */
function isValidTransition(fromStatus, toStatus) {
    // No change is always valid
    if (fromStatus === toStatus) return true;

    const allowedTransitions = WORKFLOW_TRANSITIONS[fromStatus];
    if (!allowedTransitions) return false;

    return allowedTransitions.includes(toStatus);
}

/**
 * Get allowed transitions for a given status
 * @param {string} status - Current status
 * @returns {string[]} - Array of allowed next statuses
 */
function getAllowedTransitions(status) {
    return WORKFLOW_TRANSITIONS[status] || [];
}

/**
 * Validate blocked state requirements
 * @param {string} newStatus - The status being set
 * @param {string} blockedReason - Reason for blocking (if applicable)
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateBlocked(newStatus, blockedReason) {
    if (newStatus === 'blocked' && !blockedReason) {
        return {
            valid: false,
            error: 'Blocked reason is required when blocking a task'
        };
    }
    return { valid: true };
}

/**
 * Check if status is terminal (cannot transition out)
 * @param {string} status
 * @returns {boolean}
 */
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
